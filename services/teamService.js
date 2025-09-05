const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const UserModel = require('../models/user');

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

exports.registerTeam = async (data) => {
  // data.password = bcrypt.hashSync(data.password, 10);
  data.role = 'team';
  // if (data.email) data.email = bcrypt.hashSync(data.email, 10);
  return await User.create(data);
};
