const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/postgres');
const Society = require('./Society');
const User = require('./User');
const Apartment = require('./Apartment');

const Visitor = sequelize.define('Visitor', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  society_id: { type: DataTypes.UUID, allowNull: false, references: { model: Society, key: 'id' } },
  host_resident_id: { type: DataTypes.UUID, allowNull: false, references: { model: User, key: 'id' } },
  apartment_id: { type: DataTypes.UUID, allowNull: false, references: { model: Apartment, key: 'id' } },
  visitor_name: { type: DataTypes.STRING, allowNull: false },
  visitor_phone: { type: DataTypes.STRING, allowNull: true },
  purpose: {
    type: DataTypes.ENUM('guest', 'delivery', 'vendor', 'cab', 'other'),
    defaultValue: 'guest'
  },
  // Flags a recurring delivery driver/vendor so gate staff can fast-track them
  // (see visitors.routes.js /frequent endpoint) instead of full manual entry.
  is_frequent_flag: { type: DataTypes.BOOLEAN, defaultValue: false },
  qr_token: { type: DataTypes.STRING, allowNull: false, unique: true },
  valid_from: { type: DataTypes.DATE, allowNull: false },
  valid_until: { type: DataTypes.DATE, allowNull: false },
  status: {
    type: DataTypes.ENUM('pending', 'checked_in', 'checked_out', 'expired', 'cancelled'),
    defaultValue: 'pending'
  },
  checked_in_at: { type: DataTypes.DATE, allowNull: true },
  checked_out_at: { type: DataTypes.DATE, allowNull: true },
  logged_by_staff_id: { type: DataTypes.UUID, allowNull: true, references: { model: User, key: 'id' } },
  // entry_method records how the gate event was captured, in preparation for
  // real hardware integration (see docs/ARCHITECTURE.md §7).
  entry_method: {
    type: DataTypes.ENUM('qr_scan', 'manual', 'rfid', 'biometric'),
    allowNull: true
  }
}, {
  tableName: 'visitors'
});

Visitor.belongsTo(Society, { foreignKey: 'society_id' });
Visitor.belongsTo(User, { as: 'host', foreignKey: 'host_resident_id' });
Visitor.belongsTo(Apartment, { foreignKey: 'apartment_id' });
Visitor.belongsTo(User, { as: 'loggedByStaff', foreignKey: 'logged_by_staff_id' });

module.exports = Visitor;
