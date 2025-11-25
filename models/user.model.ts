import mongoose from "mongoose";
const { Schema, model, models } = mongoose

export interface UserDocument extends Document {
  name: string;
  email: string;
  password: string;
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
  },
  password: {
    type: String,
    required: true,
  },
});

const userModel = models.user || model<UserDocument>("user", userSchema);

export default userModel;
