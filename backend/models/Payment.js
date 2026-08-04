const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/postgres');
const Invoice = require('./Invoice');

// Append-only ledger of payment transactions against invoices.
// Never update/delete a posted payment row — issue a reversal entry instead,
// to preserve a full, auditable financial trail (standard ledger practice).
const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  invoice_id: { type: DataTypes.UUID, allowNull: false, references: { model: Invoice, key: 'id' } },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  method: {
    type: DataTypes.ENUM('card', 'bank_transfer', 'cash', 'upi', 'cheque'),
    allowNull: false
  },
  transaction_ref: { type: DataTypes.STRING, allowNull: true },
  // URL of a resident-uploaded receipt (e.g. bank transfer proof). Storage
  // itself isn't wired up in this scaffold — see docs/ARCHITECTURE.md §7.
  receipt_url: { type: DataTypes.STRING, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'reversed'),
    defaultValue: 'pending'
  },
  paid_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'payments'
});

Payment.belongsTo(Invoice, { foreignKey: 'invoice_id' });
Invoice.hasMany(Payment, { foreignKey: 'invoice_id' });

module.exports = Payment;
