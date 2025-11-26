const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserBilling = sequelize.define('UserBilling', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    user_type: { type: DataTypes.STRING(20), allowNull: false },
    billing_type: { type: DataTypes.ENUM('postpaid', 'prepaid'), allowNull: false },
    cost_per_month_per_vehicle: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
    cost_per_challan_request: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
    billing_plan_status: { type: DataTypes.ENUM('active', 'inactive', 'expired'), defaultValue: 'active' },
    created_dt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    plan_start_dt: { type: DataTypes.DATE, allowNull: true },
    plan_end_dt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'di_user_billing',
    timestamps: false,
    hooks: {
      beforeCreate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.created_dt) {
          instance.created_dt = moment.tz(instance.created_dt, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.plan_start_dt) {
          instance.plan_start_dt = moment.tz(instance.plan_start_dt, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.plan_end_dt) {
          instance.plan_end_dt = moment.tz(instance.plan_end_dt, 'Asia/Kolkata').utc().toDate();
        }
      },
      beforeUpdate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.plan_start_dt) {
          instance.plan_start_dt = moment.tz(instance.plan_start_dt, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.plan_end_dt) {
          instance.plan_end_dt = moment.tz(instance.plan_end_dt, 'Asia/Kolkata').utc().toDate();
        }
      }
    }
  });

  return UserBilling;
};
