'use strict';

// Collapse vehicle status to only 'active' and 'deleted'.
// 1. Move every 'inactive' vehicle to 'deleted'.
// 2. Shrink the ENUM definition so 'inactive' is no longer a valid value.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1 — migrate data while 'inactive' is still a valid enum value.
    await queryInterface.sequelize.query(
      "UPDATE di_user_vehicle SET status = 'deleted' WHERE status = 'inactive'"
    );
    // Step 2 — redefine the column with the reduced enum set.
    await queryInterface.changeColumn('di_user_vehicle', 'status', {
      type: Sequelize.ENUM('active', 'deleted'),
      allowNull: false,
      defaultValue: 'active'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Re-add 'inactive' to the enum. Data that was migrated to 'deleted'
    // cannot be reliably distinguished afterwards, so it stays 'deleted'.
    await queryInterface.changeColumn('di_user_vehicle', 'status', {
      type: Sequelize.ENUM('active', 'inactive', 'deleted'),
      allowNull: false,
      defaultValue: 'active'
    });
  }
};
