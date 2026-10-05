import { BaseModel } from '../common/base.model';
import { SchemeType, SchemeStatus, SchemeApplicationStatus } from '../../types/enums';

export interface SchemeModel extends BaseModel {
  orgId?: string;
  createdBy?: string;
  title: string;
  providerName: string;
  type: SchemeType;
  category: string;
  description: string;
  eligibilityCriteria: string[];
  benefits: string[];
  documentsRequired: string[];
  applicationDeadline?: Date;
  officialPortalUrl?: string;
  status: SchemeStatus;
}

export interface SchemeApplicationModel extends BaseModel {
  schemeId: string;
  applicantId: string;
  documentUrls: string[];
  applicantNotes?: string;
  status: SchemeApplicationStatus;
  reviewerNotes?: string;
}
