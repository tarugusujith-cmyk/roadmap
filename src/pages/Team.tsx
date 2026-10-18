import { useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { create, errMsg, list, logActivity, patch, remove } from '../api';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAsync } from '../hooks/useAsync';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Spinner, useToast } from '../components/ui';
import { MEMBER_STATUS, ROLE_LABEL, ROLE_TONE, assignableRoles, canManageMember, cx, find, fmtDate, isEmail, nowISO } from '../lib/utils';
import type { Member, MemberStatus, Role, User } from '../types';

const blank = { name: '', email: '', role: 'customer' as Role, status: 'active' as MemberStatus };

export default function Team() {
  const { workspace, user, role: myRole, atLimit, plan, usage, refresh } = useWorkspace();
  const toast = useToast();
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const [members, users] = await Promise.all([list<Member>('workspaceMembers', { workspaceId: workspace.id }), list<User>('users')]);
    return { members, users };
  }, [workspace.id]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const { members, users } = data;
  const roles = assignableRoles(myRole);
  const limit = atLimit('members');
  const person = (m: Member) => users.find((u) => u.id === m.userId);

  const openForm = (m: Member | 'new') => {
    setErrors({}); setEditing(m);
    if (m === 'new') setForm(blank);
    else { const u = person(m); setForm({ name: u?.name || '', email: u?.email || '', role: m.role, status: m.status }); }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const isNew = editing === 'new';
    const next: Record<string, string> = {};
    const email = form.email.trim().toLowerCase();
    if (isNew) {
      if (form.name.trim().length < 2) next.name = 'Enter the member\'s name.';
      if (!email) next.email = 'Enter an email address.';
      else if (!isEmail(email)) next.email = 'Enter a valid email address.';
      else if (members.some((m) => person(m)?.email === email)) next.email = 'This person is already a member of the workspace.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      if (isNew) {
        let u = users.find((x) => x.email === email);
        if (!u) u = await create<User>('users', { name: form.name.trim(), email, password: 'demo123' });
        await create('workspaceMembers', { workspaceId: workspace.id, userId: u.id, role: form.role, status: form.status, joinedAt: nowISO() });
        await logActivity(workspace.id, user.id, `${user.name} added ${u.name} as ${ROLE_LABEL[form.role]}`);
        toast.success(`${u.name} added to the workspace.`);
      } else if (editing) {
        await patch('workspaceMembers', editing.id, { role: form.role, status: form.status });
        await logActivity(workspace.id, user.id, `${user.name} updated ${person(editing)?.name || 'a member'}`);
        toast.success('Member updated.');
      }
      await refresh();
      setEditing(null); reload();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const doRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await remove('workspaceMembers', removing.id);
      await logActivity(workspace.id, user.id, `${user.name} removed ${person(removing)?.name || 'a member'}`);
      await refresh();
      toast.success('Member removed.');
      setRemoving(null); reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const editingMember = editing && editing !== 'new' ? editing : null;

  return (
    <>
      <PageHeader title="Team & Roles" subtitle={`${usage.members} of ${plan.limits.members} members on the ${plan.name} plan.`}
        actions={limit ? <Button disabled title="Member limit reached"><Plus className="h-4 w-4" /> Add member</Button> : <Button onClick={() => openForm('new')}><Plus className="h-4 w-4" /> Add member</Button>} />
      {limit && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">The {plan.name} plan allows {plan.limits.members} members. Upgrade the plan or remove a member to add more.</p>}
      {members.length === 0 ? <EmptyState title="No members yet" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Member</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Joined</th><th className="px-4 py-3 text-right font-medium">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const u = person(m); const st = find(MEMBER_STATUS, m.status); const manageable = canManageMember(myRole, m.role);
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-3"><p className="font-medium">{u?.name || 'Unknown user'}{m.userId === user.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}</p><p className="text-xs text-slate-500">{u?.email}</p></td>
                    <td className="px-4 py-3"><Badge tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(m.joinedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {manageable ? <span className="inline-flex gap-1"><Button variant="ghost" size="sm" aria-label={`Edit ${u?.name}`} onClick={() => openForm(m)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="sm" aria-label={`Remove ${u?.name}`} onClick={() => setRemoving(m)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button></span> : <span className="text-xs text-slate-400">Locked</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Owners can manage admins, product managers and customers. Admins can manage product managers and customers.</p>

      <Modal open={!!editing} title={editing === 'new' ? 'Add member' : 'Edit member'} onClose={() => setEditing(null)}>
        <form onSubmit={save} noValidate className="space-y-4">
          <Field label="Name" required={!editingMember} error={errors.name}><input className={cx('input', errors.name && 'input-error')} value={form.name} disabled={!!editingMember} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email" required={!editingMember} error={errors.email} hint={!editingMember ? 'New people get the demo password "demo123".' : undefined}><input type="email" className={cx('input', errors.email && 'input-error')} value={form.email} disabled={!!editingMember} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role"><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
            <Field label="Status"><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as MemberStatus })}>{MEMBER_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={busy}>{editing === 'new' ? 'Add member' : 'Save changes'}</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!removing} title="Remove this member?" confirmLabel="Remove" busy={busy} onCancel={() => setRemoving(null)} onConfirm={doRemove}
        message={<>{removing && person(removing)?.name} will lose access to {workspace.name}. Their feedback, votes and comments stay in the workspace.</>} />
    </>
  );
}
