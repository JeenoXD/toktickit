# Lab 1 — AI Use and Reflection

**LLM/agent used:** Claude 

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Help me with Issue 1 | Got a step-by-step plan, but ended up scrapping most of it once I realized we'd been given a starter scaffold zip I hadn't uploaded yet |
| 2 | Uploaded the scaffold zip and asked for help using it | Extracted it and merged it into my repo instead of continuing to hand-build client/server folders |
| 3 | Help Issue 2 | Implemented `/api/health` and wired the frontend to call it and show Online/Offline |
| 4 | Questioned whether some of the suggested code was actually Issue 4 scope, not Issue 2 | Turned out the scaffold's TODO comment had lumped health-status and category-list UI together under one "Issue 4" label, even though the labsheet splits them |
| 5 | Asked how to fix my branch history after realizing I'd started Issue 2 before Issue 1's PR was approved | Rebuilt `feature/2-health-check` on top of an updated `lab1-staging` instead of leaving it based on stale history |
| 6 | Help Issue 3 | Added the Category model, ran the migration, wrote an idempotent seed, and set up Postgres in Docker |
| 7 | Help Issue 4 | Implemented `/api/categories`, the frontend list rendering, and the Supertest/Vitest tests |

## Reflection

I wasted time early on because I started scaffolding the project by hand before realizing there was already a starter zip for this lab so I had to scrap it and redo things properly.

Later, Claude labeled some frontend code as "Issue 4" when it was actually Issue 2 work, just because that's how the scaffold's comments happened to be grouped. I pushed back and checked it against the real acceptance criteria instead of just trusting the label. Small thing, but it reminded me not to take AI output at face value.

I also started Issue 2's branch before my partner had approved Issue 1, which left my git history a mess and I had to rebuild the branch after the fact. Lesson learned: wait for the approval before moving on.