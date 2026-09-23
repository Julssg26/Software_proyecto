const mongoose = require('mongoose');

const statuses = ['Preparando', 'En camino', 'Entregada', 'Incidencia'];
const historySchema = new mongoose.Schema({
  status: { type: String, enum: statuses },
  date: { type: Date, default: Date.now },
  note: String,
}, { _id: false });

const deliverySchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
  donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true },
  status: { type: String, enum: statuses, default: 'Preparando' },
  sentAt: Date,
  receivedAt: Date,
  incident: {
    hasIncident: { type: Boolean, default: false },
    description: String,
  },
  history: [historySchema],
}, { timestamps: true });

module.exports = mongoose.model('Delivery', deliverySchema, 'deliveries');
