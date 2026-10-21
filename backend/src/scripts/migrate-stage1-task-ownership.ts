import 'dotenv/config';
import mongoose from 'mongoose';
import { TaskVisibility } from '../models/Task';

const uri = process.env.MONGO_URI || process.env.DATABASE_URL;
const apply = process.argv.includes('--apply');
const rollback = process.argv.includes('--rollback');

const main = async () => {
  if (!uri) throw new Error('MONGO_URI or DATABASE_URL is required.');
  if (apply && process.env.MIGRATION_BACKUP_CONFIRMED !== 'true') {
    throw new Error('Set MIGRATION_BACKUP_CONFIRMED=true only after taking and verifying a database backup.');
  }
  await mongoose.connect(uri);
  const collection = mongoose.connection.collection('tasks');
  const before = await collection.countDocuments();

  if (rollback) {
    const filter = { sharingMigratedAt: { $ne: null } };
    const count = await collection.countDocuments(filter);
    console.log(`${apply ? 'Rolling back' : 'Would roll back'} ${count} Stage 1 task records.`);
    if (apply) {
      await collection.updateMany(filter, { $unset: { ownerId: '', visibility: '', sharedWithIds: '', sharingMigratedAt: '' } });
    }
  } else {
    const cursor = collection.find({
      $or: [
        { ownerId: { $exists: false } },
        { ownerId: null },
        { visibility: { $exists: false } },
        { sharingMigratedAt: { $exists: false } },
      ],
    });
    let candidates = 0;
    let invalid = 0;
    for await (const task of cursor) {
      candidates += 1;
      if (!task.creatorId) {
        invalid += 1;
        console.warn(`Skipping task ${task._id}: creatorId is missing; ownership cannot be inferred safely.`);
        continue;
      }
      const legacyShares = Array.from(new Set([
        ...(task.partnerId ? [task.partnerId.toString()] : []),
        ...((task.collaboratorIds || []).map((id: any) => id.toString())),
      ])).filter((id) => id !== task.creatorId.toString());
      const visibility = task.isPrivate === true || legacyShares.length === 0
        ? TaskVisibility.PRIVATE
        : TaskVisibility.SELECTED_PARTNERS;
      if (apply) {
        await collection.updateOne(
          { _id: task._id },
          { $set: {
            ownerId: task.creatorId,
            visibility,
            isPrivate: visibility === TaskVisibility.PRIVATE,
            sharedWithIds: visibility === TaskVisibility.PRIVATE ? [] : legacyShares.map((id) => new mongoose.Types.ObjectId(id)),
            sharingMigratedAt: new Date(),
          } },
        );
      }
    }
    console.log(`${apply ? 'Migrated' : 'Would migrate'} ${candidates - invalid} of ${candidates} candidate tasks; ${invalid} require manual review.`);
  }

  const after = await collection.countDocuments();
  if (before !== after) throw new Error(`Record count changed unexpectedly (${before} -> ${after}).`);
  console.log(`Verified task record count: ${after}. Mode: ${apply ? 'APPLY' : 'DRY RUN'}.`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
