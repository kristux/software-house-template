# Decision log

Every answer the founder gives, appended chronologically. Binding on all future
work. The Product Owner reads this before every brief and never asks a
question already answered here. Recurring patterns get promoted to
`vision.md`.

This file grows without bound. Read only the slice you need (grep for the
project slug, or the company-wide entries) rather than pulling the whole file
into the main session's context.

Format: one level-2 heading per project (or per company-wide topic) that
contains the project slug as a whole word, followed by one bullet per decision.

```
## YYYY-MM-DD <slug>: <topic>
- <what was decided, and the context that made us ask>
- <the next answer, appended later>
```

Open the heading by hand once, at intake. After that, append with

    node scripts/log-decision.js --project <slug> --text "YYYY-MM-DD founder: ..."

which files the bullet at the end of that project's section, wherever the
section sits in the file. Appending to the file tail by hand misfiles rulings
when two sessions work on different projects at the same time.

---

<!-- Decisions start here. -->
