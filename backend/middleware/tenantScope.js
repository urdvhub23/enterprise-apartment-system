const User = require('../models/User');

/**
 * Resolves req.societyId for multi-tenant scoping.
 * - Regular users (property_manager/staff/tenant) are pinned to their own society.
 * - super_admin with no society_id is treated as an enterprise admin and may
 *   pass ?society_id=<uuid> to view a specific society, or omit it to get
 *   cross-society aggregate views (used by the analytics/BI routes).
 */
async function resolveSocietyScope(req, res, next) {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'role', 'society_id'] });
    if (!user) return res.status(401).json({ error: 'User not found' });

    if (user.society_id) {
      req.societyId = user.society_id;
      req.isEnterpriseAdmin = false;
    } else if (user.role === 'super_admin') {
      req.societyId = req.query.society_id || null; // null = cross-society view
      req.isEnterpriseAdmin = true;
    } else {
      return res.status(403).json({ error: 'Account is not assigned to a society' });
    }
    next();
  } catch (err) { next(err); }
}

module.exports = { resolveSocietyScope };
