import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Globe, LogOut, Plus } from 'lucide-react';
import { create, errMsg, list, logActivity } from '../api';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { Badge, Button, EmptyState, ErrorState, Field, Modal, Spinner, useToast } from '../components/ui';
import { WorkspaceLogo } from '../components/Layout';
import { MEMBER_STATUS, ROLE_LABEL, ROLE_TONE, find, hexToRgb, isValidUrl, nowISO, can } from '../lib/utils';
import type { Member, Workspace } from '../types';

const empty = { name: '', description: '', logoUrl: '', brandColor: '#4F46E5', publicRoadmap: true };

export default function WorkspaceSelector() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const [members, workspaces] = await Promise.all([list<Member>('workspaceMembers', { userId: user!.id }), list<Workspace>('workspaces')]);
    return members
      .map((m) => ({ member: m, workspace: workspaces.find((w) => w.id === m.workspaceId) }))
      .filter((x): x is { member: Member; workspace: Workspace } => !!x.workspace);
  }, [user?.id]);

  const set = (k: keyof typeof empty, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 3) next.name = 'Workspace name must be at least 3 characters.';
    if (!isValidUrl(form.logoUrl.trim())) next.logoUrl = 'Enter a valid image URL starting with http:// or https://.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const ws = await create<Workspace>('workspaces', { name: form.name.trim(), description: form.description.trim(), logoUrl: form.logoUrl.trim(), brandColor: form.brandColor, publicRoadmap: form.publicRoadmap, ownerId: user!.id, createdAt: nowISO() });
      await Promise.all([
        create('workspaceMembers', { workspaceId: ws.id, userId: user!.id, role: 'owner', status: 'active', joinedAt: nowISO() }),
        create('workspaceSubscriptions', { workspaceId: ws.id, planId: 'free', startedAt: nowISO() }),
        ...[['General', '#64748B'], ['Bug report', '#DC2626'], ['Feature request', '#4F46E5']].map(([name, color]) => create('categories', { workspaceId: ws.id, name, color })),
      ]);
      await logActivity(ws.id, user!.id, `${user!.name} created the workspace`);
      toast.success(`Workspace "${ws.name}" created.`);
      setOpen(false); setForm(empty);
      navigate(`/w/${ws.id}`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold"><Activity className="h-6 w-6 text-indigo-600" /> ProductPulse</div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-slate-600 sm:inline">{user?.name}</span>
          <Button variant="secondary" size="sm" onClick={() => { logout(); navigate('/login'); }}><LogOut className="h-4 w-4" /> Log out</Button>
        </div>
      </header>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your workspaces</h1>
          <p className="mt-1 text-sm text-slate-500">Each workspace has its own feedback, roadmap, team and settings.</p>
        </div>
        <Button onClick={() => { setErrors({}); setOpen(true); }}><Plus className="h-4 w-4" /> Create workspace</Button>
      </div>

      {loading && !data && <Spinner />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="You're not part of any workspace yet" hint="Create one to start collecting feedback." action={<Button onClick={() => setOpen(true)}>Create workspace</Button>} />}
      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map(({ member, workspace }) => {
            const active = member.status === 'active';
            return (
              <div key={member.id} className="card flex flex-col p-5" style={{ borderTop: `4px solid rgb(${hexToRgb(workspace.brandColor).replace(/ /g, ',')})` }}>
                <div className="flex items-center gap-3">
                  <WorkspaceLogo name={workspace.name} url={workspace.logoUrl} size={40} />
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{workspace.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-1"><Badge tone={ROLE_TONE[member.role]}>{ROLE_LABEL[member.role]}</Badge>{!active && <Badge tone={find(MEMBER_STATUS, member.status).tone}>{find(MEMBER_STATUS, member.status).label}</Badge>}</div>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 flex-1 text-sm text-slate-600">{workspace.description || 'No description yet.'}</p>
                <div className="mt-4 flex items-center justify-between">
                  {active
                    ? <Link className="btn btn-primary btn-sm" to={`/w/${workspace.id}/${can(member.role, 'dashboard.view') ? 'dashboard' : 'feedback'}`}>Open</Link>
                    : <span className="text-xs text-slate-500">Access is not active</span>}
                  {workspace.publicRoadmap && <Link className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800" to={`/public/${workspace.id}/roadmap`}><Globe className="h-3.5 w-3.5" /> Public roadmap</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} title="Create workspace" onClose={() => setOpen(false)}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Workspace name" required error={errors.name}><input className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={60} /></Field>
          <Field label="Description"><textarea className="input" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={240} /></Field>
          <Field label="Logo URL" error={errors.logoUrl} hint="Optional. Leave empty to use the first letter of the name."><input className={`input ${errors.logoUrl ? 'input-error' : ''}`} value={form.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://…" /></Field>
          <Field label="Brand color"><input type="color" className="h-10 w-20 cursor-pointer rounded border border-slate-300" value={form.brandColor} onChange={(e) => set('brandColor', e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.publicRoadmap} onChange={(e) => set('publicRoadmap', e.target.checked)} /> Make the roadmap public</label>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={busy}>Create workspace</Button></div>
        </form>
      </Modal>
    </div>
  );
}
