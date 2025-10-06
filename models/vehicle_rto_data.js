const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleRTOData = sequelize.define('VehicleRTOData', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    vehicle_number: { type: DataTypes.STRING(32), allowNull: false },
    client_id: { type: DataTypes.INTEGER, allowNull: false },
    rto_data: { type: DataTypes.JSON, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'di_vehicle_rto_data',
    timestamps: false
  });
  return VehicleRTOData;
};
