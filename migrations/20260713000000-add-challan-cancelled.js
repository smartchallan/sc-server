'use strict';

/**
 * Cancelled-challan support.
 *
 * Adds `cancelled_data` (JSON) to di_vehicle_challans. When a challan job re-runs
 * for a vehicle that already has challans, any previously-pending challan number
 * that ULIP no longer returns is moved here, tagged challan_status = 'Cancelled',
 * so the frontend can show it and filter by it.
 *
 * Guarded (checks column existence), so re-running is safe.
 * Apply with:  node run-challan-cancelled-migration.js
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const S = Sequelize;
    const existingTables = (await queryInterface.showAllTables()).map((t) =>
      (typeof t === 'string' ? t : t.tableName).toLowerCase()
    );
    if (!existingTables.includes('di_vehicle_challans')) return;
    const desc = await queryInterface.describeTable('di_vehicle_challans');
    if (!desc.cancelled_data) {
      await queryInterface.addColumn('di_vehicle_challans', 'cancelled_data', { type: S.JSON, allowNull: true });
    }
  },

  down: async (queryInterface) => {
    try { await queryInterface.removeColumn('di_vehicle_challans', 'cancelled_data'); } catch (e) { /* already gone */ }
  },
};
