'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('di_user_vehicle', 'rto_data', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indicates if RTO data has been fetched for this vehicle'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('di_user_vehicle', 'rto_data');
  }
};