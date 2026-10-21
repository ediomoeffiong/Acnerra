# Acnerra

Acnerra is a personal accountability and productivity application. A task always belongs to the person who created it. Accountability partners may monitor tasks that the owner explicitly shares, but cannot edit, complete, transfer, or delete them.

## Stack

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, React Router, Axios
- Backend: Node.js, Express 5, TypeScript, MongoDB, Mongoose, Zod
- Authentication: signed HTTP-only session cookie or bearer token

## Local setup

```powershell
cd backend
npm install
Copy-Item .env.example .env # if an example is present; otherwise create .env
# Set MONGO_URI and AUTH_SECRET
npm run dev
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

## Stage 1 ownership and sharing rules

- `ownerId` is authoritative; `creatorId` preserves the original creator. Unmigrated records safely fall back to `creatorId`.
- The server generates both identities during creation. Client-supplied identity fields are rejected.
- New tasks default to `PRIVATE` and have no monitoring partners.
- `SELECTED_PARTNERS` grants access only to explicitly selected users who still have an accepted, directionally valid accountability relationship.
- `WORKSPACE` access requires explicit task visibility plus explicit workspace membership and a valid accountability relationship. Workspace membership never overrides a private task.
- Only the owner can edit details, change status, manage sharing, move the task, complete it, or delete it.
- Monitors may view and leave feedback. Their feedback never mutates owner progress.
- Ending a relationship preserves history but revokes relationship-derived task access.

See [docs/STAGE1_AUDIT.md](docs/STAGE1_AUDIT.md) for the audit and [docs/STAGE1_MIGRATION.md](docs/STAGE1_MIGRATION.md) before deployment.

## Verification

```powershell
cd backend
npm test

cd ..\frontend
npm run build
npm run lint
```

The backend integration suite uses an isolated in-memory MongoDB instance and does not touch the configured application database.
