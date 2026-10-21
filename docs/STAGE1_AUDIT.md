# Stage 1 workflow audit

## Current behavior found

- Authentication uses a signed session cookie with bearer-token fallback.
- Tasks used `creatorId` as de facto ownership and used `partnerId`/`collaboratorIds` for access.
- Every non-private new task automatically linked every ID in the creator's legacy `accountabilityPartners` array.
- Mutual partnership acceptance automatically added both people to every existing workspace; later workspace reads repeated this mutation.
- Task update authorization treated any task participant as an owner for title, description, due date, priority, workspace, privacy, and most status changes.
- Dashboard personal metrics counted owned and monitored tasks together.
- Partner check-ins changed the owner's task status except for completion.
- Task invitations supported accept/decline/expiry but lacked sender cancellation and described monitoring as generic collaboration.
- Partner relationships were deleted on removal, losing lifecycle state, and fixed limits of three mutual/four single partners were enforced.

## Confirmed security and correctness defects

- Broken object-level authorization allowed a monitor with a task ID to modify owner-controlled fields.
- Automatic partner and workspace linking exposed content without task-level consent.
- Workspace membership and legacy participant checks were not governed by one current relationship policy.
- Client task updates could change access-related fields through scattered controller logic.
- Partner feedback could set `IN_PROGRESS` or `MISSED` on another person's task.
- Metrics credited monitored task completion to the current user.
- Several ID routes did not validate MongoDB ObjectId format.

## Implemented changes

- Added centralized permissions in `backend/src/lib/taskAccess.ts` with separate view, feedback, and management capabilities.
- Added authoritative `ownerId`, explicit `visibility`, and `sharedWithIds`, while retaining legacy fields for compatibility.
- Made new tasks private by default and removed all automatic task/workspace sharing.
- Restricted task selection to accepted partners with correct Mutual/Single direction.
- Made every task mutation owner-only and protected owner identity from mass assignment.
- Separated owner progress from partner feedback and added reliable check-in `kind` for new records.
- Added invitation cancellation, relationship termination records, access revocation, invite throttling, and ObjectId validation.
- Split dashboard responses into `myTasks` and `monitoringTasks`; personal metrics use only owned tasks.
- Updated the creation workflow and task details to display owner, creator, monitoring partners, role, visibility, loading, and inline errors.

## Migration considerations

- Ownership is derived only from the validated historical `creatorId`; it is never inferred from a partner or workspace.
- Existing private tasks remain private.
- Existing non-private participant links become selected sharing only when explicit participant IDs already exist; records with no participants become private.
- Missing creators are skipped and reported for manual review rather than guessed.
- The migration is dry-run by default, idempotent, record-count checked, and guarded by a backup confirmation for apply mode.

## Known follow-ups outside Stage 1

- Historical check-ins without `kind` remain unlabeled rather than receiving fabricated roles.
- The in-memory invitation limiter is per application process; a shared store should replace it for horizontally scaled production.
- The existing frontend ESLint baseline reports 85 errors (primarily legacy `any` types and React compiler/effect rules). Production TypeScript/Vite compilation succeeds; lint debt should be handled separately without mixing a repo-wide refactor into Stage 1.
- Advanced evidence, progress percentages, verification, recurrence, subtasks, milestones, teams, gamification, AI coaching, and billing are intentionally deferred.
