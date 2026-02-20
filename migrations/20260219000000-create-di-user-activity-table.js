'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('di_user_activity', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      client_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      action_type: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('di_user_activity', ['client_id'], {
      name: 'idx_client_id'
    });

    await queryInterface.addIndex('di_user_activity', ['action_type'], {
      name: 'idx_action_type'
    });

    await queryInterface.addIndex('di_user_activity', ['created_at'], {
      name: 'idx_created_at'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('di_user_activity');
  }
};
