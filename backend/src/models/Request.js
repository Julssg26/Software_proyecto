const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  message: String,
  status: { type: String, enum: ['Pendiente', 'Aprobada', 'Rechazada'], default: 'Pendiente' },
  requestedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
}, { timestamps: true });

requestSchema.index({ donationId: 1, organizationId: 1 }, { unique: true });

module.exports = mongoose.model('Request', requestSchema, 'requests');
