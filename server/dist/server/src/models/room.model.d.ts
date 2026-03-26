import mongoose, { Document } from 'mongoose';
export interface IRoomDoc extends Document {
    code: string;
    hostId: string;
    maxPlayers: number;
    state: any;
    createdAt: Date;
}
export declare const Room: mongoose.Model<IRoomDoc, {}, {}, {}, mongoose.Document<unknown, {}, IRoomDoc, {}, {}> & IRoomDoc & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=room.model.d.ts.map