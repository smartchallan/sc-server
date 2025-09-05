const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserVehicles = sequelize.define('UserVehicles', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    vehicle_no: { type: DataTypes.STRING, allowNull: false },
    chasis_no: { type: DataTypes.STRING },
    imei_no: { type: DataTypes.STRING }
  }, {
    tableName: 'di_user_vehicles',
    timestamps: false
  });
  return UserVehicles;
};
