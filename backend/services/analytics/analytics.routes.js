const express = require('express');
const { Op } = require('sequelize');
const Society = require('../../models/Society');
const Apartment = require('../../models/Apartment');
const Lease = require('../../models/Lease');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const Complaint = require('../../models/mongo/Complaint');
const { authenticate, authorize } = require('../../middleware/auth');
const { resolveSocietyScope } = require('../../middleware/tenantScope');

const router = express.Router();
const STAFF_ROLES = ['super_admin', 'property_manager', 'staff'];

router.use(authenticate, authorize(...STAFF_ROLES), resolveSocietyScope);

// ---- Multi-tenant BI: collections vs. spending, one row per society.
// If req.societyId is null (enterprise admin, no ?society_id filter),
// this returns every society side-by-side — the "oversee dozens of
// isolated societies from a single dashboard" requirement. ----
router.get('/portfolio', async (req, res, next) => {
  try {
    const societies = req.societyId
      ? await Society.findAll({ where: { id: req.societyId } })
      : await Society.findAll();

    const rows = await Promise.all(societies.map(async (society) => {
      const apartmentIds = (await Apartment.findAll({ where: { society_id: society.id }, attributes: ['id'] })).map(a => a.id);

      // Invoices/payments join through leases -> apartments, so we filter
      // by apartment ids belonging to this society.
      const leaseIds = (await Lease.findAll({ where: { apartment_id: apartmentIds }, attributes: ['id'] })).map(l => l.id);

      const totalBilled = await Invoice.sum('total_amount', { where: { lease_id: leaseIds } }) || 0;
      const totalCollected = await Payment.sum('amount', {
        where: { status: 'completed' },
        include: [{ model: Invoice, where: { lease_id: leaseIds }, attributes: [] }]
      }) || 0;

      return {
        societyId: society.id,
        societyName: society.name,
        unitCount: apartmentIds.length,
        totalBilled,
        totalCollected,
        collectionRate: totalBilled > 0 ? Number(((totalCollected / totalBilled) * 100).toFixed(1)) : null
      };
    }));

    res.json({ portfolio: rows });
  } catch (err) { next(err); }
});

// ---- SLA compliance snapshot ----
router.get('/sla', async (req, res, next) => {
  try {
    const total = await Complaint.countDocuments({});
    const escalated = await Complaint.countDocuments({ escalated: true });
    const breachedOpen = await Complaint.countDocuments({
      status: { $nin: ['resolved', 'closed'] },
      slaDueAt: { $lt: new Date() }
    });
    res.json({
      totalTickets: total,
      escalatedCount: escalated,
      currentlyBreachedOpen: breachedOpen,
      complianceRate: total > 0 ? Number((((total - escalated) / total) * 100).toFixed(1)) : null
    });
  } catch (err) { next(err); }
});

// ---- "Predictive" maintenance flag ----
// Important honesty note: this is a statistical heuristic, not a trained
// ML model. It flags a category (e.g. "elevator"/"appliance") as at-risk
// when its complaint rate over the trailing window is rising faster than
// a threshold vs. the prior window — a legitimate early-warning signal,
// but not a prediction with a confidence score. Wiring in an actual
// time-series/ML model is future work; this gives committees a real,
// defensible signal today without overclaiming what it is.
router.get('/maintenance-risk', async (req, res, next) => {
  try {
    const now = new Date();
    const windowMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    const recentStart = new Date(now - windowMs);
    const priorStart = new Date(now - 2 * windowMs);

    const categories = ['plumbing', 'electrical', 'security', 'cleaning', 'appliance', 'noise', 'other'];

    const risk = await Promise.all(categories.map(async (category) => {
      const recentCount = await Complaint.countDocuments({ category, createdAt: { $gte: recentStart } });
      const priorCount = await Complaint.countDocuments({ category, createdAt: { $gte: priorStart, $lt: recentStart } });

      let trend = 'stable';
      let changePct = 0;
      if (priorCount > 0) {
        changePct = Number((((recentCount - priorCount) / priorCount) * 100).toFixed(0));
        if (changePct >= 50) trend = 'rising';
        else if (changePct <= -50) trend = 'falling';
      } else if (recentCount > 0) {
        trend = 'new';
      }

      return { category, recentCount, priorCount, changePct, trend, atRisk: trend === 'rising' && recentCount >= 3 };
    }));

    res.json({ windowDays: 30, risk: risk.sort((a, b) => b.recentCount - a.recentCount) });
  } catch (err) { next(err); }
});

module.exports = router;
