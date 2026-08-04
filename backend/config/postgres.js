const { Sequelize } = require('sequelize');
require('dotenv').config();

// PostgreSQL handles all ACID-critical, strictly-relational data:
// users/auth, apartments, leases, invoices, payments/ledger entries.
const sequelize = new Sequelize(
  process.env.PG_DATABASE,
  process.env.PG_USER,
  process.env.PG_PASSWORD,
  {
    host: process.env.PG_HOST,
    port: process.env.PG_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    define: { underscored: true, timestamps: true }
  }
);

async function connectPostgres() {
  try {
    await sequelize.authenticate();
    console.log('[postgres] connection established');
  } catch (err) {
    console.error('[postgres] unable to connect:', err.message);
    process.exit(1);
  }
}

module.exports = { sequelize, connectPostgres };
