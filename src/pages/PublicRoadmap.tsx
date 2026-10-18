import { Link, useParams } from 'react-router-dom';
import { Lock, ThumbsUp } from 'lucide-react';
import { getOne, list } from '../api';
import { useAsync } from '../hooks/useAsync';
import { Badge, EmptyState, ErrorState, Spinner } from '../components/ui';
import { WorkspaceLogo } from '../components/Layout';
import { STAGES, fmtDate, hexToRgb } from '../lib/utils';
import type { CSSProperties } from 'react';
import type { ReleaseNote, RoadmapItem, Vote, Workspace } from '../types';

/** Read-only, login-free roadmap for a workspace. */
export default function PublicRoadmap() {
  const { wid } = useParams();
  const { data, loading, error, reload } = useAsync(async () => {
    const workspace = await getOne<Workspace>('workspaces', wid!);
    if (!workspace.publicRoadmap) return { workspace, items: [], votes: [], notes: [] };
    const p = { workspaceId: workspace.id };
    const [items, votes, notes] = await Promise.all([
      list<RoadmapItem>('roadmapItems', { ...p, published: true }), list<Vote>('votes', p),
      list<ReleaseNote>('releaseNotes', { ...p, status: 'published', _sort: 'releaseDate', _order: 'desc' }),
    ]);
    return { workspace, items, votes, notes };
  }, [wid]);

  if (loading && !data) return <Spinner />;
  if (error) return <div className="mx-auto max-w-lg p-8"><ErrorState message={error} onRetry={reload} /></div>;
  if (!data) return null;
  const { workspace, items, votes, notes } = data;

  return (
    <div className="min-h-screen" style={{ ['--brand-rgb' as string]: hexToRgb(workspace.brandColor) } as CSSProperties}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <WorkspaceLogo name={workspace.name} url={workspace.logoUrl} size={44} />
            <div><h1 className="text-xl font-semibold">{workspace.name} roadmap</h1>{workspace.description && <p className="max-w-xl text-sm text-slate-500">{workspace.description}</p>}</div>
          </div>
          <Link to="/login" className="btn btn-primary">Sign in to vote</Link>
        </div>
        <div className="h-1 bg-brand" />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {!workspace.publicRoadmap ? (
          <div className="card mx-auto max-w-md p-8 text-center"><Lock className="mx-auto h-8 w-8 text-slate-400" /><h2 className="mt-3 font-semibold">This roadmap is private</h2><p className="mt-1 text-sm text-slate-500">The workspace owner hasn't made the roadmap public.</p></div>
        ) : items.length === 0 ? <EmptyState title="Nothing published yet" hint="Check back soon for upcoming work." /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STAGES.map((s) => {
              const col = items.filter((i) => i.stage === s.value);
              return (
                <section key={s.value} aria-label={s.label} className="rounded-xl bg-slate-100 p-3">
                  <h2 className="mb-3 flex items-center justify-between px-1"><Badge tone={s.tone}>{s.label}</Badge><span className="text-xs text-slate-500">{col.length}</span></h2>
                  <div className="space-y-3">
                    {col.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No items</p>}
                    {col.map((i) => (
                      <article key={i.id} className="card p-3">
                        <h3 className="text-sm font-medium">{i.title}</h3>
                        <p className="mt-1 text-xs text-slate-600">{i.description}</p>
                        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><ThumbsUp className="h-3 w-3" />{votes.filter((v) => i.feedbackIds.includes(v.feedbackId)).length} votes</p>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
        {workspace.publicRoadmap && notes.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold">Recent releases</h2>
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {notes.map((n) => <li key={n.id} className="card p-4"><p className="font-medium">Version {n.version}</p><p className="text-xs text-slate-500">{fmtDate(n.releaseDate)}</p><p className="mt-2 text-sm text-slate-700">{n.summary}</p></li>)}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
