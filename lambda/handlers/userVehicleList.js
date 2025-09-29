const userVehicleService = require('../../services/userVehicleService');
const UserVehicle = require('../../models/userVehicle');
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.PG_DATABASE, process.env.PG_USER, process.env.PG_PASSWORD, {
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  dialect: 'mysql',
  logging: false,
  dialectOptions: process.env.PG_SSL === 'false' ? { ssl: { require: false, rejectUnauthorized: false } } : {},
});
const UserVehicleModel = UserVehicle(sequelize);

exports.handler = async (event) => {
  try {
    const { admin_id, dealer_id, client_id } = event.queryStringParameters || {};
    const service = userVehicleService(UserVehicleModel);
    const vehicles = await service.getUserVehicles({ admin_id, dealer_id, client_id });
    return { statusCode: 200, body: JSON.stringify({ vehicles }) };
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
  }
};
