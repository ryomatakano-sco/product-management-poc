# Claude Achievement Deck — Companion (Internal, Detailed) — ENGLISH REFERENCE

> **Note for Nafis:** This English file mirrors the Japanese companion (`..._JP.md` / `.docx`) 1:1 so you can see exactly what the Japanese says. The Japanese file is the one to use/share internally; this is only your reference.

> **What this is:** An internal companion to the external Infocom deck "Introduction of Deliverables Built with Claude." It maps 1:1 to each slide and holds what's shown on the slide plus the deeper detail, real numbers, and talking points / likely Q&A.

> **Confidentiality:** In the deck the client is unnamed ("X社様" only if needed), the product is "PLX," and the dental-clinic domain, real table names and patient data are generalized. This internal doc goes deeper — apply the same generalization if any part is shared externally.

> **Time / results basis (important):** Each deliverable's "result (time)" shows that **each project was completed quickly because Claude was used** — it is a **per-project estimate**, NOT a sum of the 4 projects. The representative figure is "~7 days of work → ~2 days" (effort cut by half or more). These are the presenter's felt estimates, not precise measurements.

---

## Slide 1 — Title
**On the slide:** "Introduction of Deliverables Built with Claude," presenter Nafis Iqbal (AI Engineer / Software Engineer), SY System Co., Ltd., July 2026.
**Detail:** Created because Infocom's Business Management Dept. asked for help with Claude-based efficiency, and sales (Yamanaka-san) put my name forward. What's wanted is proof of **real deliverables built with Claude on a live project** — not just "I use Claude." I work on a contract project for X社様 developing the "PLX" product and have used Claude as a hands-on tool from the start.
**Talking point:** "I've used Claude hands-on from day one on a live project; today I'll walk through the deliverables, generalized for confidentiality."

## Slide 2 — Overview
**On the slide:** Consistent use of Claude on a live project to produce real deliverables. Four areas (data analysis / coding & PoC / QA & quality / documentation). Result: **effort cut by half or more** (e.g., ~7 days → ~2). Security: sensitive data redacted/anonymized before use.
**Detail:**
- The four areas are all deliverable-producing uses, not one-off chats.
- Results compare "normal expected effort" vs "actual effort with Claude" **per project** (e.g., ~7 days → ~2). Not a sum of 4 projects. **Each project was completed quickly because Claude was used.**
- Security: PoC stage gave freedom to use Claude directly, but personal/confidential data was redacted/anonymized first and risk-bearing info excluded even where broad access existed.
**Talking point:** "We could use it freely because it's a PoC — but sensitive data was always removed first. I lead with this because it's what external stakeholders care about most."

## Slide 3 — Timeline & Growing Use of Claude
**On the slide:** 2025.10 AI phone auto-testing → 2025.11–12 booking-recommendation API → 2026.01– AI chatbot (agent rebuild) → 2026.04– product recommendation / inventory. Message: not every capability existed at the start; I adopted Claude's new features one by one (chat → code gen → Claude Code → Design/Cowork).
**Detail:** Claude's capabilities and my mastery grew together — chat-based research/analysis first, then code generation, then Claude Code for larger dev & QA, then Claude Design (UI mockups) and Cowork/Artifacts (assets). This "adopted over time" point is honest and a strength — it shows fast adoption into real work.
**Talking point:** "I didn't have every feature on day one — as Claude shipped features, I adopted each and widened how I used it."

## Slide 4 — How I Used Claude
**On the slide:** Five areas — research / data analysis / coding / QA & security / documentation.
**Detail:**
- **Research:** fast, broad feasibility/technical investigation.
- **Data analysis:** redacted data → trends/outliers/correlations, analyst-style insights; I keep the final call.
- **Coding:** direct in-code use (secrets removed) for fast PoC iteration.
- **QA & security:** Claude Code traces data flow to catch vulnerabilities (SQL injection, auth, unsafe data handling) and loopholes; self-verifies to cut false positives.
- **Documentation:** chat / Cowork / Claude Code to draft JP & EN reports fast with consistent terminology; shifted to a review-based flow.
**Talking point:** "In QA, Claude Code flagged loopholes and security concerns I'd have missed — improving both review quality and speed."

