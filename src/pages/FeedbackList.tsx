import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, MessageSquare, Plus, Search } from 'lucide-react';
import { errMsg, list, toggleVote } from '../api';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAsync } from '../hooks/useAsync';
import { Badge, Button, EmptyState, ErrorState, PageHeader, Spinner, VoteButton, useToast } from '../components/ui';
import { PRIORITY_OPTIONS, STATUS_OPTIONS, find, fmtDate } from '../lib/utils';
import type { Category, Comment, Feedback, Tag, User, Vote } from '../types';

export default function FeedbackList() {
  const { workspace, user, atLimit, plan } = useWorkspace();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [tag, setTag] = useState('');
  const [status, setStatus] = useState('');
  const [prio, setPrio] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [pending, setPending] = useState<number[]>([]);

  const { data, loading, error, reload } = useAsync(async () => {
    const p = { workspaceId: workspace.id };
    const [feedback, categories, tags, votes, comments, users] = await Promise.all([
      list<Feedback>('feedback', p), list<Category>('categories', p), list<Tag>('tags', p),
      list<Vote>('votes', p), list<Comment>('comments', p), list<User>('users'),
    ]);
    return { feedback, categories, tags, votes, comments, users };
  }, [workspace.id]);

  const view = useMemo(() => {
    if (!data) return null;
    const votes = new Map<number, number>();
    const mine = new Set<number>();
    data.votes.forEach((v) => { votes.set(v.feedbackId, (votes.get(v.feedbackId) || 0) + 1); if (v.userId === user.id) mine.add(v.feedbackId); });
    const comments = new Map<number, number>();
    data.comments.forEach((c) => comments.set(c.feedbackId, (comments.get(c.feedbackId) || 0) + 1));
    const dups = new Map<number, number>();
    data.feedback.forEach((f) => f.duplicateOf && dups.set(f.duplicateOf, (dups.get(f.duplicateOf) || 0) + 1));
    const needle = q.trim().toLowerCase();
    const rows = data.feedback
      .filter((f) => !needle || f.title.toLowerCase().includes(needle) || f.description.toLowerCase().includes(needle))
      .filter((f) => !cat || String(f.categoryId) === cat)
      .filter((f) => !tag || f.tagIds.includes(Number(tag)))
      .filter((f) => !status || f.status === status)
      .filter((f) => !prio || f.priority === prio)
      .filter((f) => !from || f.createdAt.slice(0, 10) >= from)
      .filter((f) => !to || f.createdAt.slice(0, 10) <= to)
      .sort((a, b) => {
        if (sort === 'oldest') return a.createdAt.localeCompare(b.createdAt);
        if (sort === 'votes') return (votes.get(b.id) || 0) - (votes.get(a.id) || 0) || b.createdAt.localeCompare(a.createdAt);
        return b.createdAt.localeCompare(a.createdAt);
      });
    return { rows, votes, mine, comments, dups };
  }, [data, q, cat, tag, status, prio, from, to, sort, user.id]);

  const onVote = async (id: number) => {
    if (pending.includes(id)) return;
    setPending((p) => [...p, id]);
    try {
      const added = await toggleVote(workspace.id, id, user.id);
      toast.success(added ? 'Vote added.' : 'Vote removed.');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setPending((p) => p.filter((x) => x !== id));
    }
  };

  const reset = () => { setQ(''); setCat(''); setTag(''); setStatus(''); setPrio(''); setFrom(''); setTo(''); setSort('newest'); };
  const filtered = !!(q || cat || tag || status || prio || from || to);
  const limit = atLimit('feedback');

  return (
    <>
      <PageHeader
        title="Feedback"
        subtitle="Vote on requests, add context in the comments, or submit a new idea."
        actions={limit
          ? <Button disabled title={`The ${plan.name} plan allows ${plan.limits.feedback} feedback items`}><Plus className="h-4 w-4" /> New feedback</Button>
          : <Link to="new" className="btn btn-primary"><Plus className="h-4 w-4" /> New feedback</Link>}
      />
      {limit && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">This workspace reached the {plan.name} plan limit of {plan.limits.feedback} feedback items. An owner can upgrade the plan to add more.</p>}

      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input aria-label="Search feedback" className="input pl-9" placeholder="Search by title or description" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Sort" className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="votes">Most votes</option>
        </select>
        <select aria-label="Category" className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>{data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Tag" className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>{data?.tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select aria-label="Status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select aria-label="Priority" className="input" value={prio} onChange={(e) => setPrio(e.target.value)}>
          <option value="">All priorities</option>{PRIORITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600"><span className="w-10 shrink-0">From</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm text-slate-600"><span className="w-10 shrink-0">To</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {filtered && <div className="flex items-center"><Button variant="ghost" size="sm" onClick={reset}>Clear filters</Button></div>}
      </div>

      {loading && !data && <Spinner />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {view && data && view.rows.length === 0 && (
        <EmptyState title={filtered ? 'No feedback matches these filters' : 'No feedback yet'} hint={filtered ? 'Try a different search or clear the filters.' : 'Be the first to share an idea.'}
          action={filtered ? <Button variant="secondary" onClick={reset}>Clear filters</Button> : limit ? undefined : <Link to="new" className="btn btn-primary">New feedback</Link>} />
      )}
      {view && data && view.rows.length > 0 && (
        <ul className="space-y-3">
          {view.rows.map((f) => {
            const category = data.categories.find((c) => c.id === f.categoryId);
            const author = data.users.find((u) => u.id === f.submitterId);
            const st = find(STATUS_OPTIONS, f.status);
            const pr = find(PRIORITY_OPTIONS, f.priority);
            const dupCount = view.dups.get(f.id) || 0;
            return (
              <li key={f.id} className="card flex gap-4 p-4">
                <VoteButton count={view.votes.get(f.id) || 0} voted={view.mine.has(f.id)} busy={pending.includes(f.id)} onClick={() => onVote(f.id)} />
                <div className="min-w-0 flex-1">
                  <Link to={String(f.id)} className="font-medium text-slate-900 hover:text-brand">{f.title}</Link>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{f.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <Badge tone={pr.tone}>{pr.label} priority</Badge>
                    {category && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: category.color }} />{category.name}</span>}
                    {f.tagIds.map((id) => { const t = data.tags.find((x) => x.id === id); return t && <span key={id} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">#{t.name}</span>; })}
                    {f.duplicateOf && <Badge tone="amber">Duplicate of #{f.duplicateOf}</Badge>}
                    {dupCount > 0 && <Badge tone="violet"><Copy className="mr-1 h-3 w-3" />{dupCount} linked duplicate{dupCount > 1 ? 's' : ''}</Badge>}
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                    <span>{author?.name || 'Unknown user'}</span><span>{fmtDate(f.createdAt)}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{view.comments.get(f.id) || 0}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
