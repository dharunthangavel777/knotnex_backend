import { BaseModel } from '../common/base.model';
import { RegistrationStatus } from '../../types/enums';

export interface EventRegistrationModel extends BaseModel {
  eventId: string;
  userId: string;
  status: RegistrationStatus;
  qrCodeHash: string;
  qrPassUrl?: string;
  checkedInAt?: Date;
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    age?: number;
    gender?: string;
  };
  accessibilityNeeds: {
    wheelchairRequired?: boolean;
    signLanguageInterpreter?: boolean;
    companionAttending?: boolean;
    specialDietaryNeeds?: string;
    otherAssistance?: string;
  };
  consentGiven: boolean;
}
