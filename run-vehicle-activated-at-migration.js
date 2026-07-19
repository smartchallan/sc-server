/**
 * Standalone runner for the vehicle activated_at migration.
 *
 * Adds di_user_vehicle.activated_at using the APP's own MySQL connection
 * (models/index.js), not sequelize-cli (config/config.js dialect is wrong).
 *
 * Usage:   node run-vehicle-activated-at-migration.js          # apply (up)
 *          node run-vehicle-activated-at-migration.js down     # revert (down)
 *
 * Idempotent — safe to re-run.
 */
require('dotenv').config();
const { Sequelize } = require('sequelize');
const { sequelize } = require('./models');
const migration = require('./migrations/20260717000000-add-vehicle-activated-at');

const direction = process.argv[2] === 'down' ? 'down' : 'up';

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Connected. Running vehicle activated_at migration: ${direction}…`);
    const qi = sequelize.getQueryInterface();
    await migration[direction](qi, Sequelize);
    console.log(`✅ Vehicle activated_at migration ${direction} complete.`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Vehicle activated_at migration ${direction} failed:`, err.message);
    console.error(err);
    process.exit(1);
  }
})();
