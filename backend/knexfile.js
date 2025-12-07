require('dotenv').config();

const baseConfig = {
  client: 'pg',
  migrations: {
    tableName: 'knex_migrations',
    directory: './migrations'
  }
};

function connectionFromEnv(prefix = 'DB') {
  return {
    host: process.env[`${prefix}_HOST`],
    port: process.env[`${prefix}_PORT`],
    user: process.env[`${prefix}_USER`],
    password: process.env[`${prefix}_PASSWORD`],
    database: process.env[`${prefix}_NAME`]
  };
}

module.exports = {
  development: {
    ...baseConfig,
    connection: connectionFromEnv('DB')
  },
  test: {
    ...baseConfig,
    connection: connectionFromEnv('DB_TEST').host ? connectionFromEnv('DB_TEST') : connectionFromEnv('DB')
  }
};