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
  // Subscription "expiring soon" cutoff (actual expiry within the warn window).
  const WARN_DAYS = parseInt(process.env.EXPIRY_WARN_DAYS, 10) || 7;
  const expiryCutoff = moment.tz('Asia/Kolkata').add(WARN_DAYS, 'days').endOf('day').utc().toDate();

  const fetchChildren = async (pid) => {
    try {
      if (pid == null) return [];
      if (visited.has(String(pid))) return [];
      visited.add(String(pid));

         const children = await AppUser.findAll({
           where: { parent_id: pid },
           // Exclude role, client_id, dealer_id, admin_id from returned attributes
           attributes: ['id','name','email','status','parent_id','last_login_at','created_at','grace_days','account_type','billing_type'],
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
        // Count this user's OWN vehicles, split by status. Billable = active +
        // vehicles deleted within the current (calendar) month; vehicles deleted
        // in an earlier month are no longer billed.
        let own_active = 0, own_deleted = 0, own_deleted_this_month = 0, own_expiring = 0;
        try {
          if (AppUserVehicle) {
            own_active = await AppUserVehicle.count({ where: { client_id: c.id, status: 'active' } });
            own_deleted = await AppUserVehicle.count({ where: { client_id: c.id, status: 'deleted' } });
            own_deleted_this_month = await AppUserVehicle.count({
              where: { client_id: c.id, status: 'deleted', deleted_at: { [Op.gte]: monthStart } }
            });
            // Active vehicles whose subscription expiry falls within the warn window.
            own_expiring = await AppUserVehicle.count({
              where: { client_id: c.id, status: 'active', subscription_expires_at: { [Op.ne]: null, [Op.lte]: expiryCutoff } }
            });
          }
        } catch (vErr) {
          console.error('Error counting vehicles for user', c.id, vErr && vErr.stack ? vErr.stack : vErr);
        }
        const own_billable = own_active + own_deleted_this_month;
        // Aggregate across the whole downstream network (to the nth level): a
        // dealer's counts include every sub-client's vehicles. `nested` items
        // already carry their own aggregated totals, so we just add them up.
        const sumChild = (key) => nested.reduce((s, ch) => s + (Number(ch[key]) || 0), 0);
        const active_count = own_active + sumChild('active_count');
        const deleted_count = own_deleted + sumChild('deleted_count');
        const billable_count = own_billable + sumChild('billable_count');
        const expiring_count = own_expiring + sumChild('expiring_count');
        // Build a sanitized object to ensure sensitive/unused fields are not returned
        const item = {
          id: c.id,
          name: c.name,
          email: c.email,
          status: c.status,
          parent_id: c.parent_id,
          last_login_at: c.last_login_at,
          created_at: c.created_at,
          grace_days: c.grace_days,
          account_type: c.account_type,
          billing_type: c.billing_type,
          user_meta: user_meta,
          // Own (non-aggregated) total, kept for the client-side network tooltip.
          vehicle_count: own_active + own_deleted,
          // Aggregated across the full sub-network (own + all descendants).
          active_count,
          deleted_count,
          billable_count,
          own_expiring,
          expiring_count,
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
