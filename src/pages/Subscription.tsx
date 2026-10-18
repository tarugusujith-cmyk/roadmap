import { useState } from 'react';
import { Check } from 'lucide-react';
import { errMsg, patch, logActivity } from '../api';
import { useWorkspace } from '../context/WorkspaceContext';
import { Badge, Button, ConfirmDialog, PageHeader, ProgressBar, useToast } from '../components/ui';
import { cx } from '../lib/utils';
import type { Plan, Usage } from '../types';

const ROWS: { key: keyof Usage; label: string }[] = [
  { key: 'members', label: 'Team members' }, { key: 'feedback', label: 'Feedback items' }, { key: 'roadmapItems', label: 'Roadmap items' },
];

export default function Subscription() {
  const { workspace, user, plan, plans, usage, subscription, can, refresh } = useWorkspace();
  const toast = useToast();
  const [target, setTarget] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const manage = can('subscription.manage');

  const choose = (p: Plan) => {
    const over = ROWS.filter((r) => usage[r.key] > p.limits[r.key]);
    if (over.length) {
      toast.error(`You can't switch to ${p.name}: ${over.map((r) => `${r.label.toLowerCase()} (${usage[r.key]}/${p.limits[r.key]})`).join(', ')} exceed the limit.`);
      return;
    }
    setTarget(p);
  };

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await patch('workspaceSubscriptions', subscription.id, { planId: target.id, startedAt: new Date().toISOString() });
      await logActivity(workspace.id, user.id, `${user.name} changed the plan to ${target.name}`);
      await refresh();
      toast.success(`Plan changed to ${target.name}. No payment is needed in this demo.`);
      setTarget(null);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Subscription & Usage" subtitle="Compare plans and see how much of your limits you've used. Plan changes are simulated; no payment is taken." />
      <section className="card mb-6 p-5">
        <h2 className="font-semibold">Usage on the {plan.name} plan</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {ROWS.map((r) => {
            const used = usage[r.key]; const max = plan.limits[r.key]; const pct = used / max;
            return (
              <div key={r.key}>
                <div className="mb-1 flex justify-between text-sm"><span>{r.label}</span><span className="text-slate-500">{used} / {max}</span></div>
                <ProgressBar value={used} max={max} />
                {pct >= 1 ? <p role="alert" className="mt-1 text-xs font-medium text-red-600">Limit reached. Upgrade to add more.</p>
                  : pct >= 0.8 ? <p role="alert" className="mt-1 text-xs font-medium text-amber-700">Almost at the limit ({max - used} left).</p> : null}
              </div>
            );
          })}
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((p) => {
          const current = p.id === plan.id;
          return (
            <section key={p.id} className={cx('card p-5', current && 'border-brand ring-1 ring-brand')}>
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{p.name}</h2>{current && <Badge tone="green">Current plan</Badge>}</div>
              <p className="mt-1 text-sm text-slate-500">{p.description}</p>
              <p className="mt-3 text-3xl font-semibold">${p.price}<span className="text-sm font-normal text-slate-500"> / month</span></p>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" /> Up to {p.limits.members} team members</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" /> Up to {p.limits.feedback} feedback items</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" /> Up to {p.limits.roadmapItems} roadmap items</li>
              </ul>
              {!current && <div className="mt-5">{manage ? <Button onClick={() => choose(p)}>{p.price > plan.price ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}</Button> : <p className="text-xs text-slate-500">Only the workspace owner can change the plan.</p>}</div>}
            </section>
          );
        })}
      </div>
      <ConfirmDialog open={!!target} title={`Switch to ${target?.name}?`} confirmLabel="Change plan" busy={busy} onCancel={() => setTarget(null)} onConfirm={confirm}
        message={<>{workspace.name} will move to the {target?.name} plan (${target?.price}/month). This is a demo, so nothing is charged.</>} />
    </>
  );
}
