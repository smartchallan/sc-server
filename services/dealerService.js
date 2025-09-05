const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const UserModel = require('../models/user');

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

const UserMetaModel = require('../models/user_meta');
const UserMeta = UserMetaModel(sequelize);

exports.getAllDealers = async (admin_id) => {
  // Fetch all dealers for the given admin_id
  const dealers = await User.findAll({
    where: { role: 'dealer' },
    raw: true
  });

  // Fetch meta data for all dealer ids
  const dealerIds = dealers.map(d => d.id);
  const metaList = await UserMeta.findAll({
    where: { user_id: dealerIds },
    raw: true
  });

  // Combine dealer and meta data
  const combined = dealers.map(dealer => {
    const meta = metaList.find(m => m.user_id === dealer.id) || {};
    return { ...dealer, meta };
  });

  return {
    count: combined.length,
    dealers: combined
  };
};


