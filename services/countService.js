const { Sequelize } = require('sequelize');
const UserModel = require('../models/user');
const UserVehiclesModel = require('../models/user_vehicles');

const sequelize = new Sequelize(
  process.env.PG_DATABASE || 'driveinnovate',
  process.env.PG_USER || 'postgres',
  process.env.PG_PASSWORD || '',
  {
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);
const User = UserModel(sequelize);
const UserVehicles = UserVehiclesModel(sequelize);

exports.getDealerCount = async (admin_id) => {
    console.log('admin_id in getDealerCount service:', admin_id);
  return await User.count({ where: { role: 'dealer', admin_id } });
};

exports.getClientCount = async (admin_id) => {
  return await User.count({ where: { role: 'client', admin_id } });
};

exports.getVehicleCount = async () => {
  return await UserVehicles.count();
};
