import mongoose, { Document, Schema, Model } from "mongoose";

export interface UserDocument extends Document {
  name: string;
  email: string;
  password?: string; 
  googleId?: string;
  picture?: string;
  isGoogleAuth: boolean;
  emailVerified: boolean;  // NEW
  verificationToken?: string;  // NEW
  verificationTokenExpiresAt?: Date;  // NEW
  otpAttempts: number;  // NEW
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: function(this: UserDocument) {
      return !this.isGoogleAuth;
    },  
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, 
  },
  picture: {
    type: String,
    default: '',
  },
  isGoogleAuth: {
    type: Boolean,
    default: false,
  },
  emailVerified: {  // NEW
    type: Boolean,
    default: false,
  },
  verificationToken: {  // NEW
    type: String,
  },
  verificationTokenExpiresAt: {  // NEW
    type: Date,
  },
  otpAttempts: {  // NEW
    type: Number,
    default: 0,
  },
}, {
  timestamps: true
});

const User: Model<UserDocument> = mongoose.models.user || mongoose.model<UserDocument>("user", userSchema);

export default User;
