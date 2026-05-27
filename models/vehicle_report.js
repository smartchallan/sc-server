const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleReport = sequelize.define('di_vehicle_reports', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    client_id: { type: DataTypes.INTEGER, allowNull: false },
    dealer_id: { type: DataTypes.INTEGER, allowNull: false },
    vehicle_number: { type: DataTypes.STRING(20), allowNull: false },
    rto_data: { type: DataTypes.TEXT('long'), allowNull: true, get() { const v = this.getDataValue('rto_data'); try { return v ? JSON.parse(v) : null; } catch { return null; } }, set(v) { this.setDataValue('rto_data', v ? JSON.stringify(v) : null); } },
    challan_data: { type: DataTypes.TEXT('long'), allowNull: true, get() { const v = this.getDataValue('challan_data'); try { return v ? JSON.parse(v) : null; } catch { return null; } }, set(v) { this.setDataValue('challan_data', v ? JSON.stringify(v) : null); } },
    rto_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'not_fetched' },
    challan_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'not_fetched' },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
    generated_at: { type: DataTypes.DATE, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'di_vehicle_reports',
    timestamps: false,
  });
  return VehicleReport;
};
