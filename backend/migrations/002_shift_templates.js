/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('rosters', (table) => {
    table.string('shift_mode').notNullable().defaultTo('rotation');
  });

  await knex.schema.createTable('shift_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('code').notNullable();
    table.string('name').nullable();
    table.time('start_time').nullable();
    table.time('end_time').nullable();
    table.string('description').nullable();
    table.timestamps(true, true);

    table.unique(['tenant_id', 'code']);
    table.index(['tenant_id', 'code']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('shift_templates');
  await knex.schema.alterTable('rosters', (table) => {
    table.dropColumn('shift_mode');
  });
};
