const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const UserModel = require('../models/user');
const UserMetaModel = require('../models/user_meta');

const sequelize = new Sequelize(
  process.env.PG_DATABASE || 'driveinnovate',
  process.env.PG_USER || 'postgres',
  process.env.PG_PASSWORD || '',
  {
    host: process.env.PG_HOST || 'localhost',
    dialect: 'postgres',
    logging: false
  }
);
const User = UserModel(sequelize);
const UserMeta = UserMetaModel(sequelize);

exports.getAllClients = async () => {
  return await User.findAll({ where: { role: 'client' } });
};

exports.getClientsByDealer = async (dealer_id) => {
  return await UserMeta.findAll({ where: { dealer_id } });
};

exports.registerClient = async (data) => {
  // data.password = bcrypt.hashSync(data.password, 10);
  data.role = 'client';
  // if (data.email) data.email = bcrypt.hashSync(data.email, 10);
  return await User.create(data);
};
