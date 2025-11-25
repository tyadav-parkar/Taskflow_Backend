import { Request, Response } from "express";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import validator from "validator";

const JWT_SECRET: string = process.env.JWT_SECRET || "your_jwt_secret_here";
const TOKEN_EXPIRES = "24h";

const createToken = (userId: string): string =>
    jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });

export const registerUser = async (req: Request, res: Response): Promise<void> => {
    const { name, email, password } = req.body as {
        name?: string;
        email?: string;
        password?: string;
    };

    if (!name || !email || !password) {
        res.status(400).json({ success: false, message: "All fields are required." });
        return;
    }
    if (!validator.isEmail(email)) {
        res.status(400).json({ success: false, message: "Invalid email." });
        return;
    }
    if ((password?.length ?? 0) < 8) {
        res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
        return;
    }

    try {
        if (await User.findOne({ email })) {
            res.status(409).json({ success: false, message: "User already exists." });
            return;
        }

        const hashed = await bcrypt.hash(password, 10);
        const user: any = await User.create({ name, email, password: hashed });
        const token = createToken(user._id as string);

        res.status(201).json({ success: true, token, user: { id: user._id as string, name: user.name as string, email: user.email as string }, });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
        res.status(400).json({ success: false, message: "Email and password required." });
        return;
    }

    try {
        const user: any = await User.findOne({ email });
        if (!user) {
            res.status(401).json({ success: false, message: "Invalid credentials." });
            return;
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            res.status(401).json({ success: false, message: "Invalid credentials." });
            return;
        }

        const token = createToken(user._id as string);
        res.json({success: true,token,user: { id: user._id as string, name: user.name as string, email: user.email as string },});
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Not authorized" });
            return;
        }

        const user = await User.findById(userId).select("name email");
        if (!user) {
            res.status(404).json({ success: false, message: "User not found." });
            return;
        }

        res.json({ success: true, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
    const { name, email } = req.body as { name?: string; email?: string };

    if (!name || !email || !validator.isEmail(email)) {
        res.status(400).json({ success: false, message: "Valid name and email required." });
        return;
    }

    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Not authorized" });
            return;
        }

        const exists = await User.findOne({ email, _id: { $ne: userId } });
        if (exists) {
            res.status(409).json({ success: false, message: "Email already in use by another account." });
            return;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { name, email },
            { new: true, runValidators: true, select: "name email" }
        );

        res.json({ success: true, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

export const updatePassword = async (req: Request, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
    };

    if (!currentPassword || !newPassword || newPassword.length < 8) {
        res.status(400).json({ success: false, message: "Passwords invalid or too short." });
        return;
    }

    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Not authorized" });
            return;
        }

        const user: any = await User.findById(userId).select("password");
        if (!user) {
            res.status(404).json({ success: false, message: "User not found." });
            return;
        }

        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
            res.status(401).json({ success: false, message: "Current password incorrect." });
            return;
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ success: true, message: "Password changed." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};
