const request = require('supertest');
const app = require('../src/index');
const tenantModel = require('../src/models/tenantModel');
const rosterModel = require('../src/models/rosterModel');

async function createTenant() {
  return tenantModel.createTenant({ name: 'Acme Ops', slug: `acme-${Date.now()}` });
}

describe('Roster routes', () => {
  test('GET /api/roster lists rosters for the tenant', async () => {
    const tenant = await createTenant();

    await rosterModel.createRoster(tenant.id, {
      name: 'January Schedule',
      location: 'HQ',
      start_date: '2025-01-01',
      end_date: '2025-01-31'
    });

    const response = await request(app)
      .get('/api/roster')
      .set('x-tenant-id', tenant.id);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ name: 'January Schedule', location: 'HQ' });
  });

  test('POST /api/roster validates payloads and creates a roster', async () => {
    const tenant = await createTenant();

    const payload = {
      name: 'February Schedule',
      location: 'HQ',
      start_date: '2025-02-01',
      end_date: '2025-02-28',
      approved_by_role: 'COO'
    };

    const response = await request(app)
      .post('/api/roster')
      .set('x-tenant-id', tenant.id)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: payload.name, location: payload.location });
    expect(response.body.start_date).toBe(payload.start_date);
    expect(response.body.end_date).toBe(payload.end_date);
  });

  test('POST /api/roster rejects invalid date ranges', async () => {
    const tenant = await createTenant();

    const response = await request(app)
      .post('/api/roster')
      .set('x-tenant-id', tenant.id)
      .send({
        name: 'Broken Roster',
        location: 'HQ',
        start_date: '2025-03-10',
        end_date: '2025-03-01'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/start_date must be on or before end_date/i);
  });
});
