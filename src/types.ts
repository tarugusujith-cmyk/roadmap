export type Role = 'owner' | 'admin' | 'product_manager' | 'customer';
export type MemberStatus = 'active' | 'invited' | 'suspended';
export type FeedbackStatus = 'open' | 'under_review' | 'planned' | 'in_progress' | 'completed' | 'closed';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Stage = 'under_review' | 'planned' | 'in_progress' | 'completed';
export type ReleaseStatus = 'draft' | 'published' | 'archived';

export interface User { id: number; name: string; email: string; password: string }
export interface Workspace {
  id: number; name: string; description: string; logoUrl: string; brandColor: string;
  publicRoadmap: boolean; ownerId: number; createdAt: string;
}
export interface Member { id: number; workspaceId: number; userId: number; role: Role; status: MemberStatus; joinedAt: string }
export interface Category { id: number; workspaceId: number; name: string; color: string }
export interface Tag { id: number; workspaceId: number; name: string }
export interface Feedback {
  id: number; workspaceId: number; title: string; description: string; categoryId: number | null;
  submitterId: number; tagIds: number[]; priority: Priority; status: FeedbackStatus;
  duplicateOf: number | null; createdAt: string; updatedAt: string;
}
export interface Vote { id: number; workspaceId: number; feedbackId: number; userId: number; createdAt: string }
export interface Comment { id: number; workspaceId: number; feedbackId: number; userId: number; body: string; createdAt: string }
export interface RoadmapItem {
  id: number; workspaceId: number; title: string; description: string; stage: Stage;
  published: boolean; feedbackIds: number[]; createdAt: string; updatedAt: string;
}
export interface ReleaseNote {
  id: number; workspaceId: number; version: string; releaseDate: string; summary: string;
  roadmapItemIds: number[]; status: ReleaseStatus; createdAt: string;
}
export interface Plan {
  id: string; name: string; price: number; description: string;
  limits: { members: number; feedback: number; roadmapItems: number };
}
export interface Subscription { id: number; workspaceId: number; planId: string; startedAt: string }
export interface ActivityLog { id: number; workspaceId: number; userId: number; message: string; createdAt: string }
export interface Usage { members: number; feedback: number; roadmapItems: number }
