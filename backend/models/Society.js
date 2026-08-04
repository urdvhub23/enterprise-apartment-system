const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/postgres');

// Root of multi-tenancy: every apartment/user belongs to exactly one Society.
// An enterprise admin (role=super_admin with no society_id) can see across
// all societies; a property_manager/staff/tenant is scoped to their own.
const Society = sequelize.define('Society', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING, allowNull: true },
  city: { type: DataTypes.STRING, allowNull: true },
  timezone: { type: DataTypes.STRING, defaultValue: 'UTC' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'societies'
});

module.exports = Society;
