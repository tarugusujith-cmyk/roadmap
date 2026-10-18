import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errMsg, getOne, list } from '../api';
import { useAuth } from './AuthContext';
import { ErrorState, Spinner } from '../components/ui';
import { can as canDo } from '../lib/utils';
import type { Action } from '../lib/utils';
import type { Member, Plan, Role, Subscription, Usage, User, Workspace } from '../types';

interface WsCtx {
  workspace: Workspace; member: Member; role: Role; user: User;
  plan: Plan; plans: Plan[]; subscription: Subscription; usage: Usage;
  refresh: () => Promise<void>;
  can: (a: Action) => boolean;
  atLimit: (k: keyof Usage) => boolean;
}
const Ctx = createContext<WsCtx | null>(null);

interface Raw { workspace: Workspace; member: Member | null; subscription: Subscription; plans: Plan[]; usage: Usage }

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { wid } = useParams();
  const { user } = useAuth();
  const [raw, setRaw] = useState<Raw | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const id = Number(wid);
    const [workspace, members, subs, plans, feedback, items] = await Promise.all([
      getOne<Workspace>('workspaces', id),
      list<Member>('workspaceMembers', { workspaceId: id }),
      list<Subscription>('workspaceSubscriptions', { workspaceId: id }),
      list<Plan>('subscriptionPlans'),
      list<{ id: number }>('feedback', { workspaceId: id }),
      list<{ id: number }>('roadmapItems', { workspaceId: id }),
    ]);
    const subscription = subs[0] || { id: 0, workspaceId: id, planId: 'free', startedAt: workspace.createdAt };
    setRaw({
      workspace, plans, subscription,
      member: members.find((m) => m.userId === user?.id) || null,
      usage: { members: members.length, feedback: feedback.length, roadmapItems: items.length },
    });
  }, [wid, user?.id]);

  useEffect(() => {
    setLoading(true); setError(null); setRaw(null);
    load().catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  }, [load]);

  const refresh = useCallback(async () => { try { await load(); } catch { /* keep stale data */ } }, [load]);

  const value = useMemo<WsCtx | null>(() => {
    if (!raw || !raw.member || !user) return null;
    const plan = raw.plans.find((p) => p.id === raw.subscription.planId) || raw.plans[0];
    const role = raw.member.role;
    return {
      workspace: raw.workspace, member: raw.member, role, user, plan, plans: raw.plans,
      subscription: raw.subscription, usage: raw.usage, refresh,
      can: (a) => canDo(role, a),
      atLimit: (k) => raw.usage[k] >= plan.limits[k],
    };
  }, [raw, user, refresh]);

  if (loading && !raw) return <Spinner label="Loading workspace…" />;
  if (error) return <div className="mx-auto max-w-lg p-8"><ErrorState message={error} onRetry={() => window.location.reload()} /></div>;
  if (!value || value.member.status !== 'active') {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold">You don't have access to this workspace</h1>
        <p className="mt-2 text-sm text-slate-600">Your account is not an active member of this workspace. Ask a workspace admin to add you or restore your access.</p>
        <Link to="/workspaces" className="btn btn-primary mt-5">Back to workspaces</Link>
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return c;
}
