# jan-lookup-poc — Research Sandbox

> **Heads up**: this is a **research sandbox**, not part of the production app. The productionized version of this logic lives in `../backend/app/services/ai_agent.py` and is exposed via the backend's `/ai-suggestions` endpoint. Keep this PoC around as a place to iterate on prompts, models, and the two-agent pattern outside the constraints of a live API.

---

## What this is

A standalone Python CLI that probes whether OpenAI Agents (with `WebSearchTool`) can reliably extract structured product data from a JAN code or product name. It uses a **two-agent pattern** — one agent searches the web in free-form Japanese text, a second agent parses that text into a structured `ProductLookupResult` — to sidestep a known JSON-truncation bug when combining `WebSearchTool` with `output_type` on large Pydantic models.

## Run

```bash
cd jan-lookup-poc
cp .env.example .env       # set OPENAI_API_KEY
pip install -e .
jan-lookup                  # reads inputs/, writes to outputs/
```

## When to use this vs the backend

| Goal | Use |
|---|---|
| Try a new prompt or model on a batch of JAN codes | this CLI |
| Demo product creation flow to an end user | the backend's `/ai-suggestions` endpoint |
| Generate a markdown report on extraction quality | this CLI's `reporter.py` |
| Persist a successful extraction against a product | the backend (extracts → field options → user picks → product create) |

If you change a prompt here, port the change to `backend/app/services/ai_agent.py` so the production endpoint stays in sync. (A future cleanup is to extract the prompts into a shared module.)
