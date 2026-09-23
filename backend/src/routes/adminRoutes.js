const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const { getUsers, getCompanies, getOrganizations } = require('../controllers/adminController');

const router = express.Router();
router.use(authMiddleware, authorizeRoles('admin'));
router.get('/users', getUsers);
router.get('/entities/companies', getCompanies);
router.get('/entities/organizations', getOrganizations);

module.exports = router;
