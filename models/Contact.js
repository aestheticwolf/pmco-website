// models/Contact.js
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  interest: { type: String, required: true },
  message: { type: String, required: true },
  actionRemark: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  attendedStatus: { type: String, default: 'unmarked' },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Contact', contactSchema);