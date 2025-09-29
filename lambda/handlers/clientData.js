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
const UserVehicle = require('../../models/userVehicle')(sequelize);

exports.handler = async (event) => {
  try {
    const client_id = event.pathParameters?.client_id;
    if (!client_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'client_id is required as a path parameter' }),
      };
    }
    const vehicles = await UserVehicle.findAll({ where: { client_id } });
    return {
      statusCode: 200,
      body: JSON.stringify({ client_id, vehicles }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
