const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/postgres');
const Society = require('./Society');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Null for a top-level enterprise admin overseeing multiple societies;
  // set for property_manager/staff/tenant, who are scoped to one society.
  society_id: { type: DataTypes.UUID, allowNull: true, references: { model: Society, key: 'id' } },
  full_name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  phone: { type: DataTypes.STRING, allowNull: true },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  role: {
    type: DataTypes.ENUM('super_admin', 'property_manager', 'staff', 'tenant'),
    allowNull: false,
    defaultValue: 'tenant'
  },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  last_login_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'users',
  indexes: [{ unique: true, fields: ['email'] }]
});

User.belongsTo(Society, { foreignKey: 'society_id' });
Society.hasMany(User, { foreignKey: 'society_id' });

module.exports = User;
