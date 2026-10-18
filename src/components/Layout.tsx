import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard, Globe, KanbanSquare, LayoutDashboard, LogOut, Megaphone, Menu, MessageSquareText, Repeat, Settings, Tags, Users, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { Badge } from './ui';
import { ROLE_LABEL, ROLE_TONE, cx, hexToRgb, initial } from '../lib/utils';
import type { Action } from '../lib/utils';

const NAV: { to: string; label: string; icon: LucideIcon; action?: Action }[] = [
  { to: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, action: 'dashboard.view' },
  { to: 'feedback', label: 'Feedback', icon: MessageSquareText },
  { to: 'categories', label: 'Categories & Tags', icon: Tags, action: 'category.manage' },
  { to: 'roadmap', label: 'Roadmap', icon: KanbanSquare },
  { to: 'release-notes', label: 'Release Notes', icon: Megaphone },
  { to: 'team', label: 'Team & Roles', icon: Users, action: 'team.manage' },
  { to: 'subscription', label: 'Subscription & Usage', icon: CreditCard, action: 'subscription.view' },
  { to: 'settings', label: 'Workspace Settings', icon: Settings, action: 'workspace.settings' },
];

export function WorkspaceLogo({ name, url, size = 36 }: { name: string; url?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  if (url && !broken) return <img src={url} alt="" onError={() => setBroken(true)} style={{ width: size, height: size }} className="shrink-0 rounded-lg object-cover" />;
  return <div style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-lg bg-brand font-bold text-white">{initial(name)}</div>;
}

export default function Layout() {
  const { workspace, role, user, can, plan, usage } = useWorkspace();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);

  const labels = { members: 'team members', feedback: 'feedback items', roadmapItems: 'roadmap items' } as const;
  const warnings = can('subscription.view')
    ? (Object.keys(labels) as (keyof typeof labels)[]).filter((k) => usage[k] >= plan.limits[k] * 0.8)
    : [];

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        <WorkspaceLogo name={workspace.name} url={workspace.logoUrl} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{workspace.name}</p>
          <p className="text-xs text-slate-400">{plan.name} plan</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Workspace">
        {NAV.filter((n) => !n.action || can(n.action)).map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white')}>
            <n.icon className="h-4 w-4" /> {n.label}
          </NavLink>
        ))}
        {workspace.publicRoadmap && (
          <a href={`/public/${workspace.id}/roadmap`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">
            <Globe className="h-4 w-4" /> Public roadmap
          </a>
        )}
      </nav>
      <div className="space-y-3 border-t border-white/10 p-4">
        <div>
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <div className="mt-1"><Badge tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge></div>
        </div>
        <div className="flex gap-2">
          <Link to="/workspaces" className="btn btn-sm flex-1 bg-white/10 text-white hover:bg-white/20"><Repeat className="h-3.5 w-3.5" /> Switch</Link>
          <button className="btn btn-sm flex-1 bg-white/10 text-white hover:bg-white/20" onClick={() => { logout(); navigate('/login'); }}><LogOut className="h-3.5 w-3.5" /> Log out</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex" style={{ ['--brand-rgb' as string]: hexToRgb(workspace.brandColor) } as CSSProperties}>
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2"><WorkspaceLogo name={workspace.name} url={workspace.logoUrl} size={28} /><span className="text-sm font-semibold">{workspace.name}</span></div>
        <button aria-label="Open menu" className="rounded p-1.5 hover:bg-slate-100" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">
            {sidebar}
            <button aria-label="Close menu" className="absolute right-2 top-3 rounded p-1.5 text-white hover:bg-white/10" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
          </div>
        </div>
      )}
      <main className="min-w-0 flex-1 lg:ml-64">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          {warnings.length > 0 && (
            <div role="alert" className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {warnings.map((k) => `${usage[k]} of ${plan.limits[k]} ${labels[k]}`).join(', ')} used on the {plan.name} plan.
              </span>
              <Link to="subscription" className="font-semibold underline">View usage</Link>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
