const request = require('supertest');
const app = require('../src/index');
const db = require('../src/db');

describe('POST /api/tenants', () => {
  test('creates a tenant record and returns it', async () => {
    const payload = { name: 'Test Tenant', slug: 'test-tenant' };

    const response = await request(app).post('/api/tenants').send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: payload.name, slug: payload.slug });
    expect(response.body.id).toBeDefined();

    const persisted = await db('tenants').where({ id: response.body.id }).first();
    expect(persisted).toBeTruthy();
    expect(persisted.name).toBe(payload.name);
  });
});
