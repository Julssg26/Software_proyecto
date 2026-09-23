const express = require('express');
const { createEntity, getMyEntity, updateMyEntity } = require('../controllers/entityController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');

const router = express.Router();
router.use(authMiddleware);
router.post('/', authorizeRoles('empresa', 'organizacion'), createEntity);
router.get('/me', getMyEntity);
router.put('/me', updateMyEntity);

module.exports = router;
