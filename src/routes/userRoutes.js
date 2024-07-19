import express from 'express';
import {
  registerUser,
  loginUser,
  fetchRepositories,
} from '../controllers/userController.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/fetch-repositories', fetchRepositories);

export default router;
