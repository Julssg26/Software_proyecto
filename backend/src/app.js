const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const entityRoutes = require('./routes/entityRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/admin', adminRoutes);

module.exports = app;
