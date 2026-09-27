const express = require('express');
const {
  createRequest,
  listMyRequests,
  listReceivedRequests,
  approveRequest,
  rejectRequest,
} = require('../controllers/requestController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');

const router = express.Router();
router.use(authMiddleware);
router.post('/', authorizeRoles('organizacion'), createRequest);
router.get('/my', authorizeRoles('organizacion'), listMyRequests);
router.get('/received', authorizeRoles('empresa', 'admin'), listReceivedRequests);
router.patch('/:id/approve', authorizeRoles('empresa'), approveRequest);
router.patch('/:id/reject', authorizeRoles('empresa'), rejectRequest);

module.exports = router;
