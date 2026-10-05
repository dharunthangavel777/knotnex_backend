export interface UserDeviceModel {
  id: string;
  userId: string;
  deviceName?: string;
  deviceType?: string;
  os?: string;
  browser?: string;
  ipAddress?: string;
  lastActiveAt: Date;
  createdAt: Date;
}
