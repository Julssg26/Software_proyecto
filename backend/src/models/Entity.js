const mongoose = require('mongoose');

const entitySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['empresa', 'organizacion'], required: true },
  description: String,
  email: { type: String, lowercase: true, trim: true },
  phone: String,
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('Entity', entitySchema);
