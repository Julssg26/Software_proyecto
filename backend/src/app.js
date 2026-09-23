const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const entityRoutes = require('./routes/entityRoutes');

const app = express();

app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);

module.exports = app;
