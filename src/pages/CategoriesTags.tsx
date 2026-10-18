import { useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { create, errMsg, list, logActivity, patch, remove } from '../api';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAsync } from '../hooks/useAsync';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Spinner, useToast } from '../components/ui';
import { cx } from '../lib/utils';
import type { Category, Feedback, Tag } from '../types';

type Editing = { kind: 'category'; item: Category | null } | { kind: 'tag'; item: Tag | null } | null;
type Deleting = { kind: 'category'; item: Category } | { kind: 'tag'; item: Tag } | null;

export default function CategoriesTags() {
  const { workspace, user } = useWorkspace();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [nameError, setNameError] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const p = { workspaceId: workspace.id };
    const [categories, tags, feedback] = await Promise.all([list<Category>('categories', p), list<Tag>('tags', p), list<Feedback>('feedback', p)]);
    return { categories, tags, feedback };
  }, [workspace.id]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const { categories, tags, feedback } = data;

  const openEditor = (e: NonNullable<Editing>) => {
    setEditing(e); setNameError('');
    setName(e.item ? e.item.name : '');
    setColor(e.kind === 'category' && e.item ? e.item.color : '#4F46E5');
  };

  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!editing) return;
    const trimmed = name.trim();
    const pool = editing.kind === 'category' ? categories : tags;
    if (!trimmed) { setNameError('Enter a name.'); return; }
    if (pool.some((x) => x.name.toLowerCase() === trimmed.toLowerCase() && x.id !== editing.item?.id)) { setNameError(`A ${editing.kind} with this name already exists.`); return; }
    setBusy(true);
    try {
      if (editing.kind === 'category') {
        const body = { name: trimmed, color };
        if (editing.item) await patch('categories', editing.item.id, body); else await create('categories', { ...body, workspaceId: workspace.id });
      } else {
        if (editing.item) await patch('tags', editing.item.id, { name: trimmed }); else await create('tags', { name: trimmed, workspaceId: workspace.id });
      }
      await logActivity(workspace.id, user.id, `${user.name} ${editing.item ? 'updated' : 'created'} ${editing.kind} "${trimmed}"`);
      toast.success(`${editing.kind === 'category' ? 'Category' : 'Tag'} ${editing.item ? 'updated' : 'created'}.`);
      setEditing(null); reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      if (deleting.kind === 'category') {
        await Promise.all(feedback.filter((f) => f.categoryId === deleting.item.id).map((f) => patch('feedback', f.id, { categoryId: null })));
        await remove('categories', deleting.item.id);
      } else {
        await Promise.all(feedback.filter((f) => f.tagIds.includes(deleting.item.id)).map((f) => patch('feedback', f.id, { tagIds: f.tagIds.filter((t) => t !== deleting.item.id) })));
        await remove('tags', deleting.item.id);
      }
      await logActivity(workspace.id, user.id, `${user.name} deleted ${deleting.kind} "${deleting.item.name}"`);
      toast.success(`${deleting.kind === 'category' ? 'Category' : 'Tag'} deleted.`);
      setDeleting(null); reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const usedBy = deleting ? feedback.filter((f) => (deleting.kind === 'category' ? f.categoryId === deleting.item.id : f.tagIds.includes(deleting.item.id))).length : 0;

  return (
    <>
      <PageHeader title="Categories & Tags" subtitle="Organize feedback so it's easy to filter and report on." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Categories</h2><Button size="sm" onClick={() => openEditor({ kind: 'category', item: null })}><Plus className="h-4 w-4" /> Add category</Button></div>
          {categories.length === 0 ? <EmptyState title="No categories yet" hint="Add a category so feedback can be grouped." /> : (
            <ul className="divide-y divide-slate-100">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: c.color }} />{c.name}<span className="text-xs text-slate-400">{feedback.filter((f) => f.categoryId === c.id).length} items</span></span>
                  <span className="flex gap-1"><Button variant="ghost" size="sm" aria-label={`Edit ${c.name}`} onClick={() => openEditor({ kind: 'category', item: c })}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="sm" aria-label={`Delete ${c.name}`} onClick={() => setDeleting({ kind: 'category', item: c })}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Tags</h2><Button size="sm" onClick={() => openEditor({ kind: 'tag', item: null })}><Plus className="h-4 w-4" /> Add tag</Button></div>
          {tags.length === 0 ? <EmptyState title="No tags yet" hint="Tags add a second way to group feedback." /> : (
            <ul className="divide-y divide-slate-100">
              {tags.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span>#{t.name} <span className="text-xs text-slate-400">{feedback.filter((f) => f.tagIds.includes(t.id)).length} items</span></span>
                  <span className="flex gap-1"><Button variant="ghost" size="sm" aria-label={`Edit ${t.name}`} onClick={() => openEditor({ kind: 'tag', item: t })}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="sm" aria-label={`Delete ${t.name}`} onClick={() => setDeleting({ kind: 'tag', item: t })}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal open={!!editing} title={editing ? `${editing.item ? 'Edit' : 'Add'} ${editing.kind}` : ''} onClose={() => setEditing(null)}>
        <form onSubmit={save} noValidate className="space-y-4">
          <Field label="Name" required error={nameError}><input className={cx('input', nameError && 'input-error')} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus /></Field>
          {editing?.kind === 'category' && <Field label="Color"><input type="color" className="h-10 w-20 cursor-pointer rounded border border-slate-300" value={color} onChange={(e) => setColor(e.target.value)} /></Field>}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.kind || ''}?`} busy={busy} onCancel={() => setDeleting(null)} onConfirm={doDelete}
        message={<>"{deleting?.item.name}" will be deleted.{usedBy > 0 && ` It is used by ${usedBy} feedback item${usedBy > 1 ? 's' : ''}, which will ${deleting?.kind === 'category' ? 'become uncategorized' : 'lose this tag'}.`}</>} />
    </>
  );
}
