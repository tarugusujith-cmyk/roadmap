import { useState } from 'react';
import type { FormEvent } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { create, errMsg, list, logActivity, patch, remove } from '../api';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAsync } from '../hooks/useAsync';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Spinner, useToast } from '../components/ui';
import { RELEASE_STATUS, cx, find, fmtDate, nowISO } from '../lib/utils';
import type { ReleaseNote, ReleaseStatus, RoadmapItem } from '../types';

const blank = { version: '', releaseDate: new Date().toISOString().slice(0, 10), summary: '', roadmapItemIds: [] as number[] };

export default function ReleaseNotes() {
  const { workspace, user, can } = useWorkspace();
  const toast = useToast();
  const manage = can('release.manage');
  const seeAll = can('release.drafts');
  const [tab, setTab] = useState<'all' | ReleaseStatus>('all');
  const [editing, setEditing] = useState<ReleaseNote | 'new' | null>(null);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<ReleaseNote | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const p = { workspaceId: workspace.id };
    const [notes, items] = await Promise.all([list<ReleaseNote>('releaseNotes', { ...p, _sort: 'releaseDate', _order: 'desc' }), list<RoadmapItem>('roadmapItems', p)]);
    return { notes, items };
  }, [workspace.id]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const { notes, items } = data;
  const base = seeAll ? notes : notes.filter((n) => n.status === 'published');
  const shown = tab === 'all' ? (seeAll ? base.filter((n) => n.status !== 'archived') : base) : base.filter((n) => n.status === tab);
  const completed = items.filter((i) => i.stage === 'completed' || form.roadmapItemIds.includes(i.id));

  const openForm = (n: ReleaseNote | 'new') => {
    setErrors({}); setEditing(n);
    setForm(n === 'new' ? { ...blank, releaseDate: new Date().toISOString().slice(0, 10) } : { version: n.version, releaseDate: n.releaseDate, summary: n.summary, roadmapItemIds: n.roadmapItemIds });
  };
  const toggleItem = (id: number) => setForm((f) => ({ ...f, roadmapItemIds: f.roadmapItemIds.includes(id) ? f.roadmapItemIds.filter((x) => x !== id) : [...f.roadmapItemIds, id] }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const version = form.version.trim();
    if (!version) next.version = 'Enter a version, for example 2.1.0.';
    else if (!/^v?\d+\.\d+(\.\d+)?([-+][\w.]+)?$/.test(version)) next.version = 'Use a version format such as 2.1.0.';
    else if (notes.some((n) => n.version === version && (editing === 'new' || (editing && n.id !== editing.id)))) next.version = 'This version already has release notes.';
    if (!form.releaseDate) next.releaseDate = 'Choose a release date.';
    if (form.summary.trim().length < 10) next.summary = 'Write a summary of at least 10 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const body = { version, releaseDate: form.releaseDate, summary: form.summary.trim(), roadmapItemIds: form.roadmapItemIds };
      if (editing && editing !== 'new') await patch('releaseNotes', editing.id, body);
      else await create('releaseNotes', { ...body, workspaceId: workspace.id, status: 'draft', createdAt: nowISO() });
      await logActivity(workspace.id, user.id, `${user.name} ${editing === 'new' ? 'drafted' : 'edited'} release notes ${version}`);
      toast.success(editing === 'new' ? 'Release notes saved as a draft.' : 'Release notes updated.');
      setEditing(null); reload();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const setStatus = async (n: ReleaseNote, status: ReleaseStatus, msg: string) => {
    try {
      await patch('releaseNotes', n.id, { status });
      await logActivity(workspace.id, user.id, `Release ${n.version} ${status === 'draft' ? 'restored to draft' : status}`);
      toast.success(msg); reload();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try { await remove('releaseNotes', deleting.id); await logActivity(workspace.id, user.id, `${user.name} deleted release notes ${deleting.version}`); toast.success('Release notes deleted.'); setDeleting(null); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const tabs: { key: 'all' | ReleaseStatus; label: string }[] = seeAll ? [{ key: 'all', label: 'Current' }, ...RELEASE_STATUS.map((s) => ({ key: s.value, label: s.label }))] : [];

  return (
    <>
      <PageHeader title="Release Notes" subtitle="What shipped and when." actions={manage && <Button onClick={() => openForm('new')}><Plus className="h-4 w-4" /> New release notes</Button>} />
      {tabs.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2" role="tablist">
          {tabs.map((t) => <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cx('rounded-full px-3 py-1 text-sm', tab === t.key ? 'bg-brand text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>{t.label}</button>)}
        </div>
      )}
      {shown.length === 0 ? <EmptyState title="No release notes here" hint={manage ? 'Create release notes for your latest version.' : 'Nothing has been published yet.'} action={manage ? <Button onClick={() => openForm('new')}>New release notes</Button> : undefined} /> : (
        <ul className="space-y-4">
          {shown.map((n) => {
            const st = find(RELEASE_STATUS, n.status);
            const related = items.filter((i) => n.roadmapItemIds.includes(i.id));
            return (
              <li key={n.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="text-lg font-semibold">Version {n.version}</h2><p className="text-sm text-slate-500">Released {fmtDate(n.releaseDate)}</p></div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{n.summary}</p>
                {related.length > 0 && <div className="mt-3"><p className="text-xs font-medium text-slate-500">Completed features</p><ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{related.map((r) => <li key={r.id}>{r.title}</li>)}</ul></div>}
                {manage && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {n.status !== 'published' && n.status !== 'archived' && <Button size="sm" onClick={() => setStatus(n, 'published', 'Release notes published.')}><Send className="h-3.5 w-3.5" /> Publish</Button>}
                    {n.status === 'published' && <Button size="sm" variant="secondary" onClick={() => setStatus(n, 'draft', 'Moved back to draft.')}>Unpublish</Button>}
                    {n.status !== 'archived' && <Button size="sm" variant="secondary" onClick={() => setStatus(n, 'archived', 'Release notes archived.')}><Archive className="h-3.5 w-3.5" /> Archive</Button>}
                    {n.status === 'archived' && <Button size="sm" variant="secondary" onClick={() => setStatus(n, 'draft', 'Restored to draft.')}><ArchiveRestore className="h-3.5 w-3.5" /> Restore</Button>}
                    <Button size="sm" variant="secondary" onClick={() => openForm(n)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(n)}><Trash2 className="h-3.5 w-3.5 text-red-600" /> Delete</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!editing} wide title={editing === 'new' ? 'New release notes' : 'Edit release notes'} onClose={() => setEditing(null)}>
        <form onSubmit={save} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Version" required error={errors.version}><input className={cx('input', errors.version && 'input-error')} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="2.1.0" /></Field>
            <Field label="Release date" required error={errors.releaseDate}><input type="date" className={cx('input', errors.releaseDate && 'input-error')} value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} /></Field>
          </div>
          <Field label="Summary" required error={errors.summary}><textarea className={cx('input', errors.summary && 'input-error')} rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field>
          <Field label="Related completed features" group hint="Only completed roadmap items can be selected.">
            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {completed.length === 0 ? <p className="p-2 text-sm text-slate-500">No completed roadmap items yet.</p> : completed.map((i) => (
                <label key={i.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"><input type="checkbox" checked={form.roadmapItemIds.includes(i.id)} onChange={() => toggleItem(i.id)} />{i.title}</label>
              ))}
            </div>
          </Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleting} title="Delete release notes?" busy={busy} onCancel={() => setDeleting(null)} onConfirm={doDelete} message={<>Version {deleting?.version} will be deleted permanently. Consider archiving instead if you want to keep a record.</>} />
    </>
  );
}
