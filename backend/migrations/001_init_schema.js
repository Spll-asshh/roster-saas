/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  // Ensure pgcrypto for gen_random_uuid()
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  await knex.schema.createTable('tenants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable().unique();
    table.string('slug').notNullable().unique(); // e.g. paa-ops, acme-inc
    table.timestamps(true, true);
  });

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable()
      .references('id').inTable('tenants').onDelete('CASCADE');
    table.string('email').notNullable();
    table.string('password_hash').notNullable();
    table.string('role').notNullable().defaultTo('admin');
    table.timestamps(true, true);

    table.unique(['tenant_id', 'email']);
  });

  await knex.schema.createTable('employees', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable()
      .references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('service_no').notNullable();
    table.string('eg').nullable(); // Employee grade
    table.string('location').nullable(); // Can normalize later
    table.boolean('active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.unique(['tenant_id', 'service_no']);
    table.index(['tenant_id', 'location']);
  });

  await knex.schema.createTable('rosters', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable()
      .references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name').notNullable(); // e.g. "IIAP Jan-2026 Roster"
    table.string('location').notNullable();
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.timestamps(true, true);

    table.index(['tenant_id', 'location', 'start_date', 'end_date']);
  });

  await knex.schema.createTable('roster_slots', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable()
      .references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('roster_id').notNullable()
      .references('id').inTable('rosters').onDelete('CASCADE');
    table.uuid('employee_id').notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.date('duty_date').notNullable();
    table.string('shift_code').notNullable(); // e.g. 'M', 'E', 'N', 'O'
    table.time('start_time').nullable();
    table.time('end_time').nullable();
    table.timestamps(true, true);

    table.unique(['tenant_id', 'roster_id', 'employee_id', 'duty_date']);
    table.index(['tenant_id', 'duty_date']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('roster_slots');
  await knex.schema.dropTableIfExists('rosters');
  await knex.schema.dropTableIfExists('employees');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('tenants');
};