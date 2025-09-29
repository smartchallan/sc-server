const UserVehicleRtoData = require('../../models/userVehicleRtoData');
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

exports.handler = async (event) => {
  try {
    const vehicle_number = event.pathParameters?.vehicle_number;
    if (!vehicle_number) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'vehicle_number is required as a path parameter' }),
      };
    }
    const UserVehicleRtoDataModel = UserVehicleRtoData(sequelize);
    const rtoData = await UserVehicleRtoDataModel.findOne({ where: { vehicle_number } });
    if (!rtoData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No RTO data found for this vehicle number' }),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify(rtoData),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
