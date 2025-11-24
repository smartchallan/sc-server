const { Op } = require('sequelize');

async function fetchAdminData(models, adminId) {
  const { User, UserMeta, UserVehicle, VehicleRTOData, VehicleChallan } = models;
  // Fetch all dealers for the admin, include meta info
  const dealers = await User.findAll({
    where: { role: 'dealer', admin_id: adminId },
    attributes: { exclude: ['password'] },
    include: [{ model: UserMeta, as: 'meta', required: false }]
  });

  // Fetch admin user and meta
  const admin = await User.findOne({
    where: { id: adminId, role: 'admin' },
    attributes: { exclude: ['password'] },
    include: [{ model: UserMeta, as: 'meta', required: false }]
  });

  // Fetch all clients for the admin, include meta info
  const clientsRaw = await User.findAll({
    where: { role: 'client', admin_id: adminId },
    attributes: { exclude: ['password'] },
    include: [{ model: UserMeta, as: 'meta', required: false }]
  });

  // For each client, fetch vehicle counts by status
  const clients = await Promise.all(clientsRaw.map(async (client) => {
    const active = await UserVehicle.count({ where: { client_id: client.id, status: 'active' } });
    const inactive = await UserVehicle.count({ where: { client_id: client.id, status: 'inactive' } });
    const deleted = await UserVehicle.count({ where: { client_id: client.id, status: 'deleted' } });
    return {
      ...client.toJSON(),
      vehicle_counts: {
        active,
        inactive,
        deleted,
        total: active + inactive + deleted
      }
    };
  }));

  return {
    admin,
    dealers,
    clients
  };
}

module.exports = fetchAdminData;
module.exports.default = fetchAdminData;
