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
const { Invite } = require('../dist/models/Invite');
const { Workspace } = require('../dist/models/Workspace');

let mongo;
let owner;
let monitor;
let stranger;
let ownerToken;
let monitorToken;
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
  [owner, monitor, stranger] = await User.create([
    { username: 'owner', email: 'owner@example.com', password: 'hashed-password' },
    { username: 'monitor', email: 'monitor@example.com', password: 'hashed-password' },
    { username: 'stranger', email: 'stranger@example.com', password: 'hashed-password' },
  ]);
  [ownerToken, monitorToken, strangerToken] = await Promise.all([
    encrypt({ userId: owner.id }), encrypt({ userId: monitor.id }), encrypt({ userId: stranger.id }),
  ]);
});

test('creation is private by default and identity fields cannot be spoofed', async () => {
  const spoofed = await request(app).post('/api/v1/tasks').set(auth(ownerToken)).send({
    title: 'Spoof attempt', ownerId: stranger.id, creatorId: stranger.id,
  });
  assert.equal(spoofed.status, 400);

  const response = await request(app).post('/api/v1/tasks').set(auth(ownerToken)).send({ title: 'My private task' });
  assert.equal(response.status, 201);
  assert.equal(response.body.task.ownerId.id, owner.id);
  assert.equal(response.body.task.creatorId.id, owner.id);
  assert.equal(response.body.task.visibility, 'PRIVATE');
  assert.equal(response.body.task.isPrivate, true);
  assert.deepEqual(response.body.task.sharedWithIds, []);

  const denied = await request(app).get(`/api/v1/tasks/${response.body.task.id}`).set(auth(monitorToken));
  assert.equal(denied.status, 403);
});

test('explicit monitor may view and comment but cannot edit, complete, or delete', async () => {
  await PartnerRelation.create({ senderId: owner.id, receiverId: monitor.id, mode: 'SINGLE', status: 'ACCEPTED' });
  const created = await request(app).post('/api/v1/tasks').set(auth(ownerToken)).send({
    title: 'Explicitly shared', visibility: 'SELECTED_PARTNERS', sharedWithIds: [monitor.id],
  });
  assert.equal(created.status, 201);
  const taskId = created.body.task.id;

  assert.equal((await request(app).get(`/api/v1/tasks/${taskId}`).set(auth(monitorToken))).status, 200);
  assert.equal((await request(app).put(`/api/v1/tasks/${taskId}`).set(auth(monitorToken)).send({ title: 'Hijacked' })).status, 403);
  assert.equal((await request(app).put(`/api/v1/tasks/${taskId}`).set(auth(monitorToken)).send({ status: 'COMPLETED' })).status, 403);
  assert.equal((await request(app).delete(`/api/v1/tasks/${taskId}`).set(auth(monitorToken))).status, 403);
  assert.equal((await request(app).get(`/api/v1/tasks/${taskId}`).set(auth(strangerToken))).status, 403);

  const feedback = await request(app).post(`/api/v1/tasks/${taskId}/check-ins`).set(auth(monitorToken)).send({ status: 'IN_PROGRESS', notes: 'Keep going' });
  assert.equal(feedback.status, 201);
  assert.equal(feedback.body.checkIn.kind, 'PARTNER_FEEDBACK');
  assert.equal((await Task.findById(taskId)).status, 'PENDING');
});

test('personal dashboard metrics exclude monitored tasks', async () => {
  await PartnerRelation.create({ senderId: owner.id, receiverId: monitor.id, mode: 'MUTUAL', status: 'ACCEPTED' });
  await request(app).post('/api/v1/tasks').set(auth(ownerToken)).send({ title: 'Owner task', status: 'IN_PROGRESS', visibility: 'SELECTED_PARTNERS', sharedWithIds: [monitor.id] });
  await request(app).post('/api/v1/tasks').set(auth(monitorToken)).send({ title: 'Monitor task', status: 'COMPLETED', visibility: 'SELECTED_PARTNERS', sharedWithIds: [owner.id] });

  const dashboard = await request(app).get('/api/v1/tasks/dashboard').set(auth(ownerToken));
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.stats.totalTasks, 1);
  assert.equal(dashboard.body.stats.completedTasks, 0);
  assert.equal(dashboard.body.myTasks.length, 1);
  assert.equal(dashboard.body.monitoringTasks.length, 1);
});

test('workspace membership does not reveal a private task', async () => {
  const workspace = await Workspace.create({ name: 'Shared workspace', userId: owner.id, collaboratorIds: [monitor.id] });
  const task = await Task.create({ title: 'Still private', ownerId: owner.id, creatorId: owner.id, workspaceId: workspace.id, visibility: 'PRIVATE', isPrivate: true });
  const denied = await request(app).get(`/api/v1/tasks/${task.id}`).set(auth(monitorToken));
  assert.equal(denied.status, 403);
});

test('either party can terminate an accepted relationship and revoke task access', async () => {
  const relation = await PartnerRelation.create({ senderId: owner.id, receiverId: monitor.id, mode: 'SINGLE', status: 'ACCEPTED' });
  const task = await Task.create({
    title: 'Relationship task', ownerId: owner.id, creatorId: owner.id, visibility: 'SELECTED_PARTNERS', isPrivate: false,
    sharedWithIds: [monitor.id], collaboratorIds: [monitor.id], partnerId: monitor.id,
  });
  const ended = await request(app).delete(`/api/v1/profiles/partners/${relation.id}`).set(auth(monitorToken));
  assert.equal(ended.status, 200);
  assert.equal((await PartnerRelation.findById(relation.id)).status, 'TERMINATED');
  assert.equal((await request(app).get(`/api/v1/tasks/${task.id}`).set(auth(monitorToken))).status, 403);
});

test('expired task invitations cannot grant access and senders can cancel pending invites', async () => {
  await PartnerRelation.create({ senderId: owner.id, receiverId: monitor.id, mode: 'SINGLE', status: 'ACCEPTED' });
  const task = await Task.create({ title: 'Invited task', ownerId: owner.id, creatorId: owner.id, visibility: 'PRIVATE', isPrivate: true });
  const expired = await Invite.create({ senderId: owner.id, receiverId: monitor.id, taskId: task.id, expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await request(app).post(`/api/v1/invites/${expired.id}/accept`).set(auth(monitorToken))).status, 410);

  const pending = await Invite.create({ senderId: owner.id, receiverId: monitor.id, taskId: task.id });
  assert.equal((await request(app).delete(`/api/v1/invites/${pending.id}`).set(auth(ownerToken))).status, 200);
  assert.equal((await Invite.findById(pending.id)).status, 'CANCELLED');
});
