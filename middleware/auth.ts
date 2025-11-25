import { Request, Response, NextFunction } from "express";
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

const JWT_SECRET:string = process.env.JWT_SECRET || "your_jwt_secret_here"

const authMiddleware=async(req: Request, res: Response, next: NextFunction): Promise<void>=> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Not authorized, token missing' });
        return;
    }
    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, JWT_SECRET) as {id:string};
        const user = await User.findById(payload.id).select('-password');
        if (!user) {
            res.status(401).json({ success: false, message: 'User not found' });
            return;
        }
        req.user = {id:String(user._id)};
        next();
    } catch (err) {
        console.error('JWT verification failed:', err);
        res.status(401).json({ success: false, message: 'Token invalid or expired' });
    }
}

export default authMiddleware;