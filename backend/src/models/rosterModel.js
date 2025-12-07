const db = require('../db');

async function listRosters(tenantId) {
  return db('rosters')
    .where({ tenant_id: tenantId })
    .orderBy('start_date', 'desc');
}

async function createRoster(tenantId, data) {
  const [roster] = await db('rosters')
    .insert({
      tenant_id: tenantId,
      name: data.name,
      location: data.location,
      start_date: data.start_date,
      end_date: data.end_date
    })
    .returning('*');

  return roster;
}

async function addSlot(tenantId, data) {
  const [slot] = await db('roster_slots')
    .insert({
      tenant_id: tenantId,
      roster_id: data.roster_id,
      employee_id: data.employee_id,
      duty_date: data.duty_date,
      shift_code: data.shift_code,
      start_time: data.start_time || null,
      end_time: data.end_time || null
    })
    .returning('*');

  return slot;
}

async function listRosterSlots(tenantId, rosterId) {
  return db('roster_slots as rs')
    .join('employees as e', 'rs.employee_id', 'e.id')
    .select(
      'rs.id',
      'rs.duty_date',
      'rs.shift_code',
      'rs.start_time',
      'rs.end_time',
      'e.name',
      'e.service_no',
      'e.eg',
      'e.location'
    )
    .where({
      'rs.tenant_id': tenantId,
      'rs.roster_id': rosterId
    })
    .orderBy(['rs.duty_date', { column: 'e.name', order: 'asc' }]);
}

module.exports = {
  listRosters,
  createRoster,
  addSlot,
  listRosterSlots
};