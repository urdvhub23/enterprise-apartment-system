const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const User = require('../../models/User');
const Apartment = require('../../models/Apartment');
const Lease = require('../../models/Lease');
const { authenticate, authorize } = require('../../middleware/auth');

const router = express.Router();
const STAFF_ROLES = ['super_admin', 'property_manager', 'staff'];

// ---- Apartments ----
router.get('/apartments', authenticate, async (req, res, next) => {
  try {
    const { status, building } = req.query;
    const where = {};
    if (status) where.status = status;
    if (building) where.building_name = building;
    const apartments = await Apartment.findAll({ where, order: [['building_name', 'ASC'], ['unit_number', 'ASC']] });
    res.json({ apartments });
  } catch (err) { next(err); }
});

router.post(
  '/apartments',
  authenticate, authorize(...STAFF_ROLES),
  [
    body('building_name').notEmpty(),
    body('unit_number').notEmpty(),
    body('monthly_rent').isFloat({ gt: 0 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const apartment = await Apartment.create(req.body);
      res.status(201).json({ apartment });
    } catch (err) { next(err); }
  }
);

router.patch('/apartments/:id', authenticate, authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const apartment = await Apartment.findByPk(req.params.id);
    if (!apartment) return res.status(404).json({ error: 'Apartment not found' });
    await apartment.update(req.body);
    res.json({ apartment });
  } catch (err) { next(err); }
});

// ---- Tenants (users with role=tenant) ----
router.get('/tenants', authenticate, authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = { role: 'tenant' };
    if (search) {
      where[Op.or] = [
        { full_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }
    const tenants = await User.findAll({
      where,
      attributes: ['id', 'full_name', 'email', 'phone', 'is_active', 'last_login_at']
    });
    res.json({ tenants });
  } catch (err) { next(err); }
});

// ---- Leases ----
router.get('/leases', authenticate, async (req, res, next) => {
  try {
    const where = {};
    // tenants can only see their own leases
    if (req.user.role === 'tenant') where.tenant_id = req.user.id;
    const leases = await Lease.findAll({
      where,
      include: [
        { model: User, as: 'tenant', attributes: ['id', 'full_name', 'email'] },
        { model: Apartment, as: 'apartment' }
      ],
      order: [['start_date', 'DESC']]
    });
    res.json({ leases });
  } catch (err) { next(err); }
});

router.post(
  '/leases',
  authenticate, authorize(...STAFF_ROLES),
  [
    body('tenant_id').isUUID(),
    body('apartment_id').isUUID(),
    body('start_date').isISO8601(),
    body('end_date').isISO8601(),
    body('monthly_rent').isFloat({ gt: 0 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const apartment = await Apartment.findByPk(req.body.apartment_id);
      if (!apartment) return res.status(404).json({ error: 'Apartment not found' });

      const lease = await Lease.create({ ...req.body, status: 'active' });
      apartment.status = 'occupied';
      await apartment.save();

      res.status(201).json({ lease });
    } catch (err) { next(err); }
  }
);

router.patch('/leases/:id/terminate', authenticate, authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const lease = await Lease.findByPk(req.params.id);
    if (!lease) return res.status(404).json({ error: 'Lease not found' });
    lease.status = 'terminated';
    await lease.save();

    const apartment = await Apartment.findByPk(lease.apartment_id);
    if (apartment) { apartment.status = 'vacant'; await apartment.save(); }

    res.json({ lease });
  } catch (err) { next(err); }
});

module.exports = router;
