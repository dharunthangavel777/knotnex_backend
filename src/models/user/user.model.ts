import { BaseModel } from '../common/base.model';
import { UserRole } from '../../types/enums';

export interface UserModel extends BaseModel {
  firebaseUid: string;
  email: string;
  phone?: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  isVerified: boolean;
  isBanned: boolean;
  fcmToken?: string;
  lastLoginAt?: Date;
}
