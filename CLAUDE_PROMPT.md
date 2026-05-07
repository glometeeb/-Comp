# CostTrack — Claude Handoff Prompt
# Paste everything below this line at the start of a new Claude chat

---

I need you to help me continue developing CostTrack, a construction cost management web app built for Ritsema Associates. Here is everything you need to know:

## Live App
- Frontend: https://comp-ten-iota.vercel.app
- Backend API: https://comp-2r24.vercel.app
- GitHub: https://github.com/glometeeb/-Comp

## Local Code Location
C:\Users\gibsonk\costtrack

## How to Deploy Changes
Any change pushed to GitHub main auto-deploys to Vercel:
```
cd C:\Users\gibsonk\costtrack
git add .
git commit -m "description"
git push
```

## Tech Stack
- Frontend: React 18 + Vite + Tailwind CSS + TanStack Query
- Backend: Node.js + Express
- Database: Supabase (Postgres) at https://ndruykimzfsncbuqxvgq.supabase.co
- Foundation Software: SQL Server at sql.foundationsoft.com,9000 (database: Cas_15082, user: Claude, password: Testing1020&)
- Hosting: Vercel (two separate projects — comp for frontend, comp-2r24 for backend)

## Project Structure
- backend/src/index.js — Express entry point
- backend/src/routes/jobs.js — job CRUD + live Foundation endpoint
- backend/src/routes/phases.js — phase rename
- backend/src/routes/lines.js — % complete override
- backend/src/routes/upload.js — Excel upload
- backend/src/routes/sync.js — Foundation sync trigger
- backend/src/services/foundationSync.js — Foundation SQL queries (v_job_history, job_chg_budgets)
- backend/src/services/calculations.js — % complete math and rollups
- frontend/src/pages/Dashboard.jsx — job cards
- frontend/src/pages/JobDetail.jsx — Summary tab + Foundation vs Budget tab
- frontend/src/pages/PhaseDetail.jsx — cost code lines with % complete editing
- frontend/src/lib/api.js — all API calls (uses VITE_API_URL env var)

## Key Business Rules
- Entered Cost = budget × (pct_complete_override / 100)
- Foundation actuals pulled LIVE from v_job_history on every request
- Change orders pulled LIVE from job_chg_budgets
- Labor cost classes: 1, 3, 5, 6, 7, 9
- Current Budget = Original Budget + Change Orders
- Cost Remaining (green) when under budget, Overage (red) when over
- User roles: EDITOR (full access) or VIEWER (read only)

## Supabase Tables
profiles, jobs, phases, cost_code_lines, sync_log, overrides_audit

## Local Dev
Terminal 1: cd C:\Users\gibsonk\costtrack\backend && node src/index.js
Terminal 2: cd C:\Users\gibsonk\costtrack\frontend && npm run dev
App runs at http://localhost:5173

Please read the full HANDOFF.md in C:\Users\gibsonk\costtrack for complete details before making any changes.
