import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, KanbanSquare, MessageSquareText, ThumbsUp, Inbox } from 'lucide-react';
import { list } from '../api';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAsync } from '../hooks/useAsync';
import { ErrorState, PageHeader, ProgressBar, Spinner } from '../components/ui';
import { STAGES, STATUS_OPTIONS, fmtDate } from '../lib/utils';
import type { ActivityLog, Category, Feedback, RoadmapItem, Vote } from '../types';

const PIE_COLORS = ['#94A3B8', '#F59E0B', '#3B82F6', '#8B5CF6', '#22C55E', '#EF4444'];

export default function Dashboard() {
  const { workspace } = useWorkspace();
  const { data, loading, error, reload } = useAsync(async () => {
    const p = { workspaceId: workspace.id };
    const [feedback, votes, items, cats, logs] = await Promise.all([
      list<Feedback>('feedback', p), list<Vote>('votes', p), list<RoadmapItem>('roadmapItems', p), list<Category>('categories', p),
      list<ActivityLog>('activityLogs', { ...p, _sort: 'createdAt', _order: 'desc', _limit: 8 }),
    ]);
    return { feedback, votes, items, cats, logs };
  }, [workspace.id]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const { feedback, votes, items, cats, logs } = data;

  const open = feedback.filter((f) => f.status !== 'completed' && f.status !== 'closed').length;
  const completedItems = items.filter((i) => i.stage === 'completed').length;
  const progress = items.length ? Math.round((completedItems / items.length) * 100) : 0;
  const byCategory = [
    ...cats.map((c) => ({ name: c.name, count: feedback.filter((f) => f.categoryId === c.id).length, color: c.color })),
    { name: 'Uncategorized', count: feedback.filter((f) => !cats.some((c) => c.id === f.categoryId)).length, color: '#94A3B8' },
  ].filter((c) => c.count > 0 || c.name !== 'Uncategorized');
  const byStatus = STATUS_OPTIONS.map((s) => ({ name: s.label, value: feedback.filter((f) => f.status === s.value).length })).filter((s) => s.value > 0);
  const voteCount = new Map<number, number>();
  votes.forEach((v) => voteCount.set(v.feedbackId, (voteCount.get(v.feedbackId) || 0) + 1));
  const top = [...feedback].sort((a, b) => (voteCount.get(b.id) || 0) - (voteCount.get(a.id) || 0)).slice(0, 5);

  const stats = [
    { label: 'Total feedback', value: feedback.length, icon: MessageSquareText },
    { label: 'Total votes', value: votes.length, icon: ThumbsUp },
    { label: 'Open requests', value: open, icon: Inbox },
    { label: 'Completed features', value: completedItems, icon: CheckCircle2 },
    { label: 'Roadmap progress', value: `${progress}%`, icon: KanbanSquare },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`How ${workspace.name} is doing: feedback volume, votes and roadmap progress.`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <s.icon className="h-5 w-5 text-brand" />
            <p className="mt-3 text-2xl font-semibold">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Feedback by category</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Feedback" radius={[6, 6, 0, 0]}>
                  {byCategory.map((c) => <Cell key={c.name} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Feedback by status</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {byStatus.map((s) => <Cell key={s.name} fill={PIE_COLORS[STATUS_OPTIONS.findIndex((o) => o.label === s.name)]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Roadmap progress</h2>
          <p className="text-sm text-slate-500">{completedItems} of {items.length} items completed</p>
          <div className="mt-4 space-y-3">
            {STAGES.map((s) => {
              const n = items.filter((i) => i.stage === s.value).length;
              return (<div key={s.value}><div className="mb-1 flex justify-between text-sm"><span>{s.label}</span><span className="text-slate-500">{n}</span></div><ProgressBar value={n} max={items.length} /></div>);
            })}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Most voted requests</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {top.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link to={`../feedback/${f.id}`} className="truncate hover:text-brand">{f.title}</Link>
                <span className="flex shrink-0 items-center gap-1 text-slate-500"><ThumbsUp className="h-3.5 w-3.5" />{voteCount.get(f.id) || 0}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Recent activity</h2>
          {logs.length === 0 ? <p className="mt-3 text-sm text-slate-500">No activity yet.</p> : (
            <ul className="mt-3 space-y-3">
              {logs.map((l) => (<li key={l.id} className="text-sm"><p className="text-slate-700">{l.message}</p><p className="text-xs text-slate-400">{fmtDate(l.createdAt)}</p></li>))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
