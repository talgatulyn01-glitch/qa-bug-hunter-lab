# QA Bug Hunter Lab

A training web app for manual testing. You test **LiteShop**, a small web shop with
**22 planted defects**, run the course checklists against it, set **severity** with the
company criteria, and write **Jira-style bug reports** that are checked automatically
against the team's report standard.

## Modules

| # | Module | What it does |
|---|--------|--------------|
| 1 | Dashboard | Planted defects found, report quality, severity accuracy, charts, leaderboard |
| 2 | Test runs | Run Text Field / Button / Checkbox / Menu checklists against a component (Pass / Fail / Blocked / N/A) |
| 3 | Severity wizard | Table 2 criteria + project context + documented raise/lower rules → severity with an explanation |
| 4 | Report builder | Jira layout, live quality check of every rule of the standard, Jira-markup export |
| 5 | Tracker | List / board, Jira-like workflow with roles (Tester, Developer, Lead), comments, history |
| 6 | Knowledge base | Severity tables, report standard, checklists, test data, boundary-value generator, requirements |
| 7 | LiteShop sandbox | The application under test: menu, catalog, search, cart, checkout, sign up, profile, reviews |
| 8 | Prompt report | Submission part 1: initial vs improved prompt, features of a good prompt, AI mistakes |

## Business rules (enforced on the server)

- A report with any **error-level** violation of the standard cannot be submitted (HTTP 422).
- The tester sets **Severity**; only the **Lead** sets **Priority** (default "Major").
- Severity changes by **one level** and only with a documented reason; "to attract the PM's attention" is rejected.
- Workflow: Open → In Progress → Resolved (resolution required) → Closed; Reopen needs a comment;
  "Won't Fix" is Lead-only; Duplicate must link an existing non-duplicate bug; a Tester must confirm re-testing before closing a fixed bug.
- A test run cannot be completed while a check is "Not run" or a failed check has no linked bug;
  Blocked must name the blocking defect, N/A needs a reason; completed runs are locked.
- Each report is matched to a planted defect; its severity is graded (exact / acceptable / off). Repeat finds are flagged as possible duplicates.

## Tech

- Node.js + Express, deployed as one Vercel serverless function (`api/index.js`).
- Postgres on **Neon** via `DATABASE_URL`; without it the app falls back to an in-memory Postgres (PGlite) demo.
- Plain HTML/CSS/JS front end in `public/` (no build step). Business logic in `public/shared/` runs in the
  browser for live feedback **and** on the server for enforcement.
- The XSS and SQL-injection defects are **simulated**: nothing a tester types is executed.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000 (in-memory database)
npm test             # 19 unit + API tests
```

With a real database: `DATABASE_URL="postgres://…" npm run dev`. Tables and demo data are created automatically.

## Deploy (Vercel + Neon)

1. **Neon**: create a free project at https://neon.tech and copy the connection string (`postgresql://…?sslmode=require`).
2. **Vercel**: *Add New → Project → Import* this GitHub repository. Framework preset: **Other**. No build command needed.
3. In *Settings → Environment Variables* add `DATABASE_URL` = the Neon connection string (all environments), then **Redeploy**.
4. Open the site: the footer should say "Data: Postgres (persistent)".

## Project structure

```
api/index.js              Vercel function entry
server/app.js             API routes
server/services.js        Bugs, workflow, test runs, statistics
server/shop.js            LiteShop back end (with planted defects)
server/domain/planted.js  The 22 planted defects (answers, server-only)
server/domain/matcher.js  Report → planted defect matching, severity grading
public/shared/            Linter, severity engine, workflow, catalog, requirements
public/js/views/          Lab modules
public/sandbox/           LiteShop front end (with planted defects)
tests/                    node:test suites
```
