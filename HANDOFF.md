# CostTrack — Developer Handoff

## What This App Does
CostTrack is a construction cost management dashboard for Ritsema Associates. Project managers upload an Excel budget, manually enter % complete per cost code, and compare entered costs against live actuals pulled from Foundation Software (SQL Server).

## Live URLs
- **Frontend (the app):** https://comp-ten-iota.vercel.app
- **Backend API:** https://comp-2r24.vercel.app
- **GitHub Repo:** https://github.com/glometeeb/-Comp

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, TanStack Query |
| Backend | Node.js, Express |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (JWT) |
| Foundation sync | mssql (direct SQL Server connection) |
| Hosting | Vercel (both frontend and backend) |

## How Deployments Work
**Any push to the `main` branch on GitHub automatically redeploys both Vercel projects.**

To make a change go live:
1. Edit files locally in `C:\Users\gibsonk\costtrack`
2. Run in terminal:
```
cd C:\Users\gibsonk\costtrack
git add .
git commit -m "describe your change"
git push
```
3. Vercel picks it up automatically — takes about 60 seconds

## Project Structure
```
costtrack/
├── backend/                  # Express API server
│   ├── src/
│   │   ├── index.js          # Entry point, route mounting
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT auth middleware (requireAuth, requireEditor)
│   │   ├── routes/
│   │   │   ├── jobs.js       # GET/POST/DELETE jobs, foundation endpoint
│   │   │   ├── phases.js     # GET phases, PATCH rename
│   │   │   ├── lines.js      # PATCH/DELETE % complete override
│   │   │   ├── upload.js     # Excel upload + parse
│   │   │   ├── sync.js       # Foundation sync trigger
│   │   │   └── users.js      # User management
│   │   └── services/
│   │       ├── calculations.js    # % complete math, rollups
│   │       ├── foundationSync.js  # Foundation SQL Server queries
│   │       ├── excelParser.js     # Excel → database
│   │       └── supabase.js        # Supabase client
│   ├── vercel.json           # Tells Vercel how to run Express
│   └── .env.example          # Template for env variables
│
├── frontend/                 # React app
│   ├── src/
│   │   ├── App.jsx           # Routes
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx     # Job cards with budget/cost summary
│   │   │   ├── JobDetail.jsx     # Summary tab + Foundation vs Budget tab
│   │   │   ├── PhaseDetail.jsx   # Cost code lines, % complete editing
│   │   │   ├── Upload.jsx        # Excel upload form
│   │   │   ├── Login.jsx         # Auth page
│   │   │   ├── UserManagement.jsx
│   │   │   └── SyncLog.jsx
│   │   ├── lib/
│   │   │   ├── api.js        # All backend API calls
│   │   │   └── supabase.js   # Supabase client
│   │   ├── hooks/
│   │   │   └── useAuth.js    # Auth state, role check
│   │   └── components/
│   │       ├── Layout.jsx
│   │       ├── ProgressBar.jsx
│   │       └── ProtectedRoute.jsx
│   └── .env.example
│
└── supabase/
    └── schema.sql            # Full database schema
```

## Environment Variables

### Backend (set in Vercel → comp-2r24 project → Settings → Environment Variables)
| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | https://ndruykimzfsncbuqxvgq.supabase.co |
| `SUPABASE_SERVICE_ROLE_KEY` | (in Vercel dashboard) |
| `SUPABASE_ANON_KEY` | (in Vercel dashboard) |
| `FOUNDATION_SERVER` | sql.foundationsoft.com,9000 |
| `FOUNDATION_DATABASE` | Cas_15082 |
| `FOUNDATION_USER` | Claude |
| `FOUNDATION_PASSWORD` | Testing1020& |
| `JWT_SECRET` | costtrack-super-secret-2024 |
| `FRONTEND_URL` | https://comp-ten-iota.vercel.app |

### Frontend (set in Vercel → comp project → Settings → Environment Variables)
| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | https://ndruykimzfsncbuqxvgq.supabase.co |
| `VITE_SUPABASE_ANON_KEY` | (in Vercel dashboard) |
| `VITE_API_URL` | https://comp-2r24.vercel.app |

## Database (Supabase)
- **Project:** https://supabase.com → Ritsema Associates → CostTrack
- **Tables:** profiles, jobs, phases, cost_code_lines, sync_log, overrides_audit
- **Auth:** Supabase Auth — users created manually in Auth → Users
- **Roles:** EDITOR (can upload, edit, sync) or VIEWER (read only) — set in app under Users tab

## Key Business Logic

### % Complete / Entered Cost
- Each cost code line has a `pct_complete_override` (0–100)
- Entered Cost = budget × (pct / 100)
- Cost to Complete = budget × (1 − pct / 100)
- Never stored — always calculated on the fly

### Foundation vs. Budget Tab
- Queries Foundation SQL Server **live** every time the tab is opened
- Pulls actuals from `v_job_history` view, grouped by cost code
- Pulls change orders from `job_chg_budgets` table
- Labor = cost classes 1, 3, 5, 6, 7, 9
- Current Budget = Original Budget + Change Orders
- Cost Remaining (green) = under budget | Overage (red) = over budget

### Excel Upload Format
- Each tab in the Excel file = one phase
- Columns expected: cost code, description, type (LABOR/MATERIALS), budget amount

## Running Locally
```
# Terminal 1 — Backend
cd C:\Users\gibsonk\costtrack\backend
node src/index.js

# Terminal 2 — Frontend
cd C:\Users\gibsonk\costtrack\frontend
npm run dev
```
Frontend: http://localhost:5173
Backend: http://localhost:3001

The local backend reads from `backend/.env` — make sure that file exists with real credentials.

## Known Issues / Next Steps
- Foundation SQL Server connection uses a persistent pool which may time out on Vercel serverless — if Foundation tab stops working, a reconnect/retry should be added
- No email invite flow — users must be created manually in Supabase Auth
- Excel parser expects a specific column format — document the exact expected layout
