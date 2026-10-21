const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../dist/app').default;
const { encrypt } = require('../dist/lib/auth');
const { User } = require('../dist/models/User');
const { Task } = require('../dist/models/Task');
const { PartnerRelation } = require('../dist/models/PartnerRelation');
const { ProgressRequest } = require('../dist/models/ProgressRequest');
const { CheckIn } = require('../dist/models/CheckIn');
const { Notification } = require('../dist/models/Notification');
const { XPTransaction } = require('../dist/models/XPTransaction');

let mongo;
let owner;
let monitor;
let otherMonitor;
let stranger;
let ownerToken;
let monitorToken;
let otherMonitorToken;
let strangerToken;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

after(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  [owner, monitor, otherMonitor, stranger] = await User.create([
    { username: 'owner', email: 'owner@example.com', password: 'hashed-password' },
    { username: 'monitor', email: 'monitor@example.com', password: 'hashed-password' },
    { username: 'othermonitor', email: 'other@example.com', password: 'hashed-password' },
    { username: 'stranger', email: 'stranger@example.com', password: 'hashed-password' },
  ]);

  [ownerToken, monitorToken, otherMonitorToken, strangerToken] = await Promise.all([
    encrypt({ userId: owner.id }),
    encrypt({ userId: monitor.id }),
    encrypt({ userId: otherMonitor.id }),
    encrypt({ userId: stranger.id }),
  ]);

  // Establish accepted relationships with owner
  await PartnerRelation.create([
    { senderId: owner.id, receiverId: monitor.id, mode: 'MUTUAL', status: 'ACCEPTED' },
    { senderId: owner.id, receiverId: otherMonitor.id, mode: 'MUTUAL', status: 'ACCEPTED' },
  ]);
});

test('Stage 2: Subtasks and Milestones ownership & progress calculations', async () => {
  const taskRes = await request(app).post('/api/v1/tasks').set(auth(ownerToken)).send({
    title: 'Project with Subtasks',
    visibility: 'SELECTED_PARTNERS',
    sharedWithIds: [monitor.id],
    subtasks: [
      { title: 'Subtask 1', description: 'First step' },
      { title: 'Subtask 2', description: 'Second step' },
    ],
    milestones: [
      { title: 'Milestone 1', description: 'Halfway point' },
    ],
  });

  assert.equal(taskRes.status, 201);
  const taskId = taskRes.body.task.id;
  assert.equal(taskRes.body.task.subtasks.length, 2);
  assert.equal(taskRes.body.task.milestones.length, 1);
  assert.equal(taskRes.body.task.progress, 0);

  const subtaskId = taskRes.body.task.subtasks[0].id;
  const milestoneId = taskRes.body.task.milestones[0].id;

  // Monitor cannot toggle, edit, or delete subtasks
  const monitorToggle = await request(app).patch(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}/toggle`).set(auth(monitorToken));
  assert.equal(monitorToggle.status, 403);

  const monitorMilestone = await request(app).put(`/api/v1/tasks/${taskId}/milestones/${milestoneId}`).set(auth(monitorToken)).send({ status: 'COMPLETED' });
  assert.equal(monitorMilestone.status, 403);

  // Owner toggles first subtask
  const ownerToggle = await request(app).patch(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}/toggle`).set(auth(ownerToken));
  assert.equal(ownerToggle.status, 200);
  assert.equal(ownerToggle.body.task.subtasks[0].completed, true);

  // Owner marks milestone completed -> should award XP (+25 XP)
  const ownerMilestone = await request(app).put(`/api/v1/tasks/${taskId}/milestones/${milestoneId}`).set(auth(ownerToken)).send({ status: 'COMPLETED' });
  assert.equal(ownerMilestone.status, 200);
  assert.equal(ownerMilestone.body.task.milestones[0].status, 'COMPLETED');

  // Verify XP was awarded for milestone
  const updatedOwner = await User.findById(owner.id);
  assert.ok(updatedOwner.xp >= 25);

  // Progress should now reflect combined subtask & milestone progress
  const fetchedTask = await request(app).get(`/api/v1/tasks/${taskId}`).set(auth(ownerToken));
  assert.ok(fetchedTask.body.task.progress > 0);
});

