// src/routes/user.route.ts
import express from 'express';
import {
    registerUser,
    loginUser,
    getCurrentUser,
    googleAuth,
    verifyEmail,     // NEW
    resendOTP,       // NEW
} from '../controllers/user.controller.js';
import authMiddleware from '../middleware/auth.js';

const userRouter = express.Router();

// Authentication routes
userRouter.post('/register', registerUser);
userRouter.post('/login', loginUser);
userRouter.post('/google-auth', googleAuth);

// Email verification routes (NEW)
userRouter.post('/verify-email', verifyEmail);
userRouter.post('/resend-otp', resendOTP);

// Protected routes
userRouter.get('/profile', authMiddleware, getCurrentUser);

export default userRouter;
