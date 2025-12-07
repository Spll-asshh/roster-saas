const express = require('express');
const router = express.Router();
const rosterModel = require('../models/rosterModel');
const employeeModel = require('../models/employeeModel');

function getTenantId(req) {
  const id = req.headers['x-tenant-id'];
  if (!id) {
    throw new Error('Missing x-tenant-id header');
  }
  return id;
}

// List rosters for tenant
router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const rosters = await rosterModel.listRosters(tenantId);
    res.json(rosters);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// Create roster
router.post('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const roster = await rosterModel.createRoster(tenantId, req.body);
    res.status(201).json(roster);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// List employees for tenant
router.get('/employees', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const employees = await employeeModel.listEmployees(tenantId);
    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// Create employee
router.post('/employees', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const employee = await employeeModel.createEmployee(tenantId, req.body);
    res.status(201).json(employee);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// Add slot to roster
router.post('/:rosterId/slots', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const rosterId = req.params.rosterId;
    const slot = await rosterModel.addSlot(tenantId, {
      roster_id: rosterId,
      employee_id: req.body.employee_id,
      duty_date: req.body.duty_date,
      shift_code: req.body.shift_code,
      start_time: req.body.start_time,
      end_time: req.body.end_time
    });
    res.status(201).json(slot);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// List slots for a roster
router.get('/:rosterId/slots', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const rosterId = req.params.rosterId;
    const slots = await rosterModel.listRosterSlots(tenantId, rosterId);
    res.json(slots);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;