const { Sequelize } = require('sequelize');
const UserModel = require('./user');
const UserMetaModel = require('./user_meta');
// ...add other models as needed...

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
// ...initialize other models...

module.exports = {
  sequelize,
  User,
  UserMeta,
  // ...export other models...
};
