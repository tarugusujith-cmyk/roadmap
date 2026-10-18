import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { deleteWorkspaceCascade, errMsg, logActivity, patch } from '../api';
import { useWorkspace } from '../context/WorkspaceContext';
import { Button, ConfirmDialog, Field, PageHeader, useToast } from '../components/ui';
import { WorkspaceLogo } from '../components/Layout';
import { cx, isValidUrl } from '../lib/utils';

export default function Settings() {
  const { workspace, user, refresh } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: workspace.name, description: workspace.description, logoUrl: workspace.logoUrl.startsWith('data:') ? '' : workspace.logoUrl, brandColor: workspace.brandColor, publicRoadmap: workspace.publicRoadmap });
  const [keepLogo, setKeepLogo] = useState(workspace.logoUrl.startsWith('data:'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => { setErrors({}); }, [workspace.id]);
  const publicUrl = `${window.location.origin}/public/${workspace.id}/roadmap`;
  const logo = keepLogo ? workspace.logoUrl : form.logoUrl.trim();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 3) next.name = 'Workspace name must be at least 3 characters.';
    if (!keepLogo && !isValidUrl(form.logoUrl.trim())) next.logoUrl = 'Enter a valid image URL starting with http:// or https://.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await patch('workspaces', workspace.id, { name: form.name.trim(), description: form.description.trim(), logoUrl: logo, brandColor: form.brandColor, publicRoadmap: form.publicRoadmap });
      await logActivity(workspace.id, user.id, `${user.name} updated the workspace settings`);
      await refresh();
      toast.success('Workspace settings saved.');
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try { await deleteWorkspaceCascade(workspace.id); toast.success('Workspace deleted.'); navigate('/workspaces'); }
    catch (e) { toast.error(errMsg(e)); setBusy(false); setConfirmDelete(false); }
  };

  return (
    <>
      <PageHeader title="Workspace Settings" subtitle="Name, branding and public roadmap options for this workspace." />
      <form onSubmit={save} noValidate className="card max-w-2xl space-y-4 p-5">
        <div className="flex items-center gap-3"><WorkspaceLogo name={form.name || workspace.name} url={logo} size={48} /><p className="text-sm text-slate-500">Preview of your logo</p></div>
        <Field label="Workspace name" required error={errors.name}><input className={cx('input', errors.name && 'input-error')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} /></Field>
        <Field label="Description"><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={240} /></Field>
        <Field label="Logo URL" error={errors.logoUrl} hint={keepLogo ? 'Using the current logo. Type a URL to replace it.' : 'Optional. Leave empty to use the first letter of the name.'}>
          <input className={cx('input', errors.logoUrl && 'input-error')} value={form.logoUrl} placeholder="https://…" onChange={(e) => { setKeepLogo(false); setForm({ ...form, logoUrl: e.target.value }); }} />
        </Field>
        <Field label="Brand color">
          <span className="flex items-center gap-3"><input type="color" className="h-10 w-20 cursor-pointer rounded border border-slate-300" value={form.brandColor} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} /><code className="text-sm text-slate-500">{form.brandColor}</code></span>
        </Field>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.publicRoadmap} onChange={(e) => setForm({ ...form, publicRoadmap: e.target.checked })} /> Make the roadmap public</label>
          <p className="mt-1 text-xs text-slate-500">Anyone with the link can see items you've published, without signing in.</p>
          {form.publicRoadmap && (
            <div className="mt-2 flex items-center gap-2"><input readOnly aria-label="Public roadmap URL" className="input" value={publicUrl} onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="secondary" onClick={() => { navigator.clipboard?.writeText(publicUrl); toast.success('Link copied.'); }}><Copy className="h-4 w-4" /> Copy</Button></div>
          )}
        </div>
        <div className="flex justify-end"><Button type="submit" loading={busy}>Save settings</Button></div>
      </form>

      <section className="mt-8 max-w-2xl rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="font-semibold text-red-800">Delete workspace</h2>
        <p className="mt-1 text-sm text-red-700">Permanently deletes this workspace with all feedback, votes, comments, roadmap items, release notes and members.</p>
        <Button variant="danger" className="mt-3" onClick={() => { setConfirmName(''); setConfirmDelete(true); }}>Delete workspace</Button>
      </section>
      <ConfirmDialog open={confirmDelete} title="Delete this workspace?" confirmLabel="Delete workspace" busy={busy} onCancel={() => setConfirmDelete(false)} onConfirm={() => confirmName === workspace.name && doDelete()}
        message={<div className="space-y-3"><p>This can't be undone. Type <strong>{workspace.name}</strong> to confirm.</p><input className="input" aria-label="Confirm workspace name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />{confirmName !== '' && confirmName !== workspace.name && <p className="text-xs text-red-600">The name doesn't match yet.</p>}</div>} />
    </>
  );
}
