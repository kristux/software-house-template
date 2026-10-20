#!/usr/bin/env node
// Append one decision bullet to the end of a project's section in
// docs/product/decisions.md.
//
// The project's section is the LAST level-2 heading whose text contains the
// slug as a whole token: the slug must start the heading text or follow a space
// or "(", and must be followed by a space, ")", ":" or the end of the heading.
// So slug "todo" does not match a "todo-cli" heading, and the reverse.
// The bullet goes at the end of that section, before the next level-2 heading,
// with exactly one blank line kept before that heading. Continuation lines of
// multi-line text are indented by two spaces. Every existing line keeps its own
// ending (LF, CRLF, or a mix), new lines take the ending of the line they follow,
// and the write is atomic (temp file in the same directory, then rename).
//
// The caller writes any date or author into the text itself. If no section
// matches, the script fails and does not create one.
//
// Usage:
//   node scripts/log-decision.js --project <slug> --text "<decision text>" \
//        [--dry-run] [--file <path>]
//
// --dry-run prints the heading, line number and bullet it would write, and
// changes nothing. --file points at another copy of decisions.md (for tests).
//
// Example:
//   node scripts/log-decision.js --project todo-cli \
//        --text "2026-10-12 founder: keep the default page size at 50."

const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, '..', 'docs', 'product', 'decisions.md');
const EM_DASH = '\u2014';
const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') {
      args['dry-run'] = true;
    } else if (a.startsWith('--')) {
      if (i + 1 >= argv.length) {
        process.stderr.write(`Missing value for ${a}\n`);
        process.exit(2);
      }
      args[a.slice(2)] = argv[++i];
    } else {
      process.stderr.write(`Unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  return args;
}

function headingMatchesSlug(headingText, slug) {
  const escaped = slug.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  const pattern = new RegExp(`(^|[ (])${escaped}( |\\)|:|$)`);
  return pattern.test(headingText);
}

function findTargetSection(lines, slug) {
  let headingIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ') && headingMatchesSlug(lines[i].slice(3), slug)) {
      headingIndex = i;
    }
  }
  if (headingIndex === -1) return null;
  let end = lines.length;
  let hasNextHeading = false;
  for (let j = headingIndex + 1; j < lines.length; j++) {
    if (lines[j].startsWith('## ')) {
      end = j;
      hasNextHeading = true;
      break;
    }
  }
  return { headingIndex, end, hasNextHeading };
}

// Each line keeps its own terminator, so a file with mixed endings (an LF file
// with one CRLF line appended by a Windows tool, or the reverse) is still split
// into real lines and every untouched line is written back byte-identical.
function splitLines(content) {
  const lines = [];
  const eols = [];
  const parts = content.split('\n');
  parts.forEach((part, i) => {
    const last = i === parts.length - 1;
    if (!last && part.endsWith('\r')) {
      lines.push(part.slice(0, -1));
      eols.push('\r\n');
    } else {
      lines.push(part);
      eols.push(last ? '' : '\n');
    }
  });
  return { lines, eols };
}

function dominantEol(eols) {
  const crlf = eols.filter((e) => e === '\r\n').length;
  const lf = eols.filter((e) => e === '\n').length;
  return crlf > lf ? '\r\n' : '\n';
}

function joinLines(lines, eols) {
  return lines.map((line, i) => line + eols[i]).join('');
}

function toBullets(text) {
  return text.split('\n').map((part, i) => {
    if (i === 0) return `- ${part}`;
    return part === '' ? '' : `  ${part}`;
  });
}

function main() {
  const args = parseArgs(process.argv);
  const missing = ['project', 'text'].filter((k) => !args[k]);
  if (missing.length) {
    process.stderr.write(`Missing required argument(s): ${missing.map((m) => '--' + m).join(', ')}\n`);
    process.exit(2);
  }
  const slug = args.project;
  if (!SLUG_PATTERN.test(slug)) {
    process.stderr.write(`--project must be a slug (letters, digits, '-' or '_')\n`);
    process.exit(2);
  }
  const text = args.text.replace(/\r\n/g, '\n').trim();
  if (text === '') {
    process.stderr.write(`--text must not be empty\n`);
    process.exit(2);
  }
  if (text.includes(EM_DASH)) {
    process.stderr.write(`Rejected: --text contains an em dash. Use a hyphen or rewrite the sentence.\n`);
    process.exit(1);
  }

  const file = args.file ? path.resolve(args.file) : DEFAULT_FILE;
  const content = fs.readFileSync(file, 'utf8');
  const { lines, eols } = splitLines(content);

  const section = findTargetSection(lines, slug);
  if (!section) {
    process.stderr.write(
      `No "## " heading for project "${slug}" in ${file}.\n` +
        `Add a heading first, e.g. "## <YYYY-MM-DD> ${slug} ...", then rerun.\n`
    );
    process.exit(1);
  }

  const heading = lines[section.headingIndex].slice(3);
  let insertAfter = section.headingIndex;
  for (let k = section.end - 1; k > section.headingIndex; k--) {
    if (lines[k].trim() !== '') {
      insertAfter = k;
      break;
    }
  }

  const bullets = toBullets(text);
  const eol = eols[insertAfter] || dominantEol(eols);
  const beforeLines = lines.slice(0, insertAfter + 1);
  const beforeEols = eols.slice(0, insertAfter + 1);
  const addedLines = section.hasNextHeading ? [...bullets, ''] : bullets;
  const addedEols = addedLines.map(() => eol);
  const keepFrom = section.hasNextHeading ? section.end : insertAfter + 1;
  if (beforeEols[insertAfter] === '') {
    beforeEols[insertAfter] = eol;
    addedEols[addedEols.length - 1] = '';
  }
  const updated = joinLines(
    [...beforeLines, ...addedLines, ...lines.slice(keepFrom)],
    [...beforeEols, ...addedEols, ...eols.slice(keepFrom)]
  );
  const lineNumber = insertAfter + 2;

  if (args['dry-run']) {
    process.stdout.write(`Would log decision under "${heading}" (line ${lineNumber}):\n`);
    process.stdout.write(bullets.join('\n') + '\n');
    return;
  }

  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, updated, 'utf8');
  fs.renameSync(tmp, file);
  process.stdout.write(`Logged decision under "${heading}" (line ${lineNumber})\n`);
}

main();
