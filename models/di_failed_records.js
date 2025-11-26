const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DIFailedRecords = sequelize.define('di_failed_records', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    user_role: { type: DataTypes.STRING, allowNull: false },
    failed_request_name: { type: DataTypes.STRING, allowNull: false },
    failed_request_data: { type: DataTypes.JSONB, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'failed' },
    retry_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    record_failed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    record_success_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'di_failed_records',
    timestamps: false,
    hooks: {
      beforeCreate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.record_failed_at) {
          instance.record_failed_at = moment.tz(instance.record_failed_at, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.record_success_at) {
          instance.record_success_at = moment.tz(instance.record_success_at, 'Asia/Kolkata').utc().toDate();
        }
      },
      beforeUpdate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.record_success_at) {
          instance.record_success_at = moment.tz(instance.record_success_at, 'Asia/Kolkata').utc().toDate();
        }
      }
    }
  });
  return DIFailedRecords;
};
