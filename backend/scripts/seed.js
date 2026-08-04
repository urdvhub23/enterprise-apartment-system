require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, connectPostgres } = require('../config/postgres');
const { connectMongo } = require('../config/mongo');
const Society = require('../models/Society');
const User = require('../models/User');
const Apartment = require('../models/Apartment');
const Lease = require('../models/Lease');
const Facility = require('../models/Facility');

async function seed() {
  await connectPostgres();
  await connectMongo();
  await sequelize.sync({ alter: true });

  const password_hash = await bcrypt.hash('Password123!', 12);

  const [society] = await Society.findOrCreate({
    where: { name: 'Maple Court Society' },
    defaults: { address: '100 Maple Ave', city: 'Springfield' }
  });

  // Enterprise admin: no society_id, sees across every society.
  const [enterpriseAdmin] = await User.findOrCreate({
    where: { email: 'enterprise@apartments.test' },
    defaults: { full_name: 'Enterprise Admin', password_hash, role: 'super_admin' }
  });

  const [admin] = await User.findOrCreate({
    where: { email: 'admin@apartments.test' },
    defaults: { full_name: 'Property Admin', password_hash, role: 'property_manager', society_id: society.id }
  });

  const [staff] = await User.findOrCreate({
    where: { email: 'gate@apartments.test' },
    defaults: { full_name: 'Gate Staff', password_hash, role: 'staff', society_id: society.id }
  });

  const [tenant] = await User.findOrCreate({
    where: { email: 'tenant@apartments.test' },
    defaults: { full_name: 'Jane Tenant', password_hash, role: 'tenant', phone: '555-0100', society_id: society.id }
  });

  const [apt] = await Apartment.findOrCreate({
    where: { building_name: 'Maple Court', unit_number: '3B' },
    defaults: { society_id: society.id, floor: 3, bedrooms: 2, bathrooms: 1, area_sqft: 850, monthly_rent: 1500, status: 'occupied' }
  });

  await Lease.findOrCreate({
    where: { tenant_id: tenant.id, apartment_id: apt.id },
    defaults: {
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      monthly_rent: 1500,
      security_deposit: 1500,
      status: 'active'
    }
  });

  await Facility.findOrCreate({
    where: { society_id: society.id, name: 'Clubhouse' },
    defaults: { category: 'clubhouse', capacity: 40, booking_slot_minutes: 60 }
  });

  await Facility.findOrCreate({
    where: { society_id: society.id, name: 'Tennis Court 1' },
    defaults: { category: 'court', capacity: 4, booking_slot_minutes: 60 }
  });

  console.log('Seed complete. Login with:');
  console.log('  enterprise@apartments.test / Password123!  (enterprise admin, cross-society)');
  console.log('  admin@apartments.test / Password123!       (property manager, Maple Court Society)');
  console.log('  gate@apartments.test / Password123!        (gate/facility staff)');
  console.log('  tenant@apartments.test / Password123!      (resident)');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
