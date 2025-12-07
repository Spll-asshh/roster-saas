require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const tenantsRoutes = require('./routes/tenants');
const rosterRoutes = require('./routes/roster');

const app = express();

app.use(cors());
app.use(express.json());

// API health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'roster-saas' });
});

// Tenant + roster routes
app.use('/api/tenants', tenantsRoutes);
app.use('/api/roster', rosterRoutes);

// Serve your existing static UI (HTML/JS/CSS) for now
app.use('/', express.static(path.join(__dirname, '..', '..', 'frontend', 'public')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Roster SaaS backend running on http://localhost:${PORT}`);
});