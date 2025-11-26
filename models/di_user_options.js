const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DIUserOptions = sequelize.define('di_user_options', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    user_role: { type: DataTypes.STRING, allowNull: false },
    option_key: { type: DataTypes.STRING, allowNull: false },
    option_value: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'di_user_options',
    timestamps: false,
    hooks: {
      beforeCreate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.created_at) {
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
  return DIUserOptions;
};
