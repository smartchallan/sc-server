const { User } = require('../models');

/**
 * Adapter for the ported billing module.
 *
 * The billing service/controller expect `req.user` to carry role + network scope
 * (like DriveInnovate's `validateConsumer`), but SmartChallan's `validateClient`
 * only decodes the JWT into `req.client`. This middleware bridges the gap: it
 * loads the full User for `req.client.id` and attaches the derived
 * `{ role, parentId, clientIds, hasClients }`.
 *
 * Roles (mirrors DriveInnovate, keyed off parent_id):
 *   papa   — top account (parent_id ∈ {0, null})
 *   dealer — has child accounts, parent_id != 0
 *   client — no child accounts
 * `clientIds` (ownership scope) = [self, ...all descendant account ids].
 *
 * Must run AFTER `validateClient` (which populates req.client).
 */

/** BFS to collect every descendant user id under rootId (batched IN-queries). */
const getAllDescendants = async (rootId) => {
  const descendants = [];
  let batch = [rootId];
  while (batch.length > 0) {
    const children = await User.findAll({
      where: { parent_id: batch },
      attributes: ['id'],
      raw: true,
    });
    if (!children.length) break;
    const childIds = children.map((c) => c.id);
    descendants.push(...childIds);
    batch = childIds;
  }
  return descendants;
};

const isTopAccount = (parentId) => parentId == null || Number(parentId) === 0;

const resolveBillingActor = async (req, res, next) => {
  try {
    const userId = req.client?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const user = await User.findOne({
      where: { id: userId },
      attributes: { exclude: ['password'] },
    });
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    let roleData;
    if (isTopAccount(user.parent_id)) {
      const descendants = await getAllDescendants(user.id);
      roleData = { role: 'papa', parentId: user.parent_id, hasClients: true, clientIds: [user.id, ...descendants] };
    } else {
      const childCount = await User.count({ where: { parent_id: user.id } });
      if (childCount > 0) {
        const descendants = await getAllDescendants(user.id);
        roleData = { role: 'dealer', parentId: user.parent_id, hasClients: true, clientIds: [user.id, ...descendants] };
      } else {
        roleData = { role: 'client', parentId: user.parent_id, hasClients: false, clientIds: [user.id] };
      }
    }

    req.user = Object.assign(user, roleData);
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to resolve billing actor' });
  }
};

module.exports = resolveBillingActor;
module.exports.getAllDescendants = getAllDescendants;
