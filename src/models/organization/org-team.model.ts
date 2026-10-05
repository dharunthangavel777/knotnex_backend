export interface OrgTeamMemberModel {
  id: string;
  orgId: string;
  userId: string;
  roleInOrg: string;
  permissions: string[];
  joinedAt: Date;
}

export interface OrgFollowerModel {
  id: string;
  orgId: string;
  userId: string;
  createdAt: Date;
}

export interface OrgReviewModel {
  id: string;
  orgId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}
