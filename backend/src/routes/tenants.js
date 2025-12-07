const express = require('express');
const router = express.Router();
const tenantModel = require('../models/tenantModel');

// List all tenants (for now, no auth)
router.get('/', async (req, res) => {
  try {
    const tenants = await tenantModel.listTenants();
    res.json(tenants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list tenants' });
  }
});

// Create a tenant
router.post('/', async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug are required' });
    }

    const tenant = await tenantModel.createTenant({ name, slug });
    res.status(201).json(tenant);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;