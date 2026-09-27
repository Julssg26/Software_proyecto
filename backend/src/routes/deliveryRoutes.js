const express = require('express');
const {
  listMyDeliveries,
  shipDelivery,
  receiveDelivery,
  reportIncidentHandler,
} = require('../controllers/deliveryController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');

const router = express.Router();
router.use(authMiddleware);
router.get('/my', listMyDeliveries);
router.patch('/:id/ship', authorizeRoles('empresa'), shipDelivery);
router.patch('/:id/receive', authorizeRoles('organizacion'), receiveDelivery);
router.patch('/:id/incident', authorizeRoles('organizacion'), reportIncidentHandler);

module.exports = router;
