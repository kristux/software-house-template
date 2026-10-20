const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'log-decision.js');

function withFile(content, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-decision-'));
  const file = path.join(dir, 'decisions.md');
  fs.writeFileSync(file, content, 'utf8');
  try {
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function run(file, project, text, extra = []) {
  return spawnSync(process.execPath, [SCRIPT, '--project', project, '--text', text, '--file', file, ...extra], {
    encoding: 'utf8',
  });
}

const HEADER = '# Decision log\n\nIntro.\n\n---\n\n';

test('appends to the last section of an LF file', () => {
  const content = HEADER + '## 2026-01-01 todo-cli: kickoff\n- first\n';
  withFile(content, (file) => {
    const r = run(file, 'todo-cli', 'second');
    assert.strictEqual(r.status, 0, r.stderr);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), HEADER + '## 2026-01-01 todo-cli: kickoff\n- first\n- second\n');
  });
});

test('appends before the next heading with one blank line kept', () => {
  const content = HEADER + '## 2026-01-01 todo-cli: kickoff\n- first\n\n\n## 2026-01-02 other: x\n- y\n';
  withFile(content, (file) => {
    const r = run(file, 'todo-cli', 'second');
    assert.strictEqual(r.status, 0, r.stderr);
    assert.strictEqual(
      fs.readFileSync(file, 'utf8'),
      HEADER + '## 2026-01-01 todo-cli: kickoff\n- first\n- second\n\n## 2026-01-02 other: x\n- y\n'
    );
  });
});

test('keeps CRLF line endings in a CRLF file', () => {
  const content = (HEADER + '## 2026-01-01 todo-cli: kickoff\n- first\n').replace(/\n/g, '\r\n');
  withFile(content, (file) => {
    const r = run(file, 'todo-cli', 'second');
    assert.strictEqual(r.status, 0, r.stderr);
    assert.strictEqual(
      fs.readFileSync(file, 'utf8'),
      (HEADER + '## 2026-01-01 todo-cli: kickoff\n- first\n- second\n').replace(/\n/g, '\r\n')
    );
  });
});

test('finds a CRLF heading appended to an LF file and leaves the other lines byte-identical', () => {
  const lfPart = HEADER + '## 2026-01-01 other: x\n- y\n\n';
  const content = lfPart + '## 2026-01-02 todo-cli: kickoff\r\n- first\r\n';
  withFile(content, (file) => {
    const r = run(file, 'todo-cli', 'second');
    assert.strictEqual(r.status, 0, r.stderr);
    const after = fs.readFileSync(file, 'utf8');
    assert.ok(after.startsWith(lfPart), 'LF part of the file was rewritten');
    assert.match(after, /- first\r?\n- second\r?\n$/);
  });
});

test('finds an LF heading in a mostly CRLF file', () => {
  const crlfPart = (HEADER + '## 2026-01-01 other: x\n- y\n\n').replace(/\n/g, '\r\n');
  const content = crlfPart + '## 2026-01-02 todo-cli: kickoff\n- first\n';
  withFile(content, (file) => {
    const r = run(file, 'todo-cli', 'second');
    assert.strictEqual(r.status, 0, r.stderr);
    const after = fs.readFileSync(file, 'utf8');
    assert.ok(after.startsWith(crlfPart), 'CRLF part of the file was rewritten');
    assert.match(after, /- first\r?\n- second\r?\n$/);
  });
});

test('keeps a missing final newline missing', () => {
  const content = HEADER + '## 2026-01-01 todo-cli: kickoff\n- first';
  withFile(content, (file) => {
    const r = run(file, 'todo-cli', 'second');
    assert.strictEqual(r.status, 0, r.stderr);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), HEADER + '## 2026-01-01 todo-cli: kickoff\n- first\n- second');
  });
});

test('matches the slug as a whole token only', () => {
  const content = HEADER + '## 2026-01-01 todo-cli: kickoff\n- a\n\n## 2026-01-02 todo: kickoff\n- b\n';
  withFile(content, (file) => {
    const r = run(file, 'todo-cli', 'c', ['--dry-run']);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /under "2026-01-01 todo-cli: kickoff"/);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), content, 'dry run changed the file');
  });
});

test('fails without creating a section when no heading matches', () => {
  const content = HEADER + '## 2026-01-01 other: x\n- y\n';
  withFile(content, (file) => {
    const r = run(file, 'todo-cli', 'z');
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr, /No "## " heading for project "todo-cli"/);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), content);
  });
});

test('rejects an em dash in the text', () => {
  const content = HEADER + '## 2026-01-01 todo-cli: kickoff\n- a\n';
  withFile(content, (file) => {
    const r = run(file, 'todo-cli', `a ${String.fromCharCode(0x2014)} b`);
    assert.strictEqual(r.status, 1);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), content);
  });
});
