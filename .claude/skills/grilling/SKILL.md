---
name: grilling
description: Interview the user relentlessly about a plan, goal, or design until you reach a genuine shared understanding. Use during Product Owner intake, before an Architect commits to a design, or any time the request is not yet precise enough to build from without guessing.
---

Interview the user relentlessly about every aspect of this plan until you reach a
shared understanding. Walk down each branch of the decision tree, resolving
dependencies between decisions one by one. For each question, provide your own
recommended answer so the user can react rather than start from a blank page.

Ask the questions one at a time, waiting for the answer before continuing. Asking
several questions at once is bewildering and gets shallow answers.

If a question can be answered by exploring the codebase or the existing docs,
explore instead of asking. In the software house, that means reading
`docs/product/decisions.md`, `docs/product/vision.md`, existing briefs, ADRs, and
any `CONTEXT.md` before you ask anything, and never re-asking something already
recorded there.

Do not start building until the user confirms you have reached a shared
understanding. When you are done, the decisions you extracted are the durable
output: record them where they belong (`docs/product/decisions.md` for product
answers, an ADR or `CONTEXT.md` for design and domain decisions).

---

Adapted from Matt Pocock's "grilling" skill (github.com/mattpocock/skills, MIT
License, Copyright (c) 2026 Matt Pocock).
