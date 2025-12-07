const db = require('../db');

async function listEmployees(tenantId) {
  return db('employees')
    .where({ tenant_id: tenantId, active: true })
    .orderBy('name', 'asc');
}

async function createEmployee(tenantId, data) {
  const [employee] = await db('employees')
    .insert({
      tenant_id: tenantId,
      name: data.name,
      service_no: data.service_no,
      eg: data.eg || null,
      location: data.location || null
    })
    .returning('*');

  return employee;
}

module.exports = {
  listEmployees,
  createEmployee
};