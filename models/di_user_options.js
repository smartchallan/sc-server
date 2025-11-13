const { DataTypes } = require('sequelize');
const sequelize = require('../config/config').sequelize;

const DIUserOptions = sequelize.define('di_user_options', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  user_role: { type: DataTypes.STRING, allowNull: false },
  option_key: { type: DataTypes.STRING, allowNull: false },
  option_value: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'di_user_options',
  timestamps: false
});

module.exports = DIUserOptions;
