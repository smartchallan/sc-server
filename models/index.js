const { Sequelize } = require('sequelize');
const UserModel = require('./user');
const UserMetaModel = require('./user_meta');
const UserVehicleModel = require('./userVehicle');
const UserVehiclesModel = require('./user_vehicles');
const UserSettingsModel = require('./user_settings');
const UserVehicleRtoDataModel = require('./userVehicleRtoData');
const VehicleRTODataModel = require('./vehicle_rto_data');
const VehicleChallanModel = require('./vehicle_challan');
const UserBillingModel = require('./user_billing');

require('dotenv').config();

const sequelize = new Sequelize(
  process.env.PG_DATABASE,
  process.env.PG_USER,
  process.env.PG_PASSWORD,
  {
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    dialect: 'mysql',
    logging: false,
    dialectOptions: process.env.PG_SSL === 'false' ? {
      ssl: {
        require: false,
        rejectUnauthorized: false,
      }
    } : {},
  }
);

const User = UserModel(sequelize);
const UserMeta = UserMetaModel(sequelize);
const UserVehicle = UserVehicleModel(sequelize);
const UserVehicles = UserVehiclesModel(sequelize);
const UserSettings = UserSettingsModel(sequelize);
const UserVehicleRtoData = UserVehicleRtoDataModel(sequelize);
const VehicleRTOData = VehicleRTODataModel(sequelize);
const VehicleChallan = VehicleChallanModel(sequelize);
const UserBilling = UserBillingModel(sequelize);

module.exports = {
  sequelize,
  User,
  UserMeta,
  UserVehicle,
  UserVehicles,
  UserSettings,
  UserVehicleRtoData,
  VehicleRTOData,
  VehicleChallan,
  UserBilling,
};
