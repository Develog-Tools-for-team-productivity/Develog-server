const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

router.post('/add', testController.createTest);
router.get('/users', testController.getTests);

module.exports = router;
