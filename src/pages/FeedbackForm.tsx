import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { create, errMsg, getOne, list, logActivity, patch } from '../api';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAsync } from '../hooks/useAsync';
import { Button, ErrorState, Field, PageHeader, Spinner, useToast } from '../components/ui';
import { PRIORITY_OPTIONS, STATUS_OPTIONS, cx, nowISO } from '../lib/utils';
import type { Category, Feedback, Priority, FeedbackStatus, Tag } from '../types';

export default function FeedbackForm() {
  const { id } = useParams();
  const editing = !!id;
  const { workspace, user, can, atLimit, plan, refresh } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const manage = can('feedback.manage');

  const [form, setForm] = useState({ title: '', description: '', categoryId: '', tagIds: [] as number[], priority: 'medium' as Priority, status: 'open' as FeedbackStatus });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!editing);

  const meta = useAsync(async () => {
    const p = { workspaceId: workspace.id };
    const [categories, tags, existing] = await Promise.all([
      list<Category>('categories', p), list<Tag>('tags', p),
      editing ? getOne<Feedback>('feedback', id!) : Promise.resolve(null),
    ]);
    return { categories, tags, existing };
  }, [workspace.id, id]);

  useEffect(() => {
    const f = meta.data?.existing;
    if (f && !loaded) {
      setForm({ title: f.title, description: f.description, categoryId: f.categoryId ? String(f.categoryId) : '', tagIds: f.tagIds, priority: f.priority, status: f.status });
      setLoaded(true);
    }
  }, [meta.data, loaded]);

  if (meta.loading && !meta.data) return <Spinner />;
  if (meta.error) return <ErrorState message={meta.error} onRetry={meta.reload} />;
  if (!meta.data) return null;
  const { categories, tags, existing } = meta.data;

  const denied = editing && existing && (existing.workspaceId !== workspace.id || (!manage && existing.submitterId !== user.id));
  if (denied) return <ErrorState message="You can only edit feedback you submitted." />;
  if (!editing && atLimit('feedback')) {
    return <ErrorState message={`This workspace reached the ${plan.name} plan limit of ${plan.limits.feedback} feedback items.`} />;
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleTag = (tid: number) => set('tagIds', form.tagIds.includes(tid) ? form.tagIds.filter((x) => x !== tid) : [...form.tagIds, tid]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.title.trim().length < 5) next.title = 'Title must be at least 5 characters.';
    if (form.description.trim().length < 10) next.description = 'Describe the request in at least 10 characters.';
    if (!form.categoryId) next.categoryId = 'Choose a category.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const body = { title: form.title.trim(), description: form.description.trim(), categoryId: Number(form.categoryId), tagIds: form.tagIds, updatedAt: nowISO() };
      let target: number;
      if (editing && existing) {
        await patch('feedback', existing.id, manage ? { ...body, priority: form.priority, status: form.status } : body);
        target = existing.id;
        await logActivity(workspace.id, user.id, `${user.name} edited feedback "${body.title}"`);
        toast.success('Feedback updated.');
      } else {
        const created = await create<Feedback>('feedback', { ...body, workspaceId: workspace.id, submitterId: user.id, priority: manage ? form.priority : 'medium', status: manage ? form.status : 'open', duplicateOf: null, createdAt: nowISO() });
        target = created.id;
        await logActivity(workspace.id, user.id, `${user.name} submitted feedback "${body.title}"`);
        toast.success('Feedback submitted.');
      }
      await refresh();
      navigate(`/w/${workspace.id}/feedback/${target}`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <PageHeader title={editing ? 'Edit feedback' : 'New feedback'} subtitle="A clear title and a few sentences about the problem help the team prioritize." />
      <form onSubmit={submit} noValidate className="card max-w-2xl space-y-4 p-5">
        <Field label="Title" required error={errors.title}><input className={cx('input', errors.title && 'input-error')} value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} /></Field>
        <Field label="Description" required error={errors.description}><textarea className={cx('input', errors.description && 'input-error')} rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Category" required error={errors.categoryId}>
          <select className={cx('input', errors.categoryId && 'input-error')} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">Select a category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Tags" group hint={tags.length === 0 ? 'No tags exist yet. An admin can create them.' : undefined}>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button key={t.id} type="button" aria-pressed={form.tagIds.includes(t.id)} onClick={() => toggleTag(t.id)} className={cx('rounded-full border px-3 py-1 text-sm', form.tagIds.includes(t.id) ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300 text-slate-600 hover:border-slate-400')}>#{t.name}</button>
            ))}
          </div>
        </Field>
        {manage && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority"><select className="input" value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)}>{PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
            <Field label="Status"><select className="input" value={form.status} onChange={(e) => set('status', e.target.value as FeedbackStatus)}>{STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Submit feedback'}</Button>
        </div>
      </form>
    </>
  );
}
