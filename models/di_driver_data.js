const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DiDriverData = sequelize.define('di_driver_data', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    license_no: { type: DataTypes.STRING, allowNull: false },
    dob: { type: DataTypes.DATE, allowNull: true },
    details: { type: DataTypes.JSON, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'di_driver_data',
    timestamps: false,
  });

  return DiDriverData;
};
