const bcrypt = require('bcryptjs');
const { Sequelize, Op } = require('sequelize');
const moment = require('moment-timezone');
const UserModel = require('../models/user');
const UserMetaModel = require('../models/user_meta');

const sequelize = new Sequelize(
  process.env.PG_DATABASE || 'driveinnovate',
  process.env.PG_USER || 'postgres',
  process.env.PG_PASSWORD || '',
  {
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
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

/**
 * Recursively fetch active users whose parent_id matches the provided id.
 * Returns an array of user objects with a `children` array for nested clients.
 */
exports.getClientNetwork = async (parentId) => {
  console.log('Fetching client network for parentId:', parentId);
  const visited = new Set();
  // Use the application's main models to avoid creating a separate DB connection
  const appModels = require('../models');
  const AppUser = appModels.User;
  // Start of the current calendar month in IST, as a UTC Date for the query.
  const monthStart = moment.tz('Asia/Kolkata').startOf('month').utc().toDate();

  const fetchChildren = async (pid) => {
    try {
      if (pid == null) return [];
      if (visited.has(String(pid))) return [];
      visited.add(String(pid));

         const children = await AppUser.findAll({
           where: { parent_id: pid },
           // Exclude role, client_id, dealer_id, admin_id from returned attributes
           attributes: ['id','name','email','status','parent_id','last_login_at','created_at'],
           raw: true
         });

      console.log(`Found ${children.length} children for parent_id ${pid}:`, children.map(c => c.id));

      const AppUserVehicle = appModels.UserVehicle;
      const results = [];
      for (const c of children) {
        const nested = await fetchChildren(c.id);
        // Fetch user_meta for this child (if any) and include as `user_meta`
        let user_meta = null;
        try {
          const AppUserMeta = appModels.UserMeta;
          if (AppUserMeta) {
            user_meta = await AppUserMeta.findOne({ where: { user_id: c.id }, raw: true });
          }
        } catch (metaErr) {
          console.error('Error fetching user_meta for user', c.id, metaErr && metaErr.stack ? metaErr.stack : metaErr);
          user_meta = null;
        }
        // Count this user's own vehicles, split by status. Billable = active +
        // vehicles deleted within the current (calendar) month; vehicles deleted
        // in an earlier month are no longer billed.
        let active_count = 0, deleted_count = 0, deleted_this_month = 0;
        try {
          if (AppUserVehicle) {
            active_count = await AppUserVehicle.count({ where: { client_id: c.id, status: 'active' } });
            deleted_count = await AppUserVehicle.count({ where: { client_id: c.id, status: 'deleted' } });
            deleted_this_month = await AppUserVehicle.count({
              where: { client_id: c.id, status: 'deleted', deleted_at: { [Op.gte]: monthStart } }
            });
          }
        } catch (vErr) {
          console.error('Error counting vehicles for user', c.id, vErr && vErr.stack ? vErr.stack : vErr);
        }
        const billable_count = active_count + deleted_this_month;
        // Build a sanitized object to ensure sensitive/unused fields are not returned
        const item = {
          id: c.id,
          name: c.name,
          email: c.email,
          status: c.status,
          parent_id: c.parent_id,
          last_login_at: c.last_login_at,
          created_at: c.created_at,
          user_meta: user_meta,
          // vehicle_count kept for backward-compat (total own vehicles); the
          // network aggregate on the client sums this field.
          vehicle_count: active_count + deleted_count,
          active_count,
          deleted_count,
          billable_count,
          children: nested
        };
        results.push(item);
      }
      return results;
    } catch (err) {
      console.error('Error fetching children for parent_id', pid, err && err.stack ? err.stack : err);
      throw err;
    }
  };

  // Start with direct children of provided parentId
  return await fetchChildren(parentId);
};
