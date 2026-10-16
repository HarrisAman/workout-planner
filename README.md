# Workout Planner

React + Express + MongoDB Atlas, with every change snapshotted to a GitHub repo as a commit.

- **MongoDB** is the source of truth (fast reads/writes, drag-and-drop feels instant).
- **GitHub** is the version history. Every create, edit, move, and delete becomes a commit.
- **History + Restore** pulls an old version from GitHub back into MongoDB.

```
React (Vite)  ->  Express API  ->  MongoDB Atlas
                       |
                       +--->  GitHub Contents API (snapshot commits)
```

## Setup

You need: Node 18+, a free MongoDB Atlas cluster, and (for history) a GitHub data repo + token.

### 1. MongoDB Atlas
1. Create a free M0 cluster at https://cloud.mongodb.com
2. Database Access: add a user with a password.
3. Network Access: add your IP (or `0.0.0.0/0` for a throwaway demo).
4. Connect > Drivers: copy the connection string.

### 2. GitHub data repo + token
1. Create a new repo, e.g. `workout-data`, and **tick "Add a README"** so the `main` branch exists.  Any name works; just set it in `GITHUB_REPO`. Keep this separate from the repo that holds the app's code, because the app commits to the data repo automatically.
2. Settings > Developer settings > Personal access tokens > **Fine-grained tokens** > Generate.
3. Repository access: **Only select repositories** > `workout-data`.
4. Permissions: **Contents: Read and write**. Nothing else.

### 3. Configure and run
```bash
npm run install:all
cp server/.env.example server/.env     # then fill in the values
npm run seed                           # optional: demo routines, workout, this week's schedule
npm run dev                            # API on :4000, app on http://localhost:5173
```

The header pill shows `History: owner/repo` when GitHub is connected. If you leave the GITHUB_* values blank the app still works; history just stays empty.

## How it maps to Git

| Action | Commit |
|---|---|
| Drag routine onto a day | `Schedule Push Day on 2026-10-14` (updates `schedule/2026-W42.json`) |
| Drag entry to another day | `Move Push Day from 2026-10-12 to 2026-10-14` |
| Start workout, save | `Add workout: Push Day` + `Mark Push Day done on ...` |
| Edit workout / routine | `Update workout: ...` |
| Delete | `Delete workout: ...` |
| Restore from history | `Restore workout: ... (from a1b2c3d)` |

Repo layout the app creates: `routines/`, `workouts/`, `schedule/` (one file per ISO week).

## Project layout
```
server/   index.js, routes.js (CRUD + schedule), github.js (snapshot queue), db.js, seed.js
client/   src/App.jsx, components/{WeekCalendar,Workouts,Routines,HistoryPanel}.jsx, api.js
```

## Known limits
- Drag-and-drop moves within the visible week. To move across weeks, use Remove + Add on the other week.
- GitHub commits are queued and run one at a time, so they land a second or two after the UI updates.
- No user accounts: anyone who can reach the API can edit. Fine for a demo; add auth before deploying publicly.
- Deleted items' history is still on GitHub, but restoring a deleted item isn't in the UI.

## Deploying (optional)
Run `npm run build --prefix client`, host `client/dist` on Netlify/Vercel, and host `server/` on Render/Railway/Fly with the same env vars. Point the client at the API (replace the Vite proxy with a `VITE_API_URL` base, or add a rewrite for `/api`).
