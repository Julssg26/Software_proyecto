const express = require('express');
const { getSummary } = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);
router.get('/summary', getSummary);

module.exports = router;
