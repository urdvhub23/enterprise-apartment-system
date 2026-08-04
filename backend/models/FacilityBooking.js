const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/postgres');
const Facility = require('./Facility');
const User = require('./User');

// Double-booking prevention happens at TWO layers, deliberately:
// 1. Application layer (facilities.routes.js) checks for overlap before
//    insert and returns a friendly 409 error.
// 2. Database layer: a Postgres EXCLUDE constraint (added via raw SQL in
//    scripts/migrate.js, since Sequelize doesn't model EXCLUDE constraints
//    natively) guarantees no overlap can ever be committed, even under
//    concurrent requests racing past the application check. This is the
//    same class of guarantee as the billing transaction — don't trust a
//    read-then-write check alone when two requests can race.
const FacilityBooking = sequelize.define('FacilityBooking', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  facility_id: { type: DataTypes.UUID, allowNull: false, references: { model: Facility, key: 'id' } },
  resident_id: { type: DataTypes.UUID, allowNull: false, references: { model: User, key: 'id' } },
  start_time: { type: DataTypes.DATE, allowNull: false },
  end_time: { type: DataTypes.DATE, allowNull: false },
  status: {
    type: DataTypes.ENUM('confirmed', 'cancelled'),
    defaultValue: 'confirmed'
  },
  notes: { type: DataTypes.STRING, allowNull: true }
}, {
  tableName: 'facility_bookings',
  indexes: [{ fields: ['facility_id', 'start_time', 'end_time'] }]
});

FacilityBooking.belongsTo(Facility, { foreignKey: 'facility_id' });
FacilityBooking.belongsTo(User, { as: 'resident', foreignKey: 'resident_id' });
Facility.hasMany(FacilityBooking, { foreignKey: 'facility_id' });

module.exports = FacilityBooking;
