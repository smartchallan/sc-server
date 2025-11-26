const { Sequelize, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserVehicle = sequelize.define('UserVehicle', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    vehicle_number: { type: DataTypes.STRING, allowNull: true },
    chasis_number: { type: DataTypes.STRING, allowNull: true },
    engine_number: { type: DataTypes.STRING, allowNull: true },
    client_id: { type: DataTypes.INTEGER, allowNull: false },
    dealer_id: { type: DataTypes.INTEGER, allowNull: false },
    admin_id: { type: DataTypes.INTEGER, allowNull: false },
    registered_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'deleted'),
      allowNull: false,
      defaultValue: 'active'
    },
    rto_data: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    challan_data: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'di_user_vehicle',
    timestamps: false,
    hooks: {
      beforeCreate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.registered_at) {
          instance.registered_at = moment.tz(instance.registered_at, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.updated_at) {
          instance.updated_at = moment.tz(instance.updated_at, 'Asia/Kolkata').utc().toDate();
        }
      },
      beforeUpdate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.updated_at) {
          instance.updated_at = moment.tz(instance.updated_at, 'Asia/Kolkata').utc().toDate();
        }
      }
    }
  });
  return UserVehicle;
};
