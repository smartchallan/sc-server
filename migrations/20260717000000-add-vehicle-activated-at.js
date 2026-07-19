'use strict';

// Add a dedicated activated_at timestamp to di_user_vehicle so activation is
// captured explicitly: set on registration and re-stamped on every restore
// (registered_at never changes). Existing rows are backfilled from
// registered_at (best-effort — the closest proxy available).
//
// Guarded (checks column existence), so re-running is safe.
// Apply with:  node run-vehicle-activated-at-migration.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('di_user_vehicle');
    if (!desc.activated_at) {
      await queryInterface.addColumn('di_user_vehicle', 'activated_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
        comment: 'When the vehicle last became active (registration or restore)'
      });
    }
    await queryInterface.sequelize.query(
      'UPDATE di_user_vehicle SET activated_at = registered_at WHERE activated_at IS NULL'
    );
  },

  down: async (queryInterface) => {
    try { await queryInterface.removeColumn('di_user_vehicle', 'activated_at'); } catch (e) { /* already gone */ }
  }
};
