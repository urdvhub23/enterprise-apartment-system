const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB handles flexible, semi-structured data:
// complaints/maintenance tickets, notices, chat messages, notification logs.
async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true
    });
    console.log('[mongo] connection established');
  } catch (err) {
    console.error('[mongo] unable to connect:', err.message);
    process.exit(1);
  }
}

module.exports = { connectMongo };
