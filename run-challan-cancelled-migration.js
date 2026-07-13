/**
 * Standalone runner for the cancelled-challan migration.
 *
 * Adds di_vehicle_challans.cancelled_data using the APP's own MySQL connection
 * (models/index.js), not sequelize-cli (config/config.js dialect is wrong).
 *
 * Usage:   node run-challan-cancelled-migration.js          # apply (up)
 *          node run-challan-cancelled-migration.js down      # revert (down)
 *
 * Idempotent — safe to re-run.
 */
require('dotenv').config();
const { Sequelize } = require('sequelize');
const { sequelize } = require('./models');
const migration = require('./migrations/20260713000000-add-challan-cancelled');

const direction = process.argv[2] === 'down' ? 'down' : 'up';

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Connected. Running cancelled-challan migration: ${direction}…`);
    const qi = sequelize.getQueryInterface();
    await migration[direction](qi, Sequelize);
    console.log(`✅ Cancelled-challan migration ${direction} complete.`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Cancelled-challan migration ${direction} failed:`, err.message);
    console.error(err);
    process.exit(1);
  }
})();
