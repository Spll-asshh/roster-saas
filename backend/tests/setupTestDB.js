const db = require('../src/db');

beforeAll(async () => {
  await db.migrate.latest();
});

beforeEach(async () => {
  await db('roster_slots').del();
  await db('rosters').del();
  await db('employees').del();
  await db('users').del();
  await db('tenants').del();
});

afterAll(async () => {
  await db.destroy();
});

module.exports = db;
