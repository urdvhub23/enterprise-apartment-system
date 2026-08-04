const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/postgres');
const User = require('./User');
const Apartment = require('./Apartment');

const Lease = sequelize.define('Lease', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false, references: { model: User, key: 'id' } },
  apartment_id: { type: DataTypes.UUID, allowNull: false, references: { model: Apartment, key: 'id' } },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  monthly_rent: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  security_deposit: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  status: {
    type: DataTypes.ENUM('active', 'terminated', 'expired', 'pending'),
    defaultValue: 'pending'
  }
}, {
  tableName: 'leases'
});

Lease.belongsTo(User, { as: 'tenant', foreignKey: 'tenant_id' });
Lease.belongsTo(Apartment, { as: 'apartment', foreignKey: 'apartment_id' });
Apartment.hasMany(Lease, { foreignKey: 'apartment_id' });
User.hasMany(Lease, { foreignKey: 'tenant_id' });

module.exports = Lease;
