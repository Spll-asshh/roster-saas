const db = require('../db');

async function createTenant({ name, slug }) {
  const [tenant] = await db('tenants')
    .insert({ name, slug })
    .returning('*');
  return tenant;
}

async function getTenantBySlug(slug) {
  return db('tenants').where({ slug }).first();
}

async function listTenants() {
  return db('tenants').select('*').orderBy('created_at', 'desc');
}

module.exports = {
  createTenant,
  getTenantBySlug,
  listTenants
};