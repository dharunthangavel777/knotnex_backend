export enum UserRole {
  USER = 'user',
  ORGANIZATION = 'organization',
  ADMIN = 'admin',
}

export enum OrganizationType {
  NGO = 'NGO',
  CSR_COMPANY = 'CSR Company',
  FOUNDATION = 'Foundation',
  HOSPITAL = 'Hospital',
  SCHOOL = 'School',
  REHABILITATION_CENTER = 'Rehabilitation Center',
  OTHER = 'Other',
}

export enum EventType {
  ONLINE = 'Online',
  IN_PERSON = 'In-Person',
  HYBRID = 'Hybrid',
}

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  UPCOMING = 'upcoming',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RegistrationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  ATTENDED = 'attended',
}

export enum JobType {
  FULL_TIME = 'full-time',
  PART_TIME = 'part-time',
  INTERNSHIP = 'internship',
  VOLUNTEER = 'volunteer',
  CONTRACT = 'contract',
}

export enum JobLocationType {
  REMOTE = 'remote',
  ON_SITE = 'on-site',
  HYBRID = 'hybrid',
}

export enum JobStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum JobApplicationStage {
  APPLIED = 'Applied',
  UNDER_REVIEW = 'Under Review',
  SHORTLISTED = 'Shortlisted',
  INTERVIEW_SCHEDULED = 'Interview Scheduled',
  SELECTED = 'Selected',
  REJECTED = 'Rejected',
}

export enum SchemeType {
  GOVERNMENT = 'Government',
  NGO = 'NGO',
  CORPORATE_CSR = 'Corporate CSR',
}

export enum SchemeStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  UPCOMING = 'upcoming',
}

export enum SchemeApplicationStatus {
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum PostType {
  POST = 'post',
  REEL = 'reel',
  WRITE = 'write',
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VOICE = 'voice',
  DOCUMENT = 'document',
  PROFILE = 'profile',
  POST = 'post',
}
