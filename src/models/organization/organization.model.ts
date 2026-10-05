import { BaseModel } from '../common/base.model';
import { OrganizationType } from '../../types/enums';

export interface OrganizationModel extends BaseModel {
  ownerId?: string;
  name: string;
  slug: string;
  type: OrganizationType;
  logoUrl?: string;
  coverUrl?: string;
  about?: string;
  mission?: string;
  vision?: string;
  services: string[];
  achievements: string[];
  gallery: string[];
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  socialLinks: Record<string, string>;
  isVerified: boolean;
  followersCount: number;
}
