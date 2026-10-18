import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Pencil, Plus, ThumbsUp, Trash2 } from 'lucide-react';
import { create, errMsg, list, logActivity, patch, remove } from '../api';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAsync } from '../hooks/useAsync';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Spinner, useToast } from '../components/ui';
import { STAGES, STAGE_TO_STATUS, cx, nowISO } from '../lib/utils';
import type { Feedback, ReleaseNote, RoadmapItem, Stage, Vote } from '../types';

const blank = { title: '', description: '', stage: 'under_review' as Stage, published: false, feedbackIds: [] as number[] };

export default function RoadmapBoard() {
  const { workspace, user, can, atLimit, plan, refresh } = useWorkspace();
  const toast = useToast();
  const canEdit = can('roadmap.edit');
  const canStage = can('roadmap.stage');
  const [editing, setEditing] = useState<RoadmapItem | 'new' | null>(null);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<RoadmapItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    const p = { workspaceId: workspace.id };
    const [items, feedback, votes, releases] = await Promise.all([list<RoadmapItem>('roadmapItems', p), list<Feedback>('feedback', p), list<Vote>('votes', p), list<ReleaseNote>('releaseNotes', p)]);
    return { items, feedback, votes, releases };
  }, [workspace.id]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const { items, feedback, votes, releases } = data;
  const visible = canEdit || canStage ? items : items.filter((i) => i.published);
  const limit = atLimit('roadmapItems');

  const voteTotal = (item: RoadmapItem) => votes.filter((v) => item.feedbackIds.includes(v.feedbackId)).length;
  /** Linked feedback follows the stage of its roadmap item. */
  const syncLinked = (ids: number[], stage: Stage) =>
    Promise.all(feedback.filter((f) => ids.includes(f.id) && f.status !== STAGE_TO_STATUS[stage]).map((f) => patch('feedback', f.id, { status: STAGE_TO_STATUS[stage], updatedAt: nowISO() })));

  const move = async (item: RoadmapItem, stage: Stage) => {
    if (item.stage === stage || !canStage) return;
    try {
      await patch('roadmapItems', item.id, { stage, updatedAt: nowISO() });
      await syncLinked(item.feedbackIds, stage);
      await logActivity(workspace.id, user.id, `Roadmap item "${item.title}" moved to ${STAGES.find((s) => s.value === stage)?.label}`);
      toast.success(`Moved to ${STAGES.find((s) => s.value === stage)?.label}.`);
      reload();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const openForm = (item: RoadmapItem | 'new') => {
    setErrors({}); setSearch(''); setEditing(item);
    setForm(item === 'new' ? blank : { title: item.title, description: item.description, stage: item.stage, published: item.published, feedbackIds: item.feedbackIds });
  };
  const toggleFb = (id: number) => setForm((f) => ({ ...f, feedbackIds: f.feedbackIds.includes(id) ? f.feedbackIds.filter((x) => x !== id) : [...f.feedbackIds, id] }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.title.trim().length < 3) next.title = 'Title must be at least 3 characters.';
    if (form.description.trim().length < 5) next.description = 'Add a short description (5+ characters).';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const body = { title: form.title.trim(), description: form.description.trim(), stage: form.stage, published: form.published, feedbackIds: form.feedbackIds, updatedAt: nowISO() };
      if (editing && editing !== 'new') await patch('roadmapItems', editing.id, body);
      else await create('roadmapItems', { ...body, workspaceId: workspace.id, createdAt: nowISO() });
      await syncLinked(form.feedbackIds, form.stage);
      await logActivity(workspace.id, user.id, `${user.name} ${editing === 'new' ? 'created' : 'updated'} roadmap item "${body.title}"`);
      await refresh();
      toast.success(editing === 'new' ? 'Roadmap item created.' : 'Roadmap item updated.');
      setEditing(null); reload();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await Promise.all(releases.filter((r) => r.roadmapItemIds.includes(deleting.id)).map((r) => patch('releaseNotes', r.id, { roadmapItemIds: r.roadmapItemIds.filter((x) => x !== deleting.id) })));
      await remove('roadmapItems', deleting.id);
      await logActivity(workspace.id, user.id, `${user.name} deleted roadmap item "${deleting.title}"`);
      await refresh();
      toast.success('Roadmap item deleted.');
      setDeleting(null); reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const togglePublish = async (item: RoadmapItem) => {
    try { await patch('roadmapItems', item.id, { published: !item.published, updatedAt: nowISO() }); toast.success(item.published ? 'Hidden from the public roadmap.' : 'Published to the public roadmap.'); reload(); } catch (e) { toast.error(errMsg(e)); }
  };

  const needle = search.trim().toLowerCase();
  const pickable = feedback.filter((f) => !needle || f.title.toLowerCase().includes(needle));

  return (
    <>
      <PageHeader
        title="Roadmap"
        subtitle={canEdit || canStage ? 'Drag cards between stages, or use the stage menu on each card. Linked feedback follows the stage.' : 'What the team is working on. Items here are published by the team.'}
        actions={canEdit && (limit
          ? <Button disabled title={`The ${plan.name} plan allows ${plan.limits.roadmapItems} roadmap items`}><Plus className="h-4 w-4" /> New item</Button>
          : <Button onClick={() => openForm('new')}><Plus className="h-4 w-4" /> New item</Button>)}
      />
      {canEdit && limit && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">This workspace reached the {plan.name} plan limit of {plan.limits.roadmapItems} roadmap items.</p>}
      {visible.length === 0 ? <EmptyState title="The roadmap is empty" hint={canEdit ? 'Create the first item and link it to customer feedback.' : 'Nothing has been published yet.'} action={canEdit && !limit ? <Button onClick={() => openForm('new')}>New item</Button> : undefined} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => {
            const col = visible.filter((i) => i.stage === stage.value);
            return (
              <section key={stage.value} aria-label={stage.label} className={cx('rounded-xl bg-slate-100 p-3', dragId && 'ring-2 ring-transparent hover:ring-brand/40')}
                onDragOver={(e) => canStage && e.preventDefault()}
                onDrop={() => { const it = items.find((i) => i.id === dragId); setDragId(null); if (it) move(it, stage.value); }}>
                <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold"><Badge tone={stage.tone}>{stage.label}</Badge><span className="text-xs text-slate-500">{col.length}</span></h2>
                <div className="space-y-3">
                  {col.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">No items</p>}
                  {col.map((item) => (
                    <article key={item.id} draggable={canStage} onDragStart={() => setDragId(item.id)} onDragEnd={() => setDragId(null)} className={cx('card p-3', canStage && 'cursor-grab active:cursor-grabbing')}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium">{item.title}</h3>
                        {(canEdit || canStage) && <span title={item.published ? 'Published' : 'Not published'} className="text-slate-400">{item.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</span>}
                      </div>
                      <p className="mt-1 line-clamp-3 text-xs text-slate-600">{item.description}</p>
                      <p className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span>{item.feedbackIds.length} linked request{item.feedbackIds.length === 1 ? '' : 's'}</span>
                        <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{voteTotal(item)}</span>
                      </p>
                      {item.feedbackIds.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs">
                          {item.feedbackIds.slice(0, 3).map((fid) => { const f = feedback.find((x) => x.id === fid); return f && <li key={fid} className="truncate"><Link className="text-slate-500 hover:text-brand" to={`../feedback/${fid}`}>{f.title}</Link></li>; })}
                          {item.feedbackIds.length > 3 && <li className="text-slate-400">+{item.feedbackIds.length - 3} more</li>}
                        </ul>
                      )}
                      {(canStage || canEdit) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                          {canStage && <select aria-label={`Stage for ${item.title}`} className="input !w-auto !py-1 text-xs" value={item.stage} onChange={(e) => move(item, e.target.value as Stage)}>{STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>}
                          {canEdit && (
                            <span className="ml-auto flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => togglePublish(item)}>{item.published ? 'Unpublish' : 'Publish'}</Button>
                              <Button variant="ghost" size="sm" aria-label={`Edit ${item.title}`} onClick={() => openForm(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="sm" aria-label={`Delete ${item.title}`} onClick={() => setDeleting(item)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
                            </span>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal open={!!editing} wide title={editing === 'new' ? 'New roadmap item' : 'Edit roadmap item'} onClose={() => setEditing(null)}>
        <form onSubmit={save} noValidate className="space-y-4">
          <Field label="Title" required error={errors.title}><input className={cx('input', errors.title && 'input-error')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} /></Field>
          <Field label="Description" required error={errors.description}><textarea className={cx('input', errors.description && 'input-error')} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stage"><select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}>{STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Show on the public roadmap</label>
          </div>
          <Field label={`Linked feedback (${form.feedbackIds.length} selected)`} group>
            <input className="input mb-2" aria-label="Filter feedback" placeholder="Filter feedback" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {pickable.length === 0 ? <p className="p-2 text-sm text-slate-500">No feedback found.</p> : pickable.map((f) => (
                <label key={f.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"><input type="checkbox" checked={form.feedbackIds.includes(f.id)} onChange={() => toggleFb(f.id)} /><span className="truncate">{f.title}</span></label>
              ))}
            </div>
          </Field>
          <p className="text-xs text-slate-500">Saving updates linked feedback to the status that matches the stage.</p>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={busy}>Save item</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleting} title="Delete roadmap item?" busy={busy} onCancel={() => setDeleting(null)} onConfirm={doDelete}
        message={<>"{deleting?.title}" will be removed from the roadmap and from any release notes that reference it. Linked feedback is kept.</>} />
    </>
  );
}
