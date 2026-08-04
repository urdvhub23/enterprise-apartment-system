require('dotenv').config();
const { sequelize, connectPostgres } = require('../config/postgres');

async function sync() {
  require('../models/Society');
  require('../models/User');
  require('../models/Apartment');
  require('../models/Lease');
  require('../models/Invoice');
  require('../models/Payment');
  require('../models/Facility');
  require('../models/FacilityBooking');
  require('../models/Visitor');

  await connectPostgres();
  await sequelize.sync({ alter: true });
  console.log('[db-sync] Postgres schema synced');
  process.exit(0);
}

sync().catch(err => {
  console.error('[db-sync] failed:', err.message);
  process.exit(1);
});
