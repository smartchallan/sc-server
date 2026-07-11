/**
 * Standalone runner for the challan-settlement migration.
 *
 * Applies migrations/20260712000000-add-challan-settlement.js using the APP's own
 * Sequelize connection (models/index.js — correctly configured for MySQL), so it
 * does not depend on config/config.js (which is set to the postgres dialect and
 * would not match the live MySQL database).
 *
 * Usage:   node run-settlement-migration.js          # apply (up)
 *          node run-settlement-migration.js down      # revert (down)
 *
 * The migration guards table/column existence, so re-running `up` is safe.
 */
require('dotenv').config();
const { Sequelize } = require('sequelize');
const { sequelize } = require('./models');
const migration = require('./migrations/20260712000000-add-challan-settlement');

const direction = process.argv[2] === 'down' ? 'down' : 'up';

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Connected. Running settlement migration: ${direction}…`);
    const qi = sequelize.getQueryInterface();
    await migration[direction](qi, Sequelize);
    console.log(`✅ Settlement migration ${direction} complete.`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Settlement migration ${direction} failed:`, err.message);
    console.error(err);
    process.exit(1);
  }
})();
