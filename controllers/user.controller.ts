import { Request, Response } from "express";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import validator from "validator";
import axios from "axios";
import dotenv from 'dotenv';
import { sendVerificationEmail, sendWelcomeEmail } from '../utils/email.service.js';

dotenv.config();

const JWT_SECRET: string = process.env.JWT_SECRET!;
const TOKEN_EXPIRES = "24h";
const SALT = Number(process.env.SALT);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = "postmessage";

interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
    refresh_token?: string;
}

interface GoogleUserInfo {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}

const createToken = (userId: string): string => {
    try {
        const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
        return token;
    } catch (error) {
        console.error("Error creating token:", error);
        throw error;
    }
};

// Generate 6-digit OTP
const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Register User
export const registerUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password } = req.body as {
            name?: string;
            email?: string;
            password?: string;
        };

        // Validation
        if (!name || !email || !password) {
            res.status(400).json({ success: false, message: "All fields are required." });
            return;
        }

        if (!validator.isEmail(email)) {
            res.status(400).json({ success: false, message: "Invalid email." });
            return;
        }

        if (password.length < 8) {
            res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
            return;
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        
        if (existingUser) {
            if (existingUser.isGoogleAuth) {
                res.status(409).json({ 
                    success: false, 
                    message: "An account with this email already exists using Google Sign-In. Please use 'Continue with Google' to login." 
                });
                return;
            }
            
            if (!existingUser.emailVerified) {
                res.status(409).json({ 
                    success: false, 
                    message: "Email already registered but not verified. Please verify your email.",
                    requiresVerification: true,
                    email: existingUser.email
                });
                return;
            }
            
            res.status(409).json({ 
                success: false, 
                message: "An account with this email already exists. Please login instead." 
            });
            return;
        }

        // Hash password
        const hashed = await bcrypt.hash(password, SALT);

        // Generate OTP
        const verificationToken = generateOTP();
        const verificationTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Create user
        const user = await User.create({ 
            name, 
            email: email.toLowerCase(), 
            password: hashed,
            isGoogleAuth: false,
            emailVerified: false,
            verificationToken,
            verificationTokenExpiresAt,
            otpAttempts: 0
        });

        // Send OTP email
        const emailSent = await sendVerificationEmail(email, verificationToken);

        if (!emailSent) {
            res.status(500).json({ success: false, message: "Failed to send verification email. Please try again." });
            return;
        }

        res.status(201).json({
            success: true,
            message: "Registration successful! Please check your email for verification code.",
            requiresVerification: true,
            email: user.email,
            userId: user._id.toString()
        });

    } catch (err: any) {
        console.error("Registration error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Server error during registration.",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Verify Email with OTP
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, code } = req.body as { email?: string; code?: string };

        if (!email || !code) {
            res.status(400).json({ success: false, message: "Email and verification code are required." });
            return;
        }

        // Find user by email first
        const user = await User.findOne({
            email: email.toLowerCase(),
            verificationTokenExpiresAt: { $gt: Date.now() }
        });

        if (!user) {
            res.status(400).json({ 
                success: false, 
                message: "Invalid or expired verification code." 
            });
            return;
        }

        // Check OTP attempts
        if (user.otpAttempts >= 5) {
            res.status(429).json({ 
                success: false, 
                message: "Too many failed attempts. Please request a new code." 
            });
            return;
        }

        // Verify the code
        if (user.verificationToken !== code) {
            // Increment failed attempts
            user.otpAttempts += 1;
            await user.save();
            
            const attemptsLeft = 5 - user.otpAttempts;
            res.status(400).json({ 
                success: false, 
                message: `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.` 
            });
            return;
        }

        // Mark as verified
        user.emailVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiresAt = undefined;
        user.otpAttempts = 0;
        await user.save();

        // Send welcome email (non-blocking)
        sendWelcomeEmail(user.email, user.name).catch(err => 
            console.error("Failed to send welcome email:", err)
        );

        // Generate JWT token
        const token = createToken(user._id.toString());

        res.status(200).json({
            success: true,
            message: "Email verified successfully!",
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                picture: user.picture || '',
                emailVerified: true
            }
        });

    } catch (err: any) {
        console.error("Email verification error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Server error during verification.",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Resend OTP
export const resendOTP = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body as { email?: string };

        if (!email) {
            res.status(400).json({ success: false, message: "Email is required." });
            return;
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            res.status(404).json({ success: false, message: "User not found." });
            return;
        }

        if (user.emailVerified) {
            res.status(400).json({ success: false, message: "Email is already verified." });
            return;
        }

        // Generate new OTP
        const verificationToken = generateOTP();
        const verificationTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        user.verificationToken = verificationToken;
        user.verificationTokenExpiresAt = verificationTokenExpiresAt;
        user.otpAttempts = 0; // Reset attempts on resend
        await user.save();

        // Send OTP email
        const emailSent = await sendVerificationEmail(email, verificationToken);

        if (!emailSent) {
            res.status(500).json({ success: false, message: "Failed to send email." });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Verification code sent to your email."
        });

    } catch (err: any) {
        console.error("Resend OTP error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Server error.",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Login User
export const loginUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body as { email?: string; password?: string };

        if (!email || !password) {
            res.status(400).json({ success: false, message: "Email and password are required." });
            return;
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            res.status(401).json({ success: false, message: "Invalid email or password." });
            return;
        }

        if (user.isGoogleAuth) {
            res.status(401).json({ 
                success: false, 
                message: "Please use 'Continue with Google' to login." 
            });
            return;
        }

        if (!user.password) {
            res.status(401).json({ success: false, message: "Invalid email or password." });
            return;
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            res.status(401).json({ success: false, message: "Invalid email or password." });
            return;
        }

        // Check email verification
        if (!user.emailVerified) {
            res.status(403).json({ 
                success: false, 
                message: "Please verify your email first.",
                requiresVerification: true,
                email: user.email
            });
            return;
        }

        const token = createToken(user._id.toString());

        res.json({
            success: true,
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                picture: user.picture || '',
                emailVerified: user.emailVerified
            },
        });

    } catch (err: any) {
        console.error("Login error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Server error during login.",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Google Auth
export const googleAuth = async (req: Request, res: Response): Promise<void> => {
    try {
        const { code } = req.body;

        if (!code) {
            res.status(400).json({
                success: false,
                message: 'Authorization code is required',
            });
            return;
        }

        const tokenResponse = await axios.post<GoogleTokenResponse>(
            'https://oauth2.googleapis.com/token',
            {
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code',
            }
        );

        const { access_token } = tokenResponse.data;

        const userInfoResponse = await axios.get<GoogleUserInfo>(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            }
        );

        const { email, name, picture, id: googleId } = userInfoResponse.data;

        let user = await User.findOne({ email: email.toLowerCase() });

        if (user) {
            // Update existing user with Google auth
            if (!user.isGoogleAuth && user.password) {
                user.googleId = googleId;
                user.isGoogleAuth = true;
                user.emailVerified = true;
                if (picture) user.picture = picture;
                await user.save();
            } else if (user.isGoogleAuth && !user.googleId) {
                user.googleId = googleId;
                user.emailVerified = true;
                if (picture) user.picture = picture;
                await user.save();
            } else if (user.isGoogleAuth) {
                // Just update picture if needed
                if (picture && user.picture !== picture) {
                    user.picture = picture;
                    await user.save();
                }
            }
        } else {
            // Create new user with Google auth
            user = await User.create({
                name,
                email: email.toLowerCase(),
                googleId,
                picture,
                isGoogleAuth: true,
                emailVerified: true,
            });
        }

        const token = createToken(user._id.toString());

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                picture: user.picture || '',
                emailVerified: user.emailVerified
            },
            message: 'Google authentication successful',
        });

    } catch (error: any) {
        console.error("Google auth error:", error);
        res.status(500).json({
            success: false,
            message: error.response?.data?.error_description || 'Google authentication failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get Current User
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            res.status(401).json({ success: false, message: "Not authorized" });
            return;
        }

        const user = await User.findById(userId).select("name email picture isGoogleAuth emailVerified");
        
        if (!user) {
            res.status(404).json({ success: false, message: "User not found." });
            return;
        }

        res.json({ 
            success: true, 
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                picture: user.picture || '',
                isGoogleAuth: user.isGoogleAuth,
                emailVerified: user.emailVerified
            }
        });

    } catch (err: any) {
        console.error("Get current user error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Server error.",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};