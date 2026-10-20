# Budget and spend limits

Source of truth for **how much the company may consume before it pauses**. The
Finance agent reads it, measures actual usage from the transcripts with
`scripts/token-report.js`, and decides whether production continues or pauses.

The founder edits the numbers here. Set a limit to `none` to disable it.

> **Both governors ship unarmed (`none`).** Calibrate them before relying on
> Finance to stop anything - see "About the window budget" below. An
> uncalibrated guess is worse than no limit: in one deployment a guessed
> window budget produced a false STOP at "241% used" while real usage was 9%,
> which just teaches everyone to ignore Finance. Until you arm them, Finance
> still measures and reports; it simply issues no STOP.

## Plan and governance model

- **Plan:** `<your Claude plan: Pro / Max / Team / API>`.
- **Two governors, both enforced.** Finance measures both and the effective
  verdict is the **more restrictive** of the two (if either says STOP, the
  answer is STOP):
  1. **The rolling 5-hour usage window** (primary). Claude Code enforces a hard
     limit per window server-side; when you hit it, work stops until the window
     rolls over. The company governs itself to pause before that hard limit, so
     we stop on our own terms with headroom.
  2. **The monthly org spend cap** (secondary). This is a separate ceiling from
     the 5-hour window - a slow-filling monthly bucket rather than a fast
     rolling one - so a run can be fine on the window yet close to the monthly
     cap. It is real: an org-level monthly limit has hard-killed a delegated
     agent mid-run ("you've hit your org's monthly spend limit"), with no
     completion notification and therefore no token record (the Producer then
     logs it as a marked ESTIMATE). Finance watches both.

## The limits

### 5-hour window (primary)

| Setting          | Value | Meaning                                                       |
|------------------|-------|---------------------------------------------------------------|
| Window length    | 5h    | The rolling window Finance measures (`--window-hours 5`).     |
| Window budget    | none  | Estimated-cost proxy for a full 5-hour window. `none` = advisory. Arm it with one calibration reading (below). |
| Pause threshold  | 80%   | At or above this % of the window budget, Finance issues STOP. |
| Warn threshold   | 60%   | At or above this %, Finance issues a WARNING. Work continues. |

### Monthly org cap (secondary)

| Setting          | Value | Meaning                                                              |
|------------------|-------|----------------------------------------------------------------------|
| Month window     | calendar month | Month-to-date, measured with `--since <first of month>`.    |
| Monthly budget   | none  | Estimated-cost proxy for the monthly org cap. `none` = advisory.     |
| Pause threshold  | 80%   | At or above this % of the monthly budget, Finance issues STOP.       |
| Warn threshold   | 60%   | At or above this %, Finance issues a WARNING. Work continues.        |

## Policy when a threshold is hit

- **At the warn threshold (60%):** Finance reports a WARNING with the numbers and
  a rough projection of when 80% will arrive at the current rate. Work continues.
- **At the pause threshold (80%):** Finance issues a **STOP**. The Producer does
  not dispatch new delegated work. In-flight agent work finishes; nothing new is
  started. This is deliberately below 100% so we never get cut off mid-task by
  the plan's hard limit.
- **Restored** means the 5-hour window has rolled over enough that usage drops
  back below the warn threshold (older messages age out of the rolling window),
  or the founder raises the window budget here.

## About the window budget (and why it needs calibrating)

The real subscription quota is not published as a token count and is **not
readable programmatically** (verified against Claude Code, the Anthropic Admin
API, local state, and OTel): Claude Code shows it only through the interactive
`/usage` command, which hits no callable or documented endpoint; there is no
`claude usage --json`; the Admin API usage/cost reports cover only API/Console
billing, so OAuth subscription users do not appear there, and they report tokens
consumed rather than quota remaining. So the window budget can only ever be a
**calibrated proxy**, and Finance can only ever approximate.

**To arm it (one reading):** run `/usage` interactively, note the percentage of
the window it reports, and at that same moment run

```
node scripts/token-report.js --window-hours 5
```

Set the window budget to `measured_cost / (percent_used / 100)` - the implied
full window - and re-anchor whenever you can compare the two again.

- It is expressed in the same estimated-cost units the token report computes.
  Cost is used rather than raw tokens because it already weights the larger
  models roughly in proportion to how much faster they drain the real window.
- Erring low just makes the company pause a bit early (safe, mildly annoying).
  Erring high means the plan's own hard limit may hit before Finance pauses.

## About the monthly-cap number

Same problem: the org's real monthly cap is not readable from disk. Claude Code
surfaces it only through the interactive `/usage-credits` command, and the admin
console shows the credit ceiling.

**To arm it:** next time `/usage-credits` or the admin console shows a
monthly-usage percentage, run
`node scripts/token-report.js --since <first day of the current month>` and set
the monthly budget to `measured_cost / (percent_used / 100)`. Until it is armed,
Finance governs on the 5-hour window and reports month-to-date as an FYI so an
approaching monthly ceiling is at least visible.
