import { BaseModel } from '../common/base.model';
import { JobType, JobLocationType, JobStatus } from '../../types/enums';

export interface JobModel extends BaseModel {
  orgId: string;
  createdBy?: string;
  title: string;
  department?: string;
  type: JobType;
  locationType: JobLocationType;
  location?: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  disabilityAccommodations: string[];
  minSalary?: number;
  maxSalary?: number;
  currency: string;
  experienceLevel?: string;
  educationLevel?: string;
  deadline?: Date;
  status: JobStatus;
  applicantsCount: number;
}
