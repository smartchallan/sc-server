const { DataTypes } = require('sequelize');
const sequelize = require('../config/config').sequelize;

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
  timestamps: false
});

module.exports = DIFailedRecords;
