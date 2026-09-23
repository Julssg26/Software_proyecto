const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'donaciones_db' });
    console.log('MongoDB conectado correctamente');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

module.exports = connectDB;
