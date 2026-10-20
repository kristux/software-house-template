#!/usr/bin/env node
// Token and cost accounting for the software house.
//
// Reads Claude Code session transcripts (JSONL) for this project and reports
// token usage and estimated USD cost, broken down by session and by whether
// the work was done by the main session or a delegated sub-agent (isSidechain).
//
// The Finance agent runs this to get deterministic numbers instead of eyeballing
// raw transcripts. Numbers here are the source of truth for spend; the limits
// live in docs/finance/budget.md.
//
// Usage:
//   node scripts/token-report.js                    full history, text summary
//   node scripts/token-report.js --window-hours 5   only the last N hours (rolling)
//   node scripts/token-report.js --since <YYYY-MM-DD> only messages on/after a date/time
//   node scripts/token-report.js --json             machine-readable output
//   node scripts/token-report.js --dir <path>       override the transcript directory
//
// --window-hours is what the Finance agent uses to gauge the Claude Pro 5-hour
// usage window: it counts only messages timestamped within the last N hours.
//
// Pricing below is per 1,000,000 tokens. Update it if plan pricing changes.

const fs = require('fs');
const path = require('path');
const os = require('os');

// Per-model pricing in USD per million tokens. Keys are matched as substrings
// against the model id on each message, longest key first, so specific versions
// win over the bare-family fallbacks.
//
// cacheWrite is the 5-minute-TTL rate (1.25x input); a 1-hour-TTL write is 2x
// input, which this table does not model. cacheRead is 0.1x input.
//
// Check these against current published pricing before trusting a report: a
// wrong row misprices every message from that model, and a missing model prices
// at zero (the report warns when it sees one).
const PRICING = {
  'claude-opus-5-5': { input: 4.0, output: 20.0, cacheWrite: 5.0, cacheRead: 0.2 },
  'claude-opus-5': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-8': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-7': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-6': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-5': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-1': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-opus-4-0': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-opus-4': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-sonnet-5': { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.2 },
  'claude-sonnet': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
  'claude-fable-5-1': { input: 10.0, output: 50.0, cacheWrite: 12.5, cacheRead: 0.25 },
  'claude-fable': { input: 10.0, output: 50.0, cacheWrite: 12.5, cacheRead: 1.0 },
};

function priceFor(model) {
  if (!model) return null;
  const keys = Object.keys(PRICING).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (model.includes(k)) return PRICING[k];
  }
  return null;
}

