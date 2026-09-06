# Lab 2 — AI Use and Reflection

**LLM/agent used:** Claude (Anthropic), used through the chat interface to draft the engineering
contract (specification.md, tests.md, ui-spec.md, api-spec.md) before implementation, then to
generate code for each Issue, which I applied and tested manually in VS Code.

## Selected Key Prompts (6–10)

| Prompt Name | Actual Prompt Text |
|---|---|
| Draft the specification | Draft specification.md covering all required sections from the labsheet.<br>**My Reflection:** Good starting skeleton, but I had to read through it myself and adjust some of the business rule numbers and length limits to match what I actually wanted, not just accept it wholesale. |
| Draft the test plan | Build tests.md with a planned-test table tracing every AC to at least one test.<br>**My Reflection:** Useful for seeing the full scope up front, but a few test file paths didn't match my actual folder structure once I started building, so I had to circle back and correct them later. |
| Start Issue 2 (Development Requester context) | Implement the RequesterUser model, seed, active-requester API, and selection screen.<br>**My Reflection:** Ran into a real Prisma error (missing back-relation) that Claude helped me fix, and I caught that the whole app was being gated behind Requester selection when it should only gate ticket screens, had to push back and get that corrected. |
| Start Issue 3 (Ticket creation) | Implement ticket creation end to end: model, API, validation, UI, attachment picker.<br>**My Reflection:** This surfaced a real race condition, two ticket creations could get the same generated Ticket Number under concurrent test runs. Claude helped me add retry-on-collision logic, which was a genuine bug fix, not just a test workaround. |
| Debug failing tests with unclear errors | Asked Claude to add console.error logging to catch blocks so I could see what was actually failing instead of guessing at generic 500 errors.<br>**My Reflection:** This was the single most useful debugging technique in the whole lab, several "mystery" failures turned out to be simple things (I forgot to run Postgres) once the real error was visible. |
| Start Issue 6 (Playwright E2E and responsive tests) | Set up Playwright config and write E2E scenarios for ticket creation, cross-Requester access, and attachment lifecycle.<br>**My Reflection:** Had a flaky test that only failed on some viewports, turned out to be a missing `await` before a screenshot, not a real bug. Good lesson in not assuming a re-run success means a race condition is actually fixed. |
| Diagnose Playwright tests stuck waiting for "Continue" | Asked Claude to help debug why E2E tests kept timing out waiting for a button that should have been visible.<br>**My Reflection:** Turned out to have nothing to do with my code, the backend/frontend dev servers just weren't running during the test run. Taking a screenshot at the failure point to see what the browser actually showed was the key step; it wasn't a logic bug at all. |

## My Reflection

The AI-generated first drafts of my spec documents and code were a good starting point but never
fully correct on the first pass, the most valuable moments were when I actually questioned
something (the app-wide Requester gating, the stale API contract note, the branding mismatch)
instead of accepting the output as finished. Debugging was where I learned the most: adding real
error logging instead of trusting a generic 500 message turned multiple "unexplainable" failures
into quick, obvious fixes. The retry-on-collision fix for Ticket Number generation was the closest
thing to a genuine engineering bug I found and fixed during this lab, not just a scaffolding task.