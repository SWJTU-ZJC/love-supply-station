export interface User {
  id: string;
  nickname: string;
  avatar: string;
  coins: number;
  mood: string;
  partnerId: string;
  coupleCode: string;
}

export interface GachaItem {
  id: string;
  name: string;
  image: string;
  type: string;
  probability: number;
  description: string;
}

export interface Checkin {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  note: string;
  createdAt: number;
}

export interface DailyPhoto {
  id: string;
  userId: string;
  url: string;
  createdAt: number;
  caption: string;
  date?: string;
  imageUrl?: string;
}

export interface Capsule {
  id: string;
  userId: string;
  contentType: 'text' | 'audio' | 'video';
  content: string;
  mediaUrl: string;
  sealTime: number;
  openTime: number;
  isOpened: boolean;
}

export interface LittleThing {
  id: string;
  text: string;
  isDone: boolean;
  doneTime: number | null;
  proposedBy: string;
}

export interface TreeHoleMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  isRead: boolean;
  createdAt: number;
}

export type Mood = '😊' | '🥺' | '😤' | '😴' | '🥰';
export type Identity = 'me' | 'partner';
