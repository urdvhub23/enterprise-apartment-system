const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/postgres');
const Lease = require('./Lease');

// Invoices represent amounts owed. Immutable once paid (ACID-critical).
const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  lease_id: { type: DataTypes.UUID, allowNull: false, references: { model: Lease, key: 'id' } },
  invoice_number: { type: DataTypes.STRING, allowNull: false, unique: true },
  billing_period_start: { type: DataTypes.DATEONLY, allowNull: false },
  billing_period_end: { type: DataTypes.DATEONLY, allowNull: false },
  rent_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  utilities_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  late_fee: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  due_date: { type: DataTypes.DATEONLY, allowNull: false },
  status: {
    type: DataTypes.ENUM('draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void'),
    defaultValue: 'draft'
  }
}, {
  tableName: 'invoices'
});

Invoice.belongsTo(Lease, { foreignKey: 'lease_id' });
Lease.hasMany(Invoice, { foreignKey: 'lease_id' });

module.exports = Invoice;
