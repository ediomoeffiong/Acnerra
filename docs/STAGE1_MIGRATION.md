# Stage 1 task migration

## Before running

1. Deploy code that supports both legacy and Stage 1 fields.
2. Take a database backup and restore it into a temporary environment to verify it.
3. Set `MONGO_URI` or `DATABASE_URL` to the intended database.
4. Run the dry-run and review every skipped task.

## Dry-run

```powershell
cd backend
npm run migrate:stage1
```

Dry-run is the default and performs no writes.

## Apply

```powershell
$env:MIGRATION_BACKUP_CONFIRMED='true'
npm run migrate:stage1 -- --apply
```

The script verifies that the task record count is unchanged. It can be run again safely; already migrated records are not expanded or reassigned.

## Rollback

Rollback removes only fields written by this migration. The compatibility code continues using `creatorId`, `partnerId`, and `collaboratorIds`.

```powershell
npm run migrate:stage1 -- --rollback          # preview
$env:MIGRATION_BACKUP_CONFIRMED='true'
npm run migrate:stage1 -- --rollback --apply  # apply
```

Do not use rollback as a substitute for restoring a verified backup. Compare task counts, sample ownership, private-task access, and participant references before and after deployment.
