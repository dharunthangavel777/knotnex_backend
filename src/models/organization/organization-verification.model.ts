import { BaseModel } from '../common/base.model';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface OrganizationVerificationModel extends BaseModel {
  userId: string;
  organizationName: string;
  category: string;
  organizationEmail: string;
  phone: string;
  website?: string;
  status: VerificationStatus;
  reviewedBy?: string;
  rejectionReason?: string;
}
