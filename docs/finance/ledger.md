# Spend ledger

Append-only log of Finance checks. Each entry is one run of the Finance agent:
what it measured, how it compared to `docs/finance/budget.md`, and the verdict
(OK / WARNING / STOP). Newest entries at the bottom.

The Finance agent writes here so spend history survives across sessions and
anyone can see where tokens have been going without re-parsing transcripts.

Format:

```
## YYYY-MM-DD HH:MM verdict (governor that drove it)
- 5h window: $X.XX / $budget (NN%)
- Month-to-date: $X.XX / $monthly-budget (NN%)   [or "$X.XX (FYI, monthly governor unarmed)"]
- Biggest spender: <main vs delegated / which model / which session> at $X.XX
- Note: <anything worth flagging - a spike, a runaway agent, a projection of
  when a pause threshold arrives, or a calibration mismatch vs /usage>
```

---

<!-- Entries start here. -->
