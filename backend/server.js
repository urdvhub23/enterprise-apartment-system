require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const cron = require('node-cron');

const { sequelize, connectPostgres } = require('./config/postgres');
const { connectMongo } = require('./config/mongo');
const errorHandler = require('./middleware/errorHandler');

// Load Postgres models so Sequelize registers associations before sync()
require('./models/Society');
require('./models/User');
require('./models/Apartment');
require('./models/Lease');
require('./models/Invoice');
require('./models/Payment');
require('./models/Facility');
require('./models/FacilityBooking');
require('./models/Visitor');

// Service routers (each = an isolated "microservice" module)
const authRoutes = require('./services/auth/auth.routes');
const tenantsRoutes = require('./services/tenants/tenants.routes');
const billingRoutes = require('./services/billing/billing.routes');
const complaintsRoutes = require('./services/complaints/complaints.routes');
const noticesRoutes = require('./services/complaints/notices.routes');
const chatRoutes = require('./services/complaints/chat.routes');
const notificationsRoutes = require('./services/notifications/notifications.routes');
const facilitiesRoutes = require('./services/facilities/facilities.routes');
const visitorsRoutes = require('./services/visitors/visitors.routes');
const communityRoutes = require('./services/community/community.routes');
const analyticsRoutes = require('./services/analytics/analytics.routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'] }
});
app.set('io', io);

// ---- Global middleware ----
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ---- API Gateway routing: each service is isolated under its own base path ----
app.use('/api/auth', authRoutes);
app.use('/api/property', tenantsRoutes);       // apartments, tenants, leases
app.use('/api/billing', billingRoutes);        // invoices, payments (Postgres)
app.use('/api/complaints', complaintsRoutes);  // maintenance tickets (Mongo)
app.use('/api/notices', noticesRoutes);        // announcements (Mongo)
app.use('/api/chat', chatRoutes);               // support chat (Mongo)
app.use('/api/notifications', notificationsRoutes); // notification feed (Mongo)
app.use('/api/facilities', facilitiesRoutes);   // clubhouse/court bookings (Postgres)
app.use('/api/visitors', visitorsRoutes);       // QR gate access + offline sync (Postgres)
app.use('/api/community', communityRoutes);     // moderated discussion board (Mongo)
app.use('/api/analytics', analyticsRoutes);     // BI dashboards, SLA, risk flags

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

// ---- Realtime chat namespace ----
io.on('connection', (socket) => {
  socket.on('chat:join', (threadId) => socket.join(threadId));
  socket.on('chat:leave', (threadId) => socket.leave(threadId));
  socket.on('disconnect', () => {});
});

// ---- Scheduled job: flag overdue invoices daily at 06:00 ----
cron.schedule('0 6 * * *', async () => {
  try {
    const Invoice = require('./models/Invoice');
    const { Op } = require('sequelize');
    const [count] = await Invoice.update(
      { status: 'overdue' },
      { where: { status: 'issued', due_date: { [Op.lt]: new Date() } } }
    );
    console.log(`[cron] marked ${count} invoice(s) overdue`);
  } catch (err) {
    console.error('[cron] overdue-invoice job failed:', err.message);
  }
});

// ---- Scheduled job: escalate complaints that breached their SLA ----
// Runs every 15 minutes — SLAs can be as tight as 4 hours (security), so a
// once-a-day check like the invoice job above would be too coarse here.
cron.schedule('*/15 * * * *', async () => {
  try {
    const Complaint = require('./models/mongo/Complaint');
    const { notifyUser } = require('./services/notifications/notifications.service');

    const breached = await Complaint.find({
      status: { $nin: ['resolved', 'closed'] },
      escalated: false,
      slaDueAt: { $lt: new Date() }
    });

    for (const complaint of breached) {
      complaint.escalated = true;
      complaint.escalationLevel = 1;
      complaint.escalatedAt = new Date();
      await complaint.save();

      // Notify the assigned staff member if any, otherwise this shows up
      // in the committee's /api/complaints/escalated view regardless.
      if (complaint.assignedStaffId) {
        await notifyUser(complaint.assignedStaffId, {
          channel: 'push',
          type: 'complaint_update',
          title: 'SLA breached — escalated',
          body: `"${complaint.title}" missed its ${complaint.slaHours}h SLA and was escalated to the committee.`,
          metadata: { complaintId: complaint._id }
        });
      }
    }

    if (breached.length > 0) console.log(`[cron] escalated ${breached.length} SLA-breached complaint(s)`);
  } catch (err) {
    console.error('[cron] SLA-escalation job failed:', err.message);
  }
});

const PORT = process.env.PORT || 5000;

async function start() {
  await connectPostgres();
  await connectMongo();

  // In development, sync schema automatically. In production use migrations (see scripts/migrate.js).
  if (process.env.NODE_ENV !== 'production') {
    await sequelize.sync({ alter: true });
    console.log('[postgres] models synced');
  }

  server.listen(PORT, () => {
    console.log(`API gateway listening on port ${PORT}`);
  });
}

start();

module.exports = { app, server, io };
