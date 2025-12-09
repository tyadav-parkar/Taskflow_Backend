import { Request, Response } from "express";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import validator from "validator";
import axios from "axios";
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET: string = process.env.JWT_SECRET!;
const TOKEN_EXPIRES = "24h";
const SALT = Number(process.env.SALT);

// Google OAuth Configuration
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
            // Check if user registered with Google
            if (existingUser.isGoogleAuth) {
                res.status(409).json({ 
                    success: false, 
                    message: "An account with this email already exists using Google Sign-In. Please use 'Continue with Google' to login." 
                });
                return;
            }
            
            // User registered with email/password
            res.status(409).json({ 
                success: false, 
                message: "An account with this email already exists. Please login instead." 
            });
            return;
        }

        // Hash password
        const hashed = await bcrypt.hash(password, SALT);

        // Create user
        const user = await User.create({ 
            name, 
            email: email.toLowerCase(), 
            password: hashed,
            isGoogleAuth: false
        });

        // Create token
        const token = createToken(user._id.toString());

        // Send response
        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                picture: user.picture || ''
            },
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

export const loginUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body as { email?: string; password?: string };

        // Validation
        if (!email || !password) {
            res.status(400).json({ success: false, message: "Email and password are required." });
            return;
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            res.status(401).json({ success: false, message: "Invalid email or password." });
            return;
        }

        // Check if user signed up with Google
        if (user.isGoogleAuth) {
            res.status(401).json({ 
                success: false, 
                message: "Please use 'Continue with Google' to login." 
            });
            return;
        }

        // Verify password exists (safety check)
        if (!user.password) {
            res.status(401).json({ success: false, message: "Invalid email or password." });
            return;
        }

        // Compare password
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            res.status(401).json({ success: false, message: "Invalid email or password." });
            return;
        }

        // Generate token
        const token = createToken(user._id.toString());

        // Send response
        res.json({
            success: true,
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                picture: user.picture || ''
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

        // Exchange authorization code for access token
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

        // Fetch user info from Google
        const userInfoResponse = await axios.get<GoogleUserInfo>(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            }
        );

        const { email, name, picture, id: googleId } = userInfoResponse.data;

        // Check if user exists in database
        let user = await User.findOne({ email: email.toLowerCase() });

        if (user) {
            // User exists - check if they signed up with email/password
            if (!user.isGoogleAuth && user.password) {
                // User registered with email/password, now trying to login with Google
                // We can either:
                // Option 1: Link the accounts (recommended)
                user.googleId = googleId;
                user.isGoogleAuth = true;
                if (picture) user.picture = picture;
                await user.save();
                
                console.log(`Linked Google account to existing email/password account: ${email}`);
            } else if (user.isGoogleAuth && !user.googleId) {
                // Update Google ID if missing
                user.googleId = googleId;
                if (picture) user.picture = picture;
                await user.save();
            }
        } else {
            // Create new user with Google
            user = await User.create({
                name,
                email: email.toLowerCase(),
                googleId,
                picture,
                isGoogleAuth: true,
                // password field not set for Google-only accounts
            });
        }

        // Generate JWT token
        const token = createToken(user._id.toString());

        // Return user data and token
        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                picture: user.picture || '',
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

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            res.status(401).json({ success: false, message: "Not authorized" });
            return;
        }

        const user = await User.findById(userId).select("name email picture isGoogleAuth");
        
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
                isGoogleAuth: user.isGoogleAuth
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