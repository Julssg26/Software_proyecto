const express = require('express');
const {
  listDonations,
  getDonation,
  createDonation,
  updateDonation,
  deleteDonation,
} = require('../controllers/donationController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');

const router = express.Router();
router.use(authMiddleware);
router.get('/', listDonations);
router.get('/:id', getDonation);
router.post('/', authorizeRoles('empresa'), createDonation);
router.put('/:id', authorizeRoles('empresa'), updateDonation);
router.delete('/:id', authorizeRoles('empresa'), deleteDonation);

module.exports = router;
