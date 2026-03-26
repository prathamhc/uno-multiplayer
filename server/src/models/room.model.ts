import mongoose, { Schema, Document } from 'mongoose';

export interface IRoomDoc extends Document {
  code: string;
  hostId: string;
  maxPlayers: number;
  state: any;
  createdAt: Date;
}

const RoomSchema = new Schema<IRoomDoc>({
  code: { type: String, unique: true, required: true },
  hostId: { type: String, required: true },
  maxPlayers: { type: Number, default: 4 },
  state: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, expires: 7200 }, // TTL 2 hours
});

// Index for fast lookups
RoomSchema.index({ code: 1 }, { unique: true });
RoomSchema.index({ 'state.players.socketId': 1 });

export const Room = mongoose.model<IRoomDoc>('Room', RoomSchema);
