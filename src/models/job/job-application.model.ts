import { BaseModel } from '../common/base.model';
import { JobApplicationStage } from '../../types/enums';

export interface JobApplicationModel extends BaseModel {
  jobId: string;
  applicantId: string;
  resumeUrl: string;
  coverLetter?: string;
  portfolioUrl?: string;
  accommodationNotes?: string;
  stage: JobApplicationStage;
  reviewerNotes?: string;
}
