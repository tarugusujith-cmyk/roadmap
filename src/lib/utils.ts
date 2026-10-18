import type { FeedbackStatus, MemberStatus, Priority, ReleaseStatus, Role, Stage } from '../types';

export type Tone = 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'violet';
export interface Opt<T> { value: T; label: string; tone: Tone }

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '79 70 229';
  const n = parseInt(m[1], 16);
  return `${n >> 16} ${(n >> 8) & 255} ${n & 255}`;
}
export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
export const nowISO = () => new Date().toISOString();
export const isValidUrl = (u: string) => u === '' || /^(https?:\/\/|data:image\/)/i.test(u);
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export const initial = (s: string) => (s.trim()[0] || '?').toUpperCase();

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Workspace Owner', admin: 'Admin', product_manager: 'Product Manager', customer: 'Customer',
};
export const ROLE_TONE: Record<Role, Tone> = { owner: 'violet', admin: 'blue', product_manager: 'amber', customer: 'slate' };

export const STATUS_OPTIONS: Opt<FeedbackStatus>[] = [
  { value: 'open', label: 'Open', tone: 'slate' },
  { value: 'under_review', label: 'Under Review', tone: 'amber' },
  { value: 'planned', label: 'Planned', tone: 'blue' },
  { value: 'in_progress', label: 'In Progress', tone: 'violet' },
  { value: 'completed', label: 'Completed', tone: 'green' },
  { value: 'closed', label: 'Closed', tone: 'red' },
];
export const PRIORITY_OPTIONS: Opt<Priority>[] = [
  { value: 'low', label: 'Low', tone: 'slate' },
  { value: 'medium', label: 'Medium', tone: 'blue' },
  { value: 'high', label: 'High', tone: 'amber' },
  { value: 'critical', label: 'Critical', tone: 'red' },
];
export const STAGES: Opt<Stage>[] = [
  { value: 'under_review', label: 'Under Review', tone: 'amber' },
  { value: 'planned', label: 'Planned', tone: 'blue' },
  { value: 'in_progress', label: 'In Progress', tone: 'violet' },
  { value: 'completed', label: 'Completed', tone: 'green' },
];
export const MEMBER_STATUS: Opt<MemberStatus>[] = [
  { value: 'active', label: 'Active', tone: 'green' },
  { value: 'invited', label: 'Invited', tone: 'amber' },
  { value: 'suspended', label: 'Suspended', tone: 'red' },
];
export const RELEASE_STATUS: Opt<ReleaseStatus>[] = [
  { value: 'draft', label: 'Draft', tone: 'slate' },
  { value: 'published', label: 'Published', tone: 'green' },
  { value: 'archived', label: 'Archived', tone: 'amber' },
];
export function find<T>(opts: Opt<T>[], v: T): Opt<T> {
  return opts.find((o) => o.value === v) || opts[0];
}
/** Roadmap stage -> feedback status that is applied to linked feedback. */
export const STAGE_TO_STATUS: Record<Stage, FeedbackStatus> = {
  under_review: 'under_review', planned: 'planned', in_progress: 'in_progress', completed: 'completed',
};

export type Action =
  | 'dashboard.view' | 'feedback.manage' | 'category.manage' | 'roadmap.edit' | 'roadmap.stage'
  | 'release.manage' | 'release.drafts' | 'team.manage' | 'subscription.view' | 'subscription.manage' | 'workspace.settings';

const RULES: Record<Action, Role[]> = {
  'dashboard.view': ['owner', 'admin', 'product_manager'],
  'feedback.manage': ['owner', 'admin', 'product_manager'], // edit/delete any, change status & priority, link duplicates
  'category.manage': ['owner', 'admin'],
  'roadmap.edit': ['owner', 'admin'], // create / edit / delete / publish items
  'roadmap.stage': ['owner', 'admin', 'product_manager'], // move items between stages
  'release.manage': ['owner', 'admin'],
  'release.drafts': ['owner', 'admin', 'product_manager'],
  'team.manage': ['owner', 'admin'],
  'subscription.view': ['owner', 'admin'],
  'subscription.manage': ['owner'],
  'workspace.settings': ['owner'],
};
export const can = (role: Role, action: Action) => RULES[action].includes(role);
export const assignableRoles = (me: Role): Role[] =>
  me === 'owner' ? ['admin', 'product_manager', 'customer'] : me === 'admin' ? ['product_manager', 'customer'] : [];
export const canManageMember = (me: Role, target: Role) => assignableRoles(me).includes(target);
