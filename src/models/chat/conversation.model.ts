import { MessageType } from '../../types/enums';

export interface ChatConversationDocument {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageBy?: string;
  unreadCount: Record<string, number>;
  createdAt: Date;
}

export interface ChatMessageDocument {
  id: string;
  senderId: string;
  content: string;
  messageType: MessageType;
  mediaUrl?: string;
  reactions?: Record<string, string>;
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  };
  isRead: boolean;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface UserPresenceDocument {
  isOnline: boolean;
  lastSeen: Date;
  currentDevice: string;
}
