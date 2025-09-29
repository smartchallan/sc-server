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
    const body = JSON.parse(event.body);
    const { vehicle_number, chasis_number, engine_number, client_id, dealer_id, admin_id } = body;
    if (!client_id || !dealer_id || !admin_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'client_id, dealer_id, and admin_id are required.' }) };
    }
    if (!vehicle_number && !chasis_number && !engine_number) {
      return { statusCode: 400, body: JSON.stringify({ error: 'At least one of vehicle_number, chasis_number, or engine_number is required.' }) };
    }
    const vehicle = await UserVehicleModel.create({
      vehicle_number, chasis_number, engine_number, client_id, dealer_id, admin_id, status: 'active'
    });
    return { statusCode: 201, body: JSON.stringify({ message: 'Vehicle registered successfully', vehicle }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
