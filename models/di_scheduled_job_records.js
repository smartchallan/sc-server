const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DIScheduledJobRecords = sequelize.define('di_scheduled_job_records', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    job_name: { type: DataTypes.STRING, allowNull: false },
    job_status: { type: DataTypes.STRING, allowNull: true },
    job_started_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    job_completed_at: { type: DataTypes.DATE, allowNull: true },
    job_duration: { type: DataTypes.INTEGER, allowNull: true }, // in seconds
  }, {
    tableName: 'di_scheduled_job_records',
    timestamps: false,
    hooks: {
      beforeCreate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.job_started_at) {
          instance.job_started_at = moment.tz(instance.job_started_at, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.job_completed_at) {
          instance.job_completed_at = moment.tz(instance.job_completed_at, 'Asia/Kolkata').utc().toDate();
        }
      },
      beforeUpdate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.job_completed_at) {
          instance.job_completed_at = moment.tz(instance.job_completed_at, 'Asia/Kolkata').utc().toDate();
        }
      }
    }
  });
  return DIScheduledJobRecords;
};
