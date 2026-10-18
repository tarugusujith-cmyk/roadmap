# ProductPulse

Customer feedback & product roadmap SaaS built with **React, TypeScript, Vite, Tailwind CSS, React Router, Axios, JSON Server and Recharts**. No external APIs are used; all data is loaded and saved through Axios against JSON Server.

## Quick start

```bash
npm install
npm run dev        # starts JSON Server on :3001 and Vite on :5173
```

Open http://localhost:5173 and sign in with a demo account.

| Script | What it does |
| --- | --- |
| `npm run dev` | API (JSON Server, port 3001) and web app (Vite, port 5173) together |
| `npm run api` | JSON Server only (`server.js`, reads/writes `db.json`) |
| `npm run web` | Vite only |
| `npm run seed` | Regenerates `db.json` with the demo records (resets all data) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build into `dist/` |

The API URL defaults to `http://localhost:3001`. Override it with `VITE_API_URL` (see `.env.example`).

## Demo accounts (password `demo123` for all)

Roles are **per workspace**.

| Account | Northwind CRM (Pro) | Lumen Notes (Free, near its limits) | Harbor Analytics (Free, private roadmap) |
| --- | --- | --- | --- |
| owner@demo.com (Aarav) | Owner | Owner | Owner |
| admin@demo.com (Neha) | Admin | Admin | none |
| pm@demo.com (Rohan) | Product Manager | Product Manager | none |
| customer@demo.com (Sara) | Customer | Customer | Customer |

Public roadmaps (no login): `/public/1/roadmap` and `/public/2/roadmap`. Harbor Analytics (`/public/3/roadmap`) shows the "private" state.

## Roles

| Capability | Owner | Admin | Product Manager | Customer |
| --- | :-: | :-: | :-: | :-: |
| Submit feedback, vote, comment, view roadmap and published release notes | yes | yes | yes | yes |
| Edit/delete own feedback | yes | yes | yes | yes |
| Edit/delete any feedback, change status & priority, link duplicates | yes | yes | yes | |
| Move roadmap items between stages | yes | yes | yes | |
| Create/edit/delete/publish roadmap items | yes | yes | | |
| Categories & tags CRUD, release notes CRUD/publish/archive | yes | yes | | |
| Dashboard & analytics | yes | yes | yes | |
| Team management (owners manage admins; admins manage PMs & customers) | yes | yes | | |
| View subscription & usage | yes | yes | | |
| Change plan, workspace settings, delete workspace | yes | | | |

Navigation is filtered by role and routes are guarded (`RequireRole`).

## Requirements coverage

- **Auth & access**: login/logout, protected routes, role-based navigation (`context/AuthContext`, `components/Guards`, `components/Layout`).
- **Workspaces**: create (selector page), edit name/description/logo URL/brand color/public roadmap setting, delete; three separate demo workspaces; brand color themes the UI.
- **Team**: add/edit/remove members, roles, statuses (active/invited/suspended).
- **Feedback**: create/view/edit/delete with title, description, category, submitter, tags, priority, status.
- **Voting & comments**: one vote per user per item (checked before insert, button locked while pending), toggle, vote totals, comments.
- **Duplicates**: link to a primary request (optionally merging votes), linked count on the list and detail pages, unlink.
- **Categories & tags**: CRUD with duplicate-name validation; filter by category, tag, status, priority and date.
- **Roadmap**: board with Under Review / Planned / In Progress / Completed, drag-and-drop or stage menu, links to feedback (linked feedback status follows the stage).
- **Public roadmap**: read-only page at `/public/:workspaceId/roadmap` showing published items (+ published release notes).
- **Release notes**: create, edit, publish, archive/restore, delete; version, release date, summary, related completed roadmap items.
- **Dashboard**: total feedback, votes, open requests, completed features, roadmap progress, category and status charts (Recharts), recent activity.
- **Subscription & usage**: Free and Pro plans with member/feedback/roadmap limits, usage meters, 80% and 100% warnings, creation blocked at the limit, simulated plan switching (no payments).
- **Search, filter, sort**: title/description search; category, tag, status, priority and date range filters; newest/oldest/most votes.
- **Validation & UI states**: required-field validation, confirmation dialogs for destructive actions, loading/empty/error/success (toast) states.

JSON Server resources: `users, workspaces, workspaceMembers, categories, tags, feedback, votes, comments, roadmapItems, releaseNotes, subscriptionPlans, workspaceSubscriptions, activityLogs`.

## Deploying

The frontend is static and deploys to **Netlify** (`netlify.toml`) or **Vercel** (`vercel.json`), both with SPA rewrites. Static hosts cannot run JSON Server, so host the API separately and point the frontend at it:

1. Deploy the API: any Node host works (`render.yaml` is included for Render). Start command: `node server.js` (it honours `PORT`). Note that data written on free hosts is reset when the service restarts.
2. In Netlify/Vercel set the environment variable `VITE_API_URL` to the API's public URL (no trailing slash) and deploy (`npm run build`, output `dist`).

## Project structure

```
db.json                  JSON Server database (generated by scripts/seed.mjs)
server.js                JSON Server entry for local use and hosting
src/api.ts               Axios client, CRUD helpers, vote toggle, cascade deletes
src/context/             Auth and workspace (role, plan, usage) providers
src/components/          Layout, route guards, shared UI (modal, toast, badges…)
src/pages/               One file per page
src/lib/utils.ts         Constants, permission rules, formatting helpers
```
