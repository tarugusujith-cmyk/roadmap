import axios from 'axios';
import type { Feedback, RoadmapItem, Vote } from './types';

export const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3001';
export const http = axios.create({ baseURL: BASE_URL, timeout: 10000 });

type Params = Record<string, string | number | boolean | undefined>;
type Id = number | string;

export async function list<T>(resource: string, params?: Params): Promise<T[]> {
  return (await http.get<T[]>(`/${resource}`, { params })).data;
}
export async function getOne<T>(resource: string, id: Id): Promise<T> {
  return (await http.get<T>(`/${resource}/${id}`)).data;
}
export async function create<T>(resource: string, body: Record<string, unknown>): Promise<T> {
  return (await http.post<T>(`/${resource}`, body)).data;
}
export async function patch<T>(resource: string, id: Id, body: Record<string, unknown>): Promise<T> {
  return (await http.patch<T>(`/${resource}/${id}`, body)).data;
}
export async function remove(resource: string, id: Id): Promise<void> {
  await http.delete(`/${resource}/${id}`);
}

/** Turns any thrown value into a message that is safe to show to the user. */
export function errMsg(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (!e.response) return `Cannot reach the API server at ${BASE_URL}. Make sure JSON Server is running (npm run api).`;
    if (e.response.status === 404) return 'That record could not be found. It may have been deleted.';
    return `The server returned an error (${e.response.status}). Please try again.`;
  }
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

export async function logActivity(workspaceId: number, userId: number, message: string): Promise<void> {
  try {
    await create('activityLogs', { workspaceId, userId, message, createdAt: new Date().toISOString() });
  } catch {
    /* activity logging must never block the main action */
  }
}

async function deleteWhere(resource: string, params: Params): Promise<void> {
  const rows = await list<{ id: number }>(resource, params);
  await Promise.all(rows.map((r) => remove(resource, r.id)));
}

/** One vote per user per feedback item. Returns true when the vote was added, false when it was removed. */
export async function toggleVote(workspaceId: number, feedbackId: number, userId: number): Promise<boolean> {
  const existing = await list<Vote>('votes', { feedbackId, userId });
  if (existing.length > 0) {
    await Promise.all(existing.map((v) => remove('votes', v.id)));
    return false;
  }
  await create('votes', { workspaceId, feedbackId, userId, createdAt: new Date().toISOString() });
  return true;
}

export async function deleteFeedbackCascade(fb: Feedback): Promise<void> {
  const [dups, items] = await Promise.all([
    list<Feedback>('feedback', { duplicateOf: fb.id }),
    list<RoadmapItem>('roadmapItems', { workspaceId: fb.workspaceId }),
  ]);
  await Promise.all([
    deleteWhere('votes', { feedbackId: fb.id }),
    deleteWhere('comments', { feedbackId: fb.id }),
    ...dups.map((d) => patch('feedback', d.id, { duplicateOf: null })),
    ...items.filter((i) => i.feedbackIds.includes(fb.id)).map((i) => patch('roadmapItems', i.id, { feedbackIds: i.feedbackIds.filter((x) => x !== fb.id) })),
  ]);
  await remove('feedback', fb.id);
}

export async function deleteWorkspaceCascade(workspaceId: number): Promise<void> {
  const resources = ['votes', 'comments', 'feedback', 'roadmapItems', 'releaseNotes', 'categories', 'tags', 'workspaceMembers', 'workspaceSubscriptions', 'activityLogs'];
  for (const r of resources) await deleteWhere(r, { workspaceId });
  await remove('workspaces', workspaceId);
}
