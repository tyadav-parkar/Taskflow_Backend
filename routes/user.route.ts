// src/routes/user.route.ts
import express from 'express';
import {
    registerUser,
    loginUser,
    getCurrentUser,
    googleAuth,
} from '../controllers/user.controller.js';
import authMiddleware from '../middleware/auth.js';

const userRouter = express.Router();

// Traditional authentication routes
userRouter.post('/register', registerUser);
userRouter.post('/login', loginUser);

// Google OAuth authentication route
userRouter.post('/google-auth', googleAuth);

// Protected routes (require authentication)
userRouter.get('/profile', authMiddleware, getCurrentUser);

export default userRouter;