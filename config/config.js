require('dotenv').config();

module.exports = {
  development: {
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'maavinappstg',
    host: process.env.PG_HOST || '127.0.0.1',
    port: process.env.PG_PORT || 5432, // Rollback to PostgreSQL default port
    dialect: 'postgres', // Rollback to PostgreSQL dialect
    logging: false
  },
  production: {
    username: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    host: process.env.PG_HOST,
    port: process.env.PG_PORT || 5432, // Rollback to PostgreSQL default port
    dialect: 'postgres', // Rollback to PostgreSQL dialect
    logging: false
  }
};
