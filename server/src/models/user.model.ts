import mongoose, { Schema, Document } from 'mongoose';

export interface IUserDoc extends Document {
  nickname: string;
  token: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUserDoc>({
  nickname: { type: String, required: true },
  token: { type: String, unique: true, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 }, // TTL 24 hours
});

export const User = mongoose.model<IUserDoc>('User', UserSchema);
