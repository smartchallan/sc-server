const { fetchAdminData } = require('../../services/adminDataService');
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.PG_DATABASE, process.env.PG_USER, process.env.PG_PASSWORD, {
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  dialect: 'mysql',
  logging: false,
  dialectOptions: process.env.PG_SSL === 'false' ? {
    ssl: { require: false, rejectUnauthorized: false }
  } : {},
});
const User = require('../../models/user')(sequelize);
const UserMeta = require('../../models/user_meta')(sequelize);
const UserVehicle = require('../../models/userVehicle')(sequelize);

exports.handler = async (event) => {
  try {
    const admin_id = event.pathParameters?.admin_id;
    if (!admin_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'admin_id is required as a path parameter' }),
      };
    }
    const models = { User, UserMeta, UserVehicle };
    const data = await fetchAdminData(models, admin_id);
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