function parseArgs(argv) {
  const args = { since: null, until: null, windowHours: null, json: false, dir: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--since') args.since = argv[++i];
    else if (a === '--until') args.until = argv[++i];
    else if (a === '--window-hours') args.windowHours = parseFloat(argv[++i]);
    else if (a === '--dir') args.dir = argv[++i];
    else {
      process.stderr.write(`Unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  if (args.windowHours != null && !(args.windowHours > 0)) {
    process.stderr.write(`--window-hours must be a positive number\n`);
    process.exit(2);
  }
  return args;
}

// Claude Code stores transcripts under ~/.claude/projects/<encoded-cwd>/ where
// the cwd has every : \ and / replaced with a dash.
function defaultTranscriptDir() {
  const encoded = process.cwd().replace(/[\\/:]/g, '-');
  return path.join(os.homedir(), '.claude', 'projects', encoded);
}

function costOf(u, price) {
  if (!price) return 0;
  const M = 1_000_000;
  return (
    ((u.input_tokens || 0) * price.input +
      (u.output_tokens || 0) * price.output +
      (u.cache_creation_input_tokens || 0) * price.cacheWrite +
      (u.cache_read_input_tokens || 0) * price.cacheRead) /
    M
  );
}

function emptyBucket() {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    cost: 0,
    messages: 0,
  };
}

function addUsage(bucket, u, cost) {
  bucket.input_tokens += u.input_tokens || 0;
  bucket.output_tokens += u.output_tokens || 0;
  bucket.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
  bucket.cache_read_input_tokens += u.cache_read_input_tokens || 0;
  bucket.cost += cost;
  bucket.messages += 1;
}

// Scan every transcript JSONL in `dir`, summing usage for messages whose
// timestamp falls in [sinceTs, untilTs] (either bound may be null). This is the
// single place that parses the transcript format; other tools reuse it so there
// is one thing to fix if Claude Code changes the format.
function scanUsage(dir, sinceTs, untilTs) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  const total = emptyBucket();
  const main_session = emptyBucket();
  const delegated = emptyBucket();
  const perSession = {};
  const perModel = {};
  const seen = new Set(); // dedupe by message id; transcripts can repeat a line
  const unpriced = new Set(); // models with no PRICING entry; they cost $0 otherwise

  for (const file of files) {
    const sessionId = file.replace(/\.jsonl$/, '');
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue; // skip malformed lines rather than aborting the whole report
      }
      const msg = obj.message;
      if (!msg || typeof msg !== 'object') continue;
      const u = msg.usage;
      if (!u) continue;

      if (obj.timestamp) {
        const ts = Date.parse(obj.timestamp);
        if (sinceTs && ts < sinceTs) continue;
        if (untilTs && ts > untilTs) continue;
      }

      const id = msg.id || obj.uuid;
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }

      const model = msg.model || 'unknown';
      const price = priceFor(model);
      if (!price) unpriced.add(model);
      const cost = costOf(u, price);

      addUsage(total, u, cost);
      addUsage(obj.isSidechain ? delegated : main_session, u, cost);

      if (!perSession[sessionId]) perSession[sessionId] = emptyBucket();
      addUsage(perSession[sessionId], u, cost);

      if (!perModel[model]) perModel[model] = emptyBucket();
      addUsage(perModel[model], u, cost);
    }
  }

  return {
    total,
    main_session,
    delegated,
    perSession,
    perModel,
    sessions: files.length,
    unpricedModels: [...unpriced],
  };
}

function main() {
  const args = parseArgs(process.argv);
  const dir = args.dir || defaultTranscriptDir();

  if (!fs.existsSync(dir)) {
    process.stderr.write(`Transcript directory not found: ${dir}\n`);
    process.exit(1);
  }

  let sinceTs = null;
  let untilTs = args.until ? Date.parse(args.until) : null;
  let windowLabel = null;
  if (args.windowHours != null) {
    sinceTs = Date.now() - args.windowHours * 3600 * 1000;
    windowLabel = `last ${args.windowHours}h (rolling window)`;
  } else if (args.since || args.until) {
    sinceTs = args.since ? Date.parse(args.since) : null;
    windowLabel =
      (args.since ? `since ${args.since}` : 'from start') +
      (args.until ? ` until ${args.until}` : '');
  }

  const scan = scanUsage(dir, sinceTs, untilTs);
  const { total, main_session, delegated, perSession, perModel } = scan;

  const report = {
    directory: dir,
    since: args.since || null,
    until: args.until || null,
    window_hours: args.windowHours || null,
    window: windowLabel,
    sessions: scan.sessions,
    total,
    main_session,
    delegated,
    per_model: perModel,
    per_session: perSession,
    unpriced_models: scan.unpricedModels,
  };

  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  }

  const fmt = (n) => n.toLocaleString('en-US');
  const usd = (n) => '$' + n.toFixed(2);
  const line = (label, b) =>
    `${label.padEnd(16)} ${usd(b.cost).padStart(10)}  ` +
    `in ${fmt(b.input_tokens)}, out ${fmt(b.output_tokens)}, ` +
    `cache w ${fmt(b.cache_creation_input_tokens)} / r ${fmt(b.cache_read_input_tokens)} ` +
    `(${b.messages} msgs)`;

  console.log(`Token report for ${dir}`);
  if (windowLabel) console.log(`Window: ${windowLabel}`);
  console.log('='.repeat(72));
  if (scan.unpricedModels.length) {
    console.log(
      `WARNING: no pricing entry for ${scan.unpricedModels.join(', ')} - ` +
        `their tokens are counted but cost $0, so every total below is understated. ` +
        `Add them to PRICING before trusting this report.`
    );
    console.log('');
  }
  console.log(line('TOTAL', total));
  console.log(line('  main session', main_session));
  console.log(line('  delegated', delegated));
  console.log('');
  console.log('By model:');
  for (const [m, b] of Object.entries(perModel).sort((a, b) => b[1].cost - a[1].cost)) {
    console.log(line('  ' + m, b));
  }
  console.log('');
  console.log('By session:');
  for (const [s, b] of Object.entries(perSession).sort((a, b) => b[1].cost - a[1].cost)) {
    console.log(line('  ' + s.slice(0, 8), b));
  }
}

module.exports = {
  PRICING,
  priceFor,
  costOf,
  emptyBucket,
  addUsage,
  defaultTranscriptDir,
  scanUsage,
};

if (require.main === module) main();
