require('dotenv').config();
const { sequelize, connectPostgres } = require('../config/postgres');

/**
 * One-off raw-SQL migrations for constraints Sequelize can't express
 * natively. Run after `npm run seed` (or any time after the tables exist):
 *
 *   npm run migrate
 *
 * Safe to re-run — every statement is idempotent (IF NOT EXISTS / guarded).
 */
async function migrate() {
  await connectPostgres();

  // btree_gist is required for an EXCLUDE constraint over a UUID equality
  // column combined with a range overlap check.
  await sequelize.query(`CREATE EXTENSION IF NOT EXISTS btree_gist;`);

  // Belt-and-braces guarantee against double-booking a facility: even if
  // two requests race past the application-level overlap check in
  // facilities.routes.js at the exact same instant, Postgres itself will
  // reject the second INSERT. tstzrange(start_time, end_time) models each
  // booking as a time range; '&&' is the overlap operator.
  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'facility_bookings_no_overlap'
      ) THEN
        ALTER TABLE facility_bookings
        ADD CONSTRAINT facility_bookings_no_overlap
        EXCLUDE USING gist (
          facility_id WITH =,
          tstzrange(start_time, end_time) WITH &&
        )
        WHERE (status = 'confirmed');
      END IF;
    END $$;
  `);

  console.log('[migrate] facility_bookings_no_overlap constraint ensured');
  process.exit(0);
}

migrate().catch(err => {
  console.error('[migrate] failed:', err.message);
  process.exit(1);
});
