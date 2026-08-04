const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/postgres');
const Facility = require('../../models/Facility');
const FacilityBooking = require('../../models/FacilityBooking');
const User = require('../../models/User');
const { authenticate, authorize } = require('../../middleware/auth');
const { resolveSocietyScope } = require('../../middleware/tenantScope');

const router = express.Router();
const STAFF_ROLES = ['super_admin', 'property_manager', 'staff'];

router.use(authenticate, resolveSocietyScope);

// ---- Facilities ----
router.get('/', async (req, res, next) => {
  try {
    const facilities = await Facility.findAll({ where: { society_id: req.societyId, is_active: true } });
    res.json({ facilities });
  } catch (err) { next(err); }
});

router.post(
  '/',
  authorize(...STAFF_ROLES),
  [body('name').notEmpty(), body('category').isIn(['clubhouse', 'court', 'pool', 'gym', 'hall', 'other'])],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const facility = await Facility.create({ ...req.body, society_id: req.societyId });
      res.status(201).json({ facility });
    } catch (err) { next(err); }
  }
);

// ---- Bookings ----
router.get('/:facilityId/bookings', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { facility_id: req.params.facilityId, status: 'confirmed' };
    if (from && to) where.start_time = { [Op.between]: [new Date(from), new Date(to)] };

    const bookings = await FacilityBooking.findAll({
      where,
      include: [{ model: User, as: 'resident', attributes: ['id', 'full_name'] }],
      order: [['start_time', 'ASC']]
    });
    res.json({ bookings });
  } catch (err) { next(err); }
});

router.post(
  '/:facilityId/bookings',
  [
    body('start_time').isISO8601(),
    body('end_time').isISO8601()
  ],
  async (req, res, next) => {
    // Application-layer overlap check + DB transaction with a row lock on
    // the facility to prevent a race between two concurrent booking
    // requests for the same slot. The migration also adds a Postgres
    // EXCLUDE constraint as a belt-and-braces guarantee (see
    // models/FacilityBooking.js comment + scripts/migrate.js).
    const t = await sequelize.transaction();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) { await t.rollback(); return res.status(400).json({ errors: errors.array() }); }

      const { facilityId } = req.params;
      const { start_time, end_time, notes } = req.body;

      if (new Date(start_time) >= new Date(end_time)) {
        await t.rollback();
        return res.status(400).json({ error: 'start_time must be before end_time' });
      }

      const facility = await Facility.findByPk(facilityId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!facility) { await t.rollback(); return res.status(404).json({ error: 'Facility not found' }); }

      const overlap = await FacilityBooking.findOne({
        where: {
          facility_id: facilityId,
          status: 'confirmed',
          start_time: { [Op.lt]: end_time },
          end_time: { [Op.gt]: start_time }
        },
        transaction: t
      });
      if (overlap) {
        await t.rollback();
        return res.status(409).json({ error: 'This slot overlaps an existing booking. Pick a different time.' });
      }

      const booking = await FacilityBooking.create({
        facility_id: facilityId,
        resident_id: req.user.id,
        start_time, end_time, notes
      }, { transaction: t });

      await t.commit();
      res.status(201).json({ booking });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  }
);

router.patch('/bookings/:id/cancel', async (req, res, next) => {
  try {
    const booking = await FacilityBooking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.resident_id !== req.user.id && !['super_admin', 'property_manager', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You can only cancel your own bookings' });
    }
    booking.status = 'cancelled';
    await booking.save();
    res.json({ booking });
  } catch (err) { next(err); }
});

module.exports = router;
