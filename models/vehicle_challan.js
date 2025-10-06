const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleChallan = sequelize.define('VehicleChallan', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    vehicle_number: { type: DataTypes.STRING(32), allowNull: false },
    client_id: { type: DataTypes.INTEGER, allowNull: false },
    pending_data: { type: DataTypes.JSON, allowNull: true },
    disposed_data: { type: DataTypes.JSON, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'di_vehicle_challans',
    timestamps: false
  });
  return VehicleChallan;
};