test('Stage 2: Recurring tasks generate next occurrence on completion with unique identity', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const created = await request(app).post('/api/v1/tasks').set(auth(ownerToken)).send({
    title: 'Daily Exercise',
    dueDate: tomorrow.toISOString(),
    visibility: 'SELECTED_PARTNERS',
    sharedWithIds: [monitor.id],
    recurrence: {
      frequency: 'DAILY',
      interval: 1,
    },
  });
  assert.equal(created.status, 201);
  const taskId = created.body.task.id;

  // Owner completes this occurrence
  const completedRes = await request(app).put(`/api/v1/tasks/${taskId}`).set(auth(ownerToken)).send({
    status: 'COMPLETED',
  });
  assert.equal(completedRes.status, 200);
  assert.equal(completedRes.body.task.status, 'COMPLETED');

  // Check that next occurrence was automatically spawned
  const allTasks = await Task.find({ ownerId: owner.id });
  assert.equal(allTasks.length, 2);

  const nextOccurrence = allTasks.find((t) => t.id !== taskId);
  assert.ok(nextOccurrence);
  assert.equal(nextOccurrence.title, 'Daily Exercise');
  assert.equal(nextOccurrence.status, 'PENDING');
  assert.equal(nextOccurrence.isRecurringInstance, true);
  assert.equal(nextOccurrence.occurrenceIndex, 2);
  assert.equal(nextOccurrence.recurringSeriesId.toString(), allTasks[0].recurringSeriesId.toString());

  // Completing again does not duplicate if already generated
  const completedAgain = await request(app).put(`/api/v1/tasks/${taskId}`).set(auth(ownerToken)).send({
    status: 'COMPLETED',
  });
  assert.equal(completedAgain.status, 200);
  const countAfter = await Task.countDocuments({ ownerId: owner.id });
  assert.equal(countAfter, 2);
});

test('Stage 2: Rescheduling overdue tasks preserves history', async () => {
  const past = new Date(Date.now() - 1000 * 60 * 60 * 24); // yesterday
  const task = await Task.create({
    title: 'Overdue task',
    ownerId: owner.id,
    creatorId: owner.id,
    dueDate: past,
    status: 'PENDING',
    visibility: 'SELECTED_PARTNERS',
    sharedWithIds: [monitor.id],
  });

  const nextWeek = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  // Monitor cannot reschedule
  const denied = await request(app).post(`/api/v1/tasks/${task.id}/reschedule`).set(auth(monitorToken)).send({
    newDueDate: nextWeek.toISOString(),
    reason: 'Trying to change',
  });
  assert.equal(denied.status, 403);

  // Owner reschedules
  const res = await request(app).post(`/api/v1/tasks/${task.id}/reschedule`).set(auth(ownerToken)).send({
    newDueDate: nextWeek.toISOString(),
    reason: 'Needed more time for testing',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.task.rescheduleHistory.length, 1);
  assert.equal(res.body.task.rescheduleHistory[0].reason, 'Needed more time for testing');
  assert.equal(res.body.task.isOverdue, false);
});

test('Stage 2: Completion verification workflow and role enforcement', async () => {
  const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const created = await request(app).post('/api/v1/tasks').set(auth(ownerToken)).send({
    title: 'Verifiable task',
    dueDate: tomorrow.toISOString(),
    visibility: 'SELECTED_PARTNERS',
    sharedWithIds: [monitor.id],
    verificationRequired: true,
    verifierId: monitor.id,
  });
  assert.equal(created.status, 201);
  const taskId = created.body.task.id;

  // Complete task
  const completeRes = await request(app).put(`/api/v1/tasks/${taskId}`).set(auth(ownerToken)).send({
    status: 'COMPLETED',
  });
  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.body.task.verificationStatus, 'PENDING');

  // Stranger cannot verify
  const strangerVerify = await request(app).post(`/api/v1/tasks/${taskId}/verify`).set(auth(strangerToken)).send({
    decision: 'VERIFY',
  });
  assert.equal(strangerVerify.status, 403);

  // Verifier requests clarification
  const clarifyRes = await request(app).post(`/api/v1/tasks/${taskId}/verify`).set(auth(monitorToken)).send({
    decision: 'REQUEST_CLARIFICATION',
    notes: 'Please attach test results screenshot.',
  });
  assert.equal(clarifyRes.status, 200);
  assert.equal(clarifyRes.body.task.verificationStatus, 'NEEDS_CLARIFICATION');

  // Verifier approves verification
  const approveRes = await request(app).post(`/api/v1/tasks/${taskId}/verify`).set(auth(monitorToken)).send({
    decision: 'VERIFY',
    notes: 'Looks great! Confirmed.',
  });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.task.verificationStatus, 'VERIFIED');
});