## Slide 5 — Key Claude Features (1): Working Tools
**On the slide:** Chat / Projects & Memory / Artifacts / Claude Design / Cowork / Claude Code.
**Detail:**
- **Chat:** everyday conversation to research, summarize, draft.
- **Projects & Memory:** carries files, instructions and memory across chats.
- **Artifacts:** side window that live-previews generated output (apps, diagrams, docs).
- **Claude Design:** describe it → prototypes, slides, mockups; applies your design system (Opus-powered).
- **Cowork:** desktop agent working in local folders/connectors — plan → approve → execute, even scheduled.
- **Claude Code:** delegate coding — build, debug, security-review across the codebase.
**Talking point:** "I used these across real work, adopting each as Claude added it — not all at once."

## Slide 6 — Key Claude Features (2): Extensibility
**On the slide:** Skills / Connectors (MCP) / Plugins / Cowork scheduling / Agents & Dispatch.
**Detail:**
- **Skills:** a folder of instructions that teaches Claude how to do a task; loads when relevant.
- **Connectors (MCP):** secure two-way connections to apps/data — retrieve data and take actions.
- **Plugins:** installable bundles of skills, agents, connectors and commands, shared via marketplaces.
- **Cowork scheduling:** runs tasks on a set cadence (daily/weekly); automates digests and roll-ups.
- **Agents / Dispatch:** hand tasks to agents running in parallel in the background.
**Talking point:** "These turn one-off use into something repeatable and team-wide — key for rolling efficiency out across an organization."
> Slides 5–6 are the educational "what Claude can do" part; the deliverable slides show my concrete use.

---

## Slide 7 — Deliverable 1: Automated Testing for an AI Voice System
**On the slide:** An automated harness that tests an AI voice (phone-booking) system, plus test-case docs. Claude built the test cases and the call-control / AI-judge / reporting scripts and docs. Result: harness build ~5 days → ~2; test run automated; repeatable anytime.
**Detail:** A tester AI bot actually phones the "PLX" AI booking line and converses. Flow: spreadsheet (test cases) → workflow automation (webhook/orchestration) → FastAPI → telephony API (outbound call) → realtime voice API (AI-vs-AI voice) → after the call an LLM judge returns pass/fail + reason (Japanese) → results written back to the spreadsheet. Runs on cloud (EC2); test-case docs prepared. **Time note:** running tests still takes real call time (unchanged). What Claude sped up was **building the harness** (~5 days → ~2) and removing repeated manual testing. **This short build time was possible because Claude was used.**
**Talking points:** "Test run time is unchanged (real calls); the win is building the rig fast and running it automatically/repeatably — thanks to Claude." · Q "Why Claude for an OpenAI product?" → the product's runtime AI is OpenAI; Claude is my dev tool (design, code, docs).

## Slide 8 — Deliverable 2: Diagnosing & Fixing an AI Product-Lookup
**On the slide:** Diagnosed and improved an AI product-info auto-lookup (accuracy, speed, safety). Claude Code analyzed the codebase, found root causes, added a verification guard + cache, refined prompts. Result: wrong-product ~12% → ~1–3%; not-found latency ~2 min → 7–10 s; repeat lookups 0 AI calls; diagnose→fix ~4 days → ~1.5.
**Detail:** In "PLX"'s inventory system, AI auto-fetches product info from a JAN code. Three issues fixed with Claude Code:
1. **Wrong product (~12%)** — a signal verifying the input JAN matched the source page's JAN was only used in the debug path. Added a verification guard to the production path (per-candidate match check + exclude unverified) → wrong answers down to **~1–3%**; the rest safely fail as "not found."
2. **Non-deterministic / slow** — web search ran from scratch every time; same JAN gave varying results; not-found took ~2 min. A FIFO cache (capacity 256) + opt-in fallback → repeat lookups make **0 AI calls**, not-found latency **7–10 s**.
3. **Verbatim description copy (copyright risk)** — prompt edits to rewrite descriptions in own words, minimizing verbatim overlap.
Diagnose→fix went from ~4 days to ~1.5 via Claude Code's code reading. **This speed-up is thanks to Claude Code.** Numbers are measured (internal improvement report).
**Talking point:** "This is the numbers example: Claude Code found that a verification signal existed but wasn't used in production, and drove the fix quickly."

