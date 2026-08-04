const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/postgres');
const Society = require('./Society');

const Apartment = sequelize.define('Apartment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  society_id: { type: DataTypes.UUID, allowNull: false, references: { model: Society, key: 'id' } },
  building_name: { type: DataTypes.STRING, allowNull: false },
  unit_number: { type: DataTypes.STRING, allowNull: false },
  floor: { type: DataTypes.INTEGER, allowNull: true },
  bedrooms: { type: DataTypes.INTEGER, defaultValue: 1 },
  bathrooms: { type: DataTypes.INTEGER, defaultValue: 1 },
  area_sqft: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  monthly_rent: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  status: {
    type: DataTypes.ENUM('vacant', 'occupied', 'under_maintenance'),
    defaultValue: 'vacant'
  }
}, {
  tableName: 'apartments',
  indexes: [{ unique: true, fields: ['building_name', 'unit_number'] }]
});

Apartment.belongsTo(Society, { foreignKey: 'society_id' });
Society.hasMany(Apartment, { foreignKey: 'society_id' });

module.exports = Apartment;
