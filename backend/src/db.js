const knex = require('knex');
const config = require('../knexfile');

const env = process.env.NODE_ENV || 'development';
const selectedConfig = config[env];

if (!selectedConfig) {
  throw new Error(`No database configuration found for environment: ${env}`);
}

const db = knex(selectedConfig);

module.exports = db;