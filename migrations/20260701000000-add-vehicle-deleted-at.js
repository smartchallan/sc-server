'use strict';

// Add a dedicated deleted_at timestamp to di_user_vehicle so we can show when a
// vehicle was deleted and compute "billable this month". Existing deleted rows
// are backfilled from updated_at (best-effort — the closest proxy available).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('di_user_vehicle', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
      comment: 'When the vehicle was moved to deleted status (null while active)'
    });
    await queryInterface.sequelize.query(
      "UPDATE di_user_vehicle SET deleted_at = updated_at WHERE status = 'deleted' AND deleted_at IS NULL"
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('di_user_vehicle', 'deleted_at');
  }
};
