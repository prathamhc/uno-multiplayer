import mongoose, { Document } from 'mongoose';
export interface IUserDoc extends Document {
    nickname: string;
    token: string;
    createdAt: Date;
}
export declare const User: mongoose.Model<IUserDoc, {}, {}, {}, mongoose.Document<unknown, {}, IUserDoc, {}, {}> & IUserDoc & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=user.model.d.ts.map