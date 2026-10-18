import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Link2Off, Pencil, Trash2 } from 'lucide-react';
import { create, deleteFeedbackCascade, errMsg, getOne, list, logActivity, patch, remove, toggleVote } from '../api';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAsync } from '../hooks/useAsync';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Modal, Spinner, VoteButton, useToast } from '../components/ui';
import { PRIORITY_OPTIONS, STATUS_OPTIONS, find, fmtDate, nowISO } from '../lib/utils';
import type { Category, Comment, Feedback, FeedbackStatus, Priority, Tag, User, Vote } from '../types';

export default function FeedbackDetail() {
  const { id } = useParams();
  const { workspace, user, role, can, refresh } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const manage = can('feedback.manage');

  const [body, setBody] = useState('');
  const [bodyError, setBodyError] = useState('');
  const [posting, setPosting] = useState(false);
  const [voting, setVoting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [primaryId, setPrimaryId] = useState('');
  const [mergeVotes, setMergeVotes] = useState(true);
  const [linking, setLinking] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    const fb = await getOne<Feedback>('feedback', id!);
    if (fb.workspaceId !== workspace.id) throw new Error('This feedback belongs to a different workspace.');
    const p = { workspaceId: workspace.id };
    const [all, categories, tags, votes, comments, users] = await Promise.all([
      list<Feedback>('feedback', p), list<Category>('categories', p), list<Tag>('tags', p),
      list<Vote>('votes', { feedbackId: fb.id }), list<Comment>('comments', { feedbackId: fb.id, _sort: 'createdAt', _order: 'asc' }), list<User>('users'),
    ]);
    return { fb, all, categories, tags, votes, comments, users };
  }, [workspace.id, id]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const { fb, all, categories, tags, votes, comments, users } = data;

  const userName = (uid: number) => users.find((u) => u.id === uid)?.name || 'Unknown user';
  const category = categories.find((c) => c.id === fb.categoryId);
  const primary = fb.duplicateOf ? all.find((f) => f.id === fb.duplicateOf) : undefined;
  const duplicates = all.filter((f) => f.duplicateOf === fb.id);
  const voted = votes.some((v) => v.userId === user.id);
  const canEdit = manage || fb.submitterId === user.id;
  const st = find(STATUS_OPTIONS, fb.status);
  const pr = find(PRIORITY_OPTIONS, fb.priority);
  const candidates = all.filter((f) => f.id !== fb.id && !f.duplicateOf);

  const run = async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); toast.success(ok); reload(); } catch (e) { toast.error(errMsg(e)); }
  };

  const onVote = async () => {
    if (voting) return;
    setVoting(true);
    await run(async () => { await toggleVote(workspace.id, fb.id, user.id); }, voted ? 'Vote removed.' : 'Vote added.');
    setVoting(false);
  };

  const quickUpdate = (changes: { status?: FeedbackStatus; priority?: Priority }) =>
    run(async () => {
      await patch('feedback', fb.id, { ...changes, updatedAt: nowISO() });
      await logActivity(workspace.id, user.id, `${user.name} updated "${fb.title}"`);
    }, 'Feedback updated.');

  const addComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) { setBodyError('Write a comment before posting.'); return; }
    setBodyError(''); setPosting(true);
    await run(async () => {
      await create('comments', { workspaceId: workspace.id, feedbackId: fb.id, userId: user.id, body: body.trim(), createdAt: nowISO() });
      setBody('');
    }, 'Comment posted.');
    setPosting(false);
  };

  const deleteComment = async () => {
    if (!commentToDelete) return;
    const c = commentToDelete;
    setCommentToDelete(null);
    await run(async () => { await remove('comments', c.id); }, 'Comment deleted.');
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteFeedbackCascade(fb);
      await logActivity(workspace.id, user.id, `${user.name} deleted feedback "${fb.title}"`);
      await refresh();
      toast.success('Feedback deleted.');
      navigate(`/w/${workspace.id}/feedback`);
    } catch (e) {
      toast.error(errMsg(e));
      setDeleting(false); setConfirmDelete(false);
    }
  };

  const linkDuplicate = async () => {
    if (!primaryId) return;
    setLinking(true);
    const target = all.find((f) => f.id === Number(primaryId))!;
    await run(async () => {
      if (mergeVotes) {
        const [mine, theirs] = await Promise.all([list<Vote>('votes', { feedbackId: fb.id }), list<Vote>('votes', { feedbackId: target.id })]);
        const have = new Set(theirs.map((v) => v.userId));
        for (const v of mine) {
          if (have.has(v.userId)) await remove('votes', v.id);
          else { await patch('votes', v.id, { feedbackId: target.id }); have.add(v.userId); }
        }
      }
      await Promise.all(duplicates.map((d) => patch('feedback', d.id, { duplicateOf: target.id })));
      await patch('feedback', fb.id, { duplicateOf: target.id, updatedAt: nowISO() });
      await logActivity(workspace.id, user.id, `${user.name} linked "${fb.title}" as a duplicate of "${target.title}"`);
    }, 'Linked as duplicate.');
    setLinking(false); setDupOpen(false); setPrimaryId('');
  };

  const unlink = (d: Feedback) =>
    run(async () => {
      await patch('feedback', d.id, { duplicateOf: null, updatedAt: nowISO() });
      await logActivity(workspace.id, user.id, `${user.name} unlinked duplicate "${d.title}"`);
    }, 'Duplicate unlinked.');

  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> All feedback</Link>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-xl font-semibold">{fb.title}</h1>
              {canEdit && (
                <div className="flex gap-2">
                  <Link to="edit" className="btn btn-secondary btn-sm"><Pencil className="h-3.5 w-3.5" /> Edit</Link>
                  <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge tone={st.tone}>{st.label}</Badge><Badge tone={pr.tone}>{pr.label} priority</Badge>
              {category && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: category.color }} />{category.name}</span>}
              {fb.tagIds.map((tid) => { const t = tags.find((x) => x.id === tid); return t && <span key={tid} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">#{t.name}</span>; })}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{fb.description}</p>
            <p className="mt-4 text-xs text-slate-500">Submitted by {userName(fb.submitterId)} on {fmtDate(fb.createdAt)}{fb.updatedAt !== fb.createdAt && ` · updated ${fmtDate(fb.updatedAt)}`}</p>
          </section>

          {(primary || duplicates.length > 0 || (manage && candidates.length > 0)) && (
            <section className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Duplicates {duplicates.length > 0 && <span className="text-sm font-normal text-slate-500">({duplicates.length} linked)</span>}</h2>
                {manage && !primary && candidates.length > 0 && <Button variant="secondary" size="sm" onClick={() => setDupOpen(true)}><Copy className="h-3.5 w-3.5" /> Mark as duplicate</Button>}
              </div>
              {primary && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm">
                  <span>This is a duplicate of <Link className="font-medium text-brand hover:underline" to={`../${primary.id}`} relative="path">{primary.title}</Link></span>
                  {manage && <Button variant="secondary" size="sm" onClick={() => unlink(fb)}><Link2Off className="h-3.5 w-3.5" /> Unlink</Button>}
                </div>
              )}
              {duplicates.length > 0 && (
                <ul className="mt-3 divide-y divide-slate-100">
                  {duplicates.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <Link className="hover:text-brand" to={`../${d.id}`} relative="path">{d.title}</Link>
                      {manage && <Button variant="ghost" size="sm" onClick={() => unlink(d)}><Link2Off className="h-3.5 w-3.5" /> Unlink</Button>}
                    </li>
                  ))}
                </ul>
              )}
              {!primary && duplicates.length === 0 && <p className="mt-2 text-sm text-slate-500">No duplicates are linked to this request.</p>}
            </section>
          )}

          <section className="card p-5">
            <h2 className="font-semibold">Comments ({comments.length})</h2>
            {comments.length === 0 ? <div className="mt-3"><EmptyState title="No comments yet" hint="Add context or share how this affects you." /></div> : (
              <ul className="mt-3 space-y-4">
                {comments.map((c) => (
                  <li key={c.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p><span className="font-medium">{userName(c.userId)}</span> <span className="text-xs text-slate-400">{fmtDate(c.createdAt)}</span></p>
                      {(c.userId === user.id || role === 'owner' || role === 'admin') && <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => setCommentToDelete(c)}>Delete</button>}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addComment} noValidate className="mt-5 space-y-2">
              <Field label="Add a comment" error={bodyError}><textarea className="input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
              <div className="flex justify-end"><Button type="submit" loading={posting}>Post comment</Button></div>
            </form>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card flex items-center gap-4 p-5">
            <VoteButton count={votes.length} voted={voted} busy={voting} onClick={onVote} />
            <div><p className="text-2xl font-semibold">{votes.length}</p><p className="text-sm text-slate-500">{votes.length === 1 ? 'vote' : 'votes'}{voted && ' · including yours'}</p></div>
          </div>
          {manage && (
            <div className="card space-y-3 p-5">
              <h2 className="font-semibold">Triage</h2>
              <Field label="Status"><select className="input" value={fb.status} onChange={(e) => quickUpdate({ status: e.target.value as FeedbackStatus })}>{STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
              <Field label="Priority"><select className="input" value={fb.priority} onChange={(e) => quickUpdate({ priority: e.target.value as Priority })}>{PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
            </div>
          )}
        </aside>
      </div>

      <ConfirmDialog open={confirmDelete} title="Delete this feedback?" busy={deleting} onCancel={() => setConfirmDelete(false)} onConfirm={doDelete}
        message={<>"{fb.title}" will be deleted together with its votes and comments. Linked duplicates will be unlinked. This can't be undone.</>} />
      <ConfirmDialog open={!!commentToDelete} title="Delete this comment?" message="This comment will be removed permanently." onCancel={() => setCommentToDelete(null)} onConfirm={deleteComment} />
      <Modal open={dupOpen} title="Mark as duplicate" onClose={() => setDupOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Choose the primary request this one duplicates. The primary request will show the linked count.</p>
          <Field label="Primary request" required>
            <select className="input" value={primaryId} onChange={(e) => setPrimaryId(e.target.value)}>
              <option value="">Select a request</option>{candidates.map((f) => <option key={f.id} value={f.id}>#{f.id} {f.title}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mergeVotes} onChange={(e) => setMergeVotes(e.target.checked)} /> Merge votes into the primary request</label>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDupOpen(false)}>Cancel</Button><Button disabled={!primaryId} loading={linking} onClick={linkDuplicate}>Link duplicate</Button></div>
        </div>
      </Modal>
    </>
  );
}