## Slide 9 — Deliverable 3: Data Analysis & Bilingual Reporting
**On the slide:** Trend analysis of large-scale booking data (~500k records) + reports/PoC decks in JP and EN. After cleaning, Claude did pattern analysis, insight extraction, charts, and end-to-end JP/EN writing. Result: analysis→JP/EN report ~2 weeks → ~4 days; message generation ~¥1 each; replaces minutes of manual work.
**Detail:**
- Case 1: booking-recommendation study PoC. ~500k booking records analyzed (test/internal/QA data removed; free-text treatment names normalized ~85–90%). Visualized timing patterns (weekday 10–11 & 15–17, Saturday mornings busiest) and treatment transitions; proposed time prediction (individual sequence) + treatment prediction (hybrid collaborative filtering + sequence); produced JP/EN PoC deck.
- Case 2: merchandise-recommendation report (JP/EN, summary + detailed). Assists product selection per patient and auto-writes a LINE message. **~¥1 per generation**, replacing minutes of manual work; patient/clinic names never sent to the AI.
Analysis→bilingual report compressed from ~2 weeks to ~4 days (estimate); data redacted. **The speed-up is thanks to Claude.**
**Talking point:** "Doing analysis AND JP/EN write-up in one Claude flow was the win — no back-and-forth between translating and writing."

## Slide 10 — Deliverable 4: Internal Claude Study Session (Bonus)
**On the slide:** A full internal study session on using Claude (slide deck, animated diagram, Japanese-dubbed video). Built with Cowork / Design / Artifacts (voice dubbing via ElevenLabs). Result: asset set ~several days → ~1 day; helped team adoption.
**Detail:** For a line-meeting, built a 12-slide JP/EN deck touring Claude's key features, an animated HTML flow diagram, and a Japanese-dubbed presentation video. Self-initiated — shows Claude skill plus the ability to roll it out and teach it, matching Infocom's goal of driving efficiency. **The short build time was possible because Claude (Cowork/Design/Artifacts) was used.** Note: video voice dubbing used ElevenLabs, not Claude — say so honestly if asked.
**Talking point:** "Beyond using it, I actively spread it in the team — matching your need for someone who can drive efficiency adoption."

## Slide 11 — Summary
**On the slide:** Consistent use of Claude on a live project to produce real deliverables across tooling, QA, analysis and documentation, with confidentiality protected. Value: deliverable-based track record / secure use / practical support for your goals. Result: per project ~7 days → ~2 (effort cut by half or more).
**Detail:** Through-line: not "I can use Claude" but "I've produced real deliverables with Claude, safely." The four deliverables are the evidence; Deliverable 2 carries measured numbers. Time results are per-project estimates and each project finished fast thanks to Claude (not a sum of 4). Offer to Infocom: practical support from building deliverables through team enablement.
**Talking point:** "Three takeaways: a deliverable-based track record, safe usage, and practical support for your efficiency goals."

---

## Appendix A: Where the numbers come from
| Metric | Value | Source |
|---|---|---|
| Wrong-product answers | ~12% → ~1–3% | Measured (improvement report) |
| Not-found latency | ~2 min → 7–10 s | Measured |
| Repeat-lookup AI calls | Zero (cache) | Measured |
| Message generation cost | ~¥1 each | PoC report |
| Data size | ~500k records | PoC deck |
| Treatment-name normalization | ~85–90% | PoC deck |
| Test harness build | ~5 days → ~2 | Personal estimate |
| Analysis → JP/EN report | ~2 weeks → ~4 days | Personal estimate |
| Study-session asset set | several days → ~1 day | Personal estimate |
| Per-project guideline | ~7 days → ~2 | Personal estimate |

> "Personal estimate" figures are felt approximations, not precise measurements. All are **per project**, not sums of multiple projects.

## Appendix B: About the presenter
- Nafis Iqbal — AI Engineer / Software Engineer, SY System Co., Ltd.
- Background: CS degree; diverse freelance experience (game QA, app dev); data analysis & cybersecurity knowledge; strong AI/ML interest — built face-recognition and SNS sentiment-analysis models, and a Python auto-test tool at a PHP worksite; now leads generative-AI/LLM PoCs (chatbot, booking recommendation, AI voice-response auto-testing).
- Key skills: generative AI / LLM / RAG / AI-agent dev, Python, QA automation (Selenium/JMeter/Postman), AWS/Docker/n8n/Twilio/MySQL, data analysis.
- Certifications: CEH, Google Data Analytics, SQA & Cybersecurity, Atlassian Jira Agile, Linux Tools for Developers, IELTS.
- Languages: Bengali (native), English (excellent), Japanese (basic, learning).
