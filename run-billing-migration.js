/**
 * Standalone runner for the token-billing migration.
 *
 * Applies migrations/20260703000000-add-token-billing.js using the APP's own
 * Sequelize connection (models/index.js — correctly configured for MySQL), so it
 * does not depend on config/config.js (which is currently set to the postgres
 * dialect and would not match the live MySQL database).
 *
 * Usage:   node run-billing-migration.js          # apply (up)
 *          node run-billing-migration.js down      # revert (down)
 *
 * The migration itself is idempotent (guards table/column existence), so re-running
 * `up` is safe.
 */
require('dotenv').config();
const { Sequelize } = require('sequelize');
const { sequelize } = require('./models');
const migration = require('./migrations/20260703000000-add-token-billing');

const direction = process.argv[2] === 'down' ? 'down' : 'up';

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Connected. Running billing migration: ${direction}…`);
    const qi = sequelize.getQueryInterface();
    await migration[direction](qi, Sequelize);
    console.log(`✅ Billing migration ${direction} complete.`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Billing migration ${direction} failed:`, err.message);
    console.error(err);
    process.exit(1);
  }
})();
