#!/usr/bin/env node
// End-of-cycle project cost report: what a project cost, and what we paid for.
//
// Combines two sources:
//   1. Main-session usage (coordination + Product Owner intake), scraped exactly
//      from the durable transcripts over the project's cycle window.
//   2. Delegated sub-agent usage (architect, developer, tester, security, etc.)
//      from docs/finance/delegated-usage.jsonl, which the Producer appends to as
//      each agent finishes (see log-delegation.js).
//
// Main-session cost is exact (full token split available). Delegated cost is an
// estimate: only total tokens are captured per agent, so it is priced with a
// blended per-model rate. Token counts per role are exact either way, which is
// the point of "what were we paying for". On Claude Pro the dollar figure is
// itself a proxy for how much of the plan a project consumed, not a bill.
//
// Usage:
//   node scripts/project-cost.js --project <slug> [--since <ts>] [--until <ts>]
//   node scripts/project-cost.js --project <slug> --json
//
// --since/--until bound the cycle for the main-session scrape and for filtering
// delegated records by timestamp. Omit them to count all usage for the project.

const fs = require('fs');
const path = require('path');
const { scanUsage, defaultTranscriptDir } = require('./token-report.js');

// Blended estimated cost per million tokens for delegated agents, where only a
// total token count is known. Roughly half the model's input rate: cache reads
// (cheap, and the bulk of tokens) pull the average down, output pulls it up.
// Tune if delegated estimates drift from what /usage shows.
const BLENDED_PER_MTOK = {
  'claude-opus-5-5': 2.0,
  'claude-opus-5': 2.5,
  'claude-sonnet-5': 1.0,
  'claude-opus-4-5': 2.5,
  'claude-opus-4-6': 2.5,
  'claude-opus-4-7': 2.5,
  'claude-opus-4-8': 2.5,
  'claude-opus-4': 8.0, // Opus 4.0 and 4.1, billed at 15/75
  'claude-sonnet': 1.6,
  'claude-haiku': 0.5,
  'claude-fable': 5.0,
  // Short names logged via --model opus|sonnet|haiku mean the current generation.
  'opus': 2.0,
  'sonnet': 1.0,
  'haiku': 0.5,
};

function blendedRate(model) {
  const keys = Object.keys(BLENDED_PER_MTOK).sort((a, b) => b.length - a.length);
  for (const k of keys) if (model && model.includes(k)) return BLENDED_PER_MTOK[k];
  return BLENDED_PER_MTOK['claude-opus-5-5'];
}

const DELEGATED_LOG = path.join(__dirname, '..', 'docs', 'finance', 'delegated-usage.jsonl');

function parseArgs(argv) {
  const args = { project: null, since: null, until: null, json: false, dir: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--project') args.project = argv[++i];
    else if (a === '--since') args.since = argv[++i];
    else if (a === '--until') args.until = argv[++i];
    else if (a === '--dir') args.dir = argv[++i];
    else {
      process.stderr.write(`Unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  if (!args.project) {
    process.stderr.write(`--project <slug> is required\n`);
    process.exit(2);
  }
  return args;
}

function readDelegated(project, sinceTs, untilTs) {
  if (!fs.existsSync(DELEGATED_LOG)) return [];
  const out = [];
  for (const line of fs.readFileSync(DELEGATED_LOG, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      continue; // skip malformed lines
    }
    if (r.project !== project) continue;
    if (r.ts) {
      const ts = Date.parse(r.ts);
      if (sinceTs && ts < sinceTs) continue;
      if (untilTs && ts > untilTs) continue;
    }
    out.push(r);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  const dir = args.dir || defaultTranscriptDir();
  if (!fs.existsSync(dir)) {
    process.stderr.write(`Transcript directory not found: ${dir}\n`);
    process.exit(1);
  }
  const sinceTs = args.since ? Date.parse(args.since) : null;
  const untilTs = args.until ? Date.parse(args.until) : null;

  // Main session (exact).
  const scan = scanUsage(dir, sinceTs, untilTs);
  const mainCost = scan.main_session.cost;
  const mainTokens =
    scan.main_session.input_tokens +
    scan.main_session.output_tokens +
    scan.main_session.cache_creation_input_tokens +
    scan.main_session.cache_read_input_tokens;

  // Delegated (exact tokens, estimated cost) grouped by role.
  const delegated = readDelegated(args.project, sinceTs, untilTs);
  const byRole = {};
  for (const r of delegated) {
    if (!byRole[r.role]) byRole[r.role] = { role: r.role, tokens: 0, cost: 0, runs: 0 };
    byRole[r.role].tokens += r.tokens;
    byRole[r.role].cost += (r.tokens * blendedRate(r.model)) / 1_000_000;
    byRole[r.role].runs += 1;
  }
  const roles = Object.values(byRole).sort((a, b) => b.cost - a.cost);
  const delegatedCost = roles.reduce((s, r) => s + r.cost, 0);
  const delegatedTokens = roles.reduce((s, r) => s + r.tokens, 0);

  const report = {
    project: args.project,
    since: args.since || null,
    until: args.until || null,
    coordination_and_intake: { exact: true, cost: mainCost, tokens: mainTokens },
    delegated: { estimated: true, cost: delegatedCost, tokens: delegatedTokens, by_role: roles },
    total: {
      cost: mainCost + delegatedCost,
      tokens: mainTokens + delegatedTokens,
      note: 'main-session cost exact; delegated cost estimated from total tokens',
    },
  };

  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  }

  const fmt = (n) => n.toLocaleString('en-US');
  const usd = (n) => '$' + n.toFixed(2);
  console.log(`Project cost: ${args.project}`);
  if (args.since || args.until) {
    console.log(`Cycle: ${args.since || 'start'} to ${args.until || 'now'}`);
  }
  console.log('='.repeat(64));
  console.log(`Coordination + intake (main session, exact):`);
  console.log(`  ${usd(mainCost).padStart(10)}   ${fmt(mainTokens)} tokens`);
  console.log('');
  console.log(`Delegated work (estimated cost, exact tokens):`);
  if (!roles.length) {
    console.log('  (none logged - see docs/finance/delegated-usage.jsonl)');
  } else {
    for (const r of roles) {
      console.log(
        `  ${r.role.padEnd(18)} ~${usd(r.cost).padStart(9)}   ${fmt(r.tokens)} tokens  (${r.runs} run${r.runs === 1 ? '' : 's'})`
      );
    }
    console.log(`  ${'subtotal'.padEnd(18)} ~${usd(delegatedCost).padStart(9)}   ${fmt(delegatedTokens)} tokens`);
  }
  console.log('');
  console.log('-'.repeat(64));
  console.log(`TOTAL  ~${usd(mainCost + delegatedCost)}   ${fmt(mainTokens + delegatedTokens)} tokens`);
  console.log(`(main-session cost exact; delegated cost estimated from total tokens)`);
}

main();
