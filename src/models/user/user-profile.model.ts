import { BaseModel } from '../common/base.model';

export interface UserProfileModel extends BaseModel {
  userId: string;
  bio?: string;
  dateOfBirth?: string;
  gender?: string;
  district?: string;
  state?: string;
  pincode?: string;
  disabilityType?: string;
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    startYear?: number;
    endYear?: number;
  }>;
  skills: string[];
  languages: string[];
  socialLinks: Record<string, string>;
  accessibility: Record<string, any>;
  coverUrl?: string;
  qrCodeUrl?: string;
}
