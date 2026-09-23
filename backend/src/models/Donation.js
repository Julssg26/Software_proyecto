const mongoose = require('mongoose');

const statuses = ['Disponible', 'Solicitada', 'Aprobada', 'En camino', 'Entregada', 'Rechazada'];
const historySchema = new mongoose.Schema({
  status: { type: String, enum: statuses },
  date: { type: Date, default: Date.now },
  note: String,
}, { _id: false });

const donationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, required: true },
  expirationDate: Date,
  observations: String,
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  status: { type: String, enum: statuses, default: 'Disponible' },
  history: [historySchema],
}, { timestamps: true });

module.exports = mongoose.model('Donation', donationSchema, 'donations');
