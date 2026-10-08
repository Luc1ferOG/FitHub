import type { Friendship } from './friendship';

export type PublicUser = {
  id: string; username: string; displayName: string; avatarUrl: string | null;
  bio: string | null; experienceLevel: string;
};
export type PublicProfile = PublicUser & {
  publicWorkoutCount: number; achievementCount: number;
  achievements: { code: string; title: string; icon: string; unlockedAt: string }[];
};
export type FriendState = 'self' | 'none' | 'incoming' | 'outgoing' | 'friends';
export type FriendAction = 'send' | 'accept' | 'reject' | 'cancel' | 'remove';
export type FriendListKind = 'friends' | 'incoming' | 'outgoing';
export type FriendItem = { profile: PublicUser; friendship: Friendship };
export type SocialPage<T> = { items: T[]; nextOffset: number | null };
