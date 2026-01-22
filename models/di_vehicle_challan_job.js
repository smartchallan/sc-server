const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DiVehicleChallanJob = sequelize.define('DiVehicleChallanJob', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    vehicle_number: { type: DataTypes.STRING(32), allowNull: false },
    client_id: { type: DataTypes.INTEGER, allowNull: false },
    challan_number: { type: DataTypes.STRING(128), allowNull: true },
    challan_data: { type: DataTypes.JSON, allowNull: true },
    challan_status: { type: DataTypes.STRING(32), allowNull: true },
    challan_issued_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'di_vehicle_challan_job',
    timestamps: false,
    hooks: {
      beforeCreate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.challan_issued_at) {
          instance.challan_issued_at = moment.tz(instance.challan_issued_at, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.created_at) {
          instance.created_at = moment.tz(instance.created_at, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.updated_at) {
          instance.updated_at = moment.tz(instance.updated_at, 'Asia/Kolkata').utc().toDate();
        }
      },
      beforeUpdate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.challan_issued_at) {
          instance.challan_issued_at = moment.tz(instance.challan_issued_at, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.updated_at) {
          instance.updated_at = moment.tz(instance.updated_at, 'Asia/Kolkata').utc().toDate();
        }
      }
    }
  });

  return DiVehicleChallanJob;
};
