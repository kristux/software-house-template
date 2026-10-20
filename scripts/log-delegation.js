#!/usr/bin/env node
// Append one durable record of a finished sub-agent's token usage.
//
// Why this exists: a sub-agent's own transcript is written to a temp file that
// Claude Code wipes shortly after the agent finishes, and nothing about its
// usage is persisted in the durable project logs. The only reliable moment to
// capture delegated cost is when the agent returns, from the completion
// notification the main session receives (which reports the agent's total
// tokens). The Producer runs this then, so end-of-cycle cost reports can
// attribute spend to each role.
//
// The token count is exact (straight from the notification). Cost is an
// estimate: the notification gives only a total, not the input/output/cache
// split, so project-cost.js prices it with a blended rate. Pass --model so the
// right blended rate is used.
//
// Usage:
//   node scripts/log-delegation.js --project <slug> --role <agent> --tokens N \
//        [--model claude-opus-5-5] [--agent-id ID] [--note "text"] \
//        [--task <id>] [--tier junior|developer|senior|principal] \
//        [--attempt <n>] [--outcome pass|fail|deferred|blocked] \
//        [--escalated-from junior|developer|senior]
//
// The --task/--tier/--attempt/--outcome/--escalated-from fields feed the
// tier-ratio learning loop (see the Chief of Staff retro). On a developer-family
// run, record which backlog task it was, the tier that ran it, which attempt at
// that tier this run was (1 = first try, 2 = the same-tier retry after a FAIL),
// the Tester verdict on its deliverable (pass/fail), and - when the task was
// bumped up after a lower tier failed twice - which tier it came from. The retro
// reads these to compute per-tier first-try pass, retry-recovery, and escalation
// rates, and recommends whether to shift the Architect's default assignment tier.
// Use outcome blocked when the run was stopped by an environment problem (build
// tree, server, credentials) rather than a defect in the work; the retro excludes
// blocked runs from the tier rates so they do not count as tier failures.
// Omit them for non-developer roles.
//
// Escalation policy (retry-then-escalate): a Tester FAIL sends the task back to
// the SAME tier once (attempt 2). If that also fails, it escalates one tier up
// (junior -> developer -> senior -> principal); principal is terminal and just
// retries again.
//
// Example (developer lands a task on the first attempt):
//   node scripts/log-delegation.js --project todo-cli --role developer \
//        --tokens 25917 --model claude-sonnet-5 --task S3 --tier developer \
//        --attempt 1 --outcome pass --note "task 3: storage layer"
//
// Example (junior failed twice, so the task escalated to developer and passed):
//   node scripts/log-delegation.js --project todo-cli --role developer \
//        --tokens 41200 --model claude-sonnet-5 --task S2 --tier developer \
//        --attempt 1 --escalated-from junior --outcome pass \
//        --note "S2 rescued after junior FAILed both attempts"

const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, '..', 'docs', 'finance', 'delegated-usage.jsonl');

// Canonical model ids per tier. Adjust to the models your plan actually has.
const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5';
const HAIKU = 'claude-haiku-4-5-20251001';

// tier -> model (the developer-family tiers)
const TIER_MODEL = { junior: HAIKU, developer: SONNET, senior: OPUS, principal: OPUS };

// role -> model, so cost is priced at the tier the agent actually ran on rather
// than defaulting everything to Opus. Keep in sync with the agent frontmatter.
const ROLE_MODEL = {
  'junior-developer': HAIKU,
  developer: SONNET,
  'senior-developer': OPUS,
  'principal-developer': OPUS,
  'brief-adversary': OPUS,
  'product-owner': OPUS,
  architect: OPUS,
  tester: OPUS,
  'code-reviewer': OPUS,
  'security-advisor': OPUS,
  'chief-of-staff': OPUS,
  producer: SONNET,
  finance: HAIKU,
  // Add your own project-specific agents here, keyed by agent name.
};

// Resolve the model for pricing. Precedence: explicit --model wins; else derive
// from --tier (developer-family runs); else from --role. If the role is unknown
// and no model/tier was given, fall back to Opus but warn, since that overprices
// cheaper work and blinds the tier-cost analysis (the bug this replaced).
function resolveModel(args) {
  if (args.model) return args.model;
  if (args.tier && TIER_MODEL[args.tier]) return TIER_MODEL[args.tier];
  if (args.role && ROLE_MODEL[args.role]) return ROLE_MODEL[args.role];
  process.stderr.write(
    `warning: no --model, and could not derive one from --tier/--role ` +
      `(role=${args.role || 'none'}); defaulting to ${OPUS}. Pass --model to be exact.\n`
  );
  return OPUS;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
    else {
      process.stderr.write(`Unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const missing = ['project', 'role', 'tokens'].filter((k) => !args[k]);
  if (missing.length) {
    process.stderr.write(`Missing required argument(s): ${missing.map((m) => '--' + m).join(', ')}\n`);
    process.exit(2);
  }
  const tokens = parseInt(args.tokens, 10);
  if (!Number.isFinite(tokens) || tokens < 0) {
    process.stderr.write(`--tokens must be a non-negative integer\n`);
    process.exit(2);
  }

  const TIERS = ['junior', 'developer', 'senior', 'principal'];
  if (args.tier && !TIERS.includes(args.tier)) {
    process.stderr.write(`--tier must be one of: ${TIERS.join(', ')}\n`);
    process.exit(2);
  }
  const OUTCOMES = ['pass', 'fail', 'deferred', 'blocked'];
  if (args.outcome && !OUTCOMES.includes(args.outcome)) {
    process.stderr.write(`--outcome must be one of: ${OUTCOMES.join(', ')}\n`);
    process.exit(2);
  }
  // Attempt at this tier: 1 = first try, 2 = the same-tier retry. Principal is
  // terminal (no tier above), so it can retry beyond 2; hence any positive int.
  let attempt = null;
  if (args.attempt !== undefined) {
    attempt = parseInt(args.attempt, 10);
    if (!Number.isInteger(attempt) || attempt < 1) {
      process.stderr.write(`--attempt must be a positive integer\n`);
      process.exit(2);
    }
  }
  // Escalation is always up the ladder, so a task can only arrive from a tier
  // below the top one (junior, developer or senior).
  const ESCALATED_FROM = ['junior', 'developer', 'senior'];
  if (args['escalated-from'] && !ESCALATED_FROM.includes(args['escalated-from'])) {
    process.stderr.write(`--escalated-from must be one of: ${ESCALATED_FROM.join(', ')}\n`);
    process.exit(2);
  }

  const record = {
    ts: new Date().toISOString(),
    project: args.project,
    role: args.role,
    tokens,
    model: resolveModel(args),
    agent_id: args['agent-id'] || null,
    note: args.note || null,
    task: args.task || null,
    tier: args.tier || null,
    attempt,
    outcome: args.outcome || null,
    escalated_from: args['escalated-from'] || null,
  };

  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, JSON.stringify(record) + '\n');
  process.stdout.write(`Logged ${tokens} tokens for ${record.role} on project ${record.project}\n`);
}

main();