test('Stage 2: Private partner feedback is hidden from other monitors', async () => {
  const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const created = await request(app).post('/api/v1/tasks').set(auth(ownerToken)).send({
    title: 'Shared with two buddies',
    dueDate: tomorrow.toISOString(),
    visibility: 'SELECTED_PARTNERS',
    sharedWithIds: [monitor.id, otherMonitor.id],
  });
  const taskId = created.body.task.id;

  // Monitor 1 leaves private feedback
  const feedbackRes = await request(app).post(`/api/v1/tasks/${taskId}/check-ins`).set(auth(monitorToken)).send({
    status: 'IN_PROGRESS',
    notes: 'Private note for your eyes only.',
    isPrivate: true,
  });
  assert.equal(feedbackRes.status, 201);
  assert.equal(feedbackRes.body.checkIn.isPrivate, true);

  // Monitor 2 lists check-ins -> should NOT see monitor 1 private feedback
  const otherList = await request(app).get(`/api/v1/tasks/${taskId}/check-ins`).set(auth(otherMonitorToken));
  assert.equal(otherList.status, 200);
  assert.equal(otherList.body.checkIns.length, 0);

  // Task owner lists check-ins -> CAN see private feedback
  const ownerList = await request(app).get(`/api/v1/tasks/${taskId}/check-ins`).set(auth(ownerToken));
  assert.equal(ownerList.status, 200);
  assert.equal(ownerList.body.checkIns.length, 1);
  assert.equal(ownerList.body.checkIns[0].notes, 'Private note for your eyes only.');
});

test('Stage 2: Progress requests with anti-spam rate limiting', async () => {
  const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const created = await request(app).post('/api/v1/tasks').set(auth(ownerToken)).send({
    title: 'Project under review',
    dueDate: tomorrow.toISOString(),
    visibility: 'SELECTED_PARTNERS',
    sharedWithIds: [monitor.id],
  });
  const taskId = created.body.task.id;

  // Monitor requests progress update
  const req1 = await request(app).post(`/api/v1/tasks/${taskId}/progress-requests`).set(auth(monitorToken)).send({
    message: 'Any update on this?',
  });
  assert.equal(req1.status, 201);
  const requestId = req1.body.progressRequest.id;

  // Immediate second request -> rejected by anti-spam rule (already pending)
  const req2 = await request(app).post(`/api/v1/tasks/${taskId}/progress-requests`).set(auth(monitorToken)).send({
    message: 'Spamming update request',
  });
  assert.equal(req2.status, 400);

  // Owner responds to progress request
  const respond = await request(app).patch(`/api/v1/tasks/${taskId}/progress-requests/${requestId}/respond`).set(auth(ownerToken)).send({
    responseNotes: 'Working on phase 2 now!',
  });
  assert.equal(respond.status, 200);
  assert.equal(respond.body.progressRequest.status, 'RESPONDED');
});

test('Stage 2: Notification preferences and category filtering', async () => {
  // Update preferences
  const updatePref = await request(app).put('/api/v1/notifications/preferences').set(auth(ownerToken)).send({
    emailNotifications: true,
    reminderTiming: '1_HOUR',
    quietHours: { enabled: true, start: '23:00', end: '07:00' },
  });
  assert.equal(updatePref.status, 200);
  assert.equal(updatePref.body.preferences.reminderTiming, '1_HOUR');

  // Create notifications and check category filtering
  await Notification.create([
    { userId: owner.id, type: 'TASK_UPDATED', category: 'TASKS', title: 'Task alert', message: 'M1' },
    { userId: owner.id, type: 'CHECK_IN', category: 'FEEDBACK', title: 'Feedback alert', message: 'M2' },
  ]);

  const taskNotes = await request(app).get('/api/v1/notifications?category=TASKS').set(auth(ownerToken));
  assert.equal(taskNotes.status, 200);
  assert.equal(taskNotes.body.notifications.length, 1);
  assert.equal(taskNotes.body.notifications[0].category, 'TASKS');

  // Mark all read
  const markAll = await request(app).patch('/api/v1/notifications/read-all').set(auth(ownerToken));
  assert.equal(markAll.status, 200);
  const unreadCount = await Notification.countDocuments({ userId: owner.id, read: false });
  assert.equal(unreadCount, 0);
});

test('Stage 2: Onboarding state persistence', async () => {
  const patchRes = await request(app).patch('/api/v1/profiles/onboarding').set(auth(ownerToken)).send({
    completed: true,
    step: 6,
  });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.onboardingCompleted, true);
  assert.equal(patchRes.body.onboardingStep, 6);

  const meRes = await request(app).get('/api/v1/auth/me').set(auth(ownerToken));
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.user.onboardingCompleted, true);
});
