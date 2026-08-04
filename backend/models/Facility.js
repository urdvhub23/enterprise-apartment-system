const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/postgres');
const Society = require('./Society');

const Facility = sequelize.define('Facility', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  society_id: { type: DataTypes.UUID, allowNull: false, references: { model: Society, key: 'id' } },
  name: { type: DataTypes.STRING, allowNull: false }, // "Clubhouse", "Tennis Court 1"
  category: {
    type: DataTypes.ENUM('clubhouse', 'court', 'pool', 'gym', 'hall', 'other'),
    defaultValue: 'other'
  },
  capacity: { type: DataTypes.INTEGER, allowNull: true },
  booking_slot_minutes: { type: DataTypes.INTEGER, defaultValue: 60 }, // booking granularity
  opens_at: { type: DataTypes.TIME, defaultValue: '06:00:00' },
  closes_at: { type: DataTypes.TIME, defaultValue: '22:00:00' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'facilities'
});

Facility.belongsTo(Society, { foreignKey: 'society_id' });
Society.hasMany(Facility, { foreignKey: 'society_id' });

module.exports = Facility;
