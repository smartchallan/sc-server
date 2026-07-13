const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleChallan = sequelize.define('VehicleChallan', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    vehicle_number: { type: DataTypes.STRING(32), allowNull: false },
    client_id: { type: DataTypes.INTEGER, allowNull: false },
    pending_data: { type: DataTypes.JSON, allowNull: true },
    disposed_data: { type: DataTypes.JSON, allowNull: true },
    // Challans that were previously pending but are no longer returned by ULIP
    // (cancelled/withdrawn at source). Each object is tagged challan_status:'Cancelled'.
    cancelled_data: { type: DataTypes.JSON, allowNull: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'di_vehicle_challans',
    timestamps: false,
    hooks: {
      beforeCreate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.created_at) {
          // Interpret as IST, store as UTC
          instance.created_at = moment.tz(instance.created_at, 'Asia/Kolkata').utc().toDate();
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
  return VehicleChallan;
};
