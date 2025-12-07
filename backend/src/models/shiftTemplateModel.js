const db = require('../db');

async function listShiftTemplates(tenantId) {
  return db('shift_templates')
    .where({ tenant_id: tenantId })
    .orderBy(['code', 'name']);
}

async function upsertShiftTemplate(tenantId, data) {
  const existing = await db('shift_templates')
    .where({ tenant_id: tenantId, code: data.code })
    .first();

  const payload = {
    tenant_id: tenantId,
    code: data.code,
    name: data.name || null,
    start_time: data.start_time || null,
    end_time: data.end_time || null,
    description: data.description || null
  };

  if (existing) {
    await db('shift_templates').where({ id: existing.id }).update({ ...payload, updated_at: db.fn.now() });
    return { ...existing, ...payload };
  }

  const [created] = await db('shift_templates').insert(payload).returning('*');
  return created;
}

async function findByCode(tenantId, code) {
  return db('shift_templates').where({ tenant_id: tenantId, code }).first();
}

module.exports = {
  listShiftTemplates,
  upsertShiftTemplate,
  findByCode
};
