import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Globe } from 'lucide-react';
import { list } from '../api';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { Button, ErrorState, Field, Spinner } from '../components/ui';
import { errMsg } from '../api';
import { isEmail } from '../lib/utils';
import type { User, Workspace } from '../types';

export default function Login() {
  const { user, login, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/workspaces';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const demo = useAsync(async () => {
    const [users, workspaces] = await Promise.all([list<User>('users'), list<Workspace>('workspaces', { publicRoadmap: true })]);
    return { users: users.slice(0, 4), workspaces };
  }, []);

  if (ready && user) return <Navigate to="/workspaces" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Enter your email address.';
    else if (!isEmail(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold"><Activity className="h-6 w-6 text-indigo-400" /> ProductPulse</div>
        <div>
          <h1 className="max-w-md text-4xl font-semibold leading-tight">Hear what customers want. Show them what you're building.</h1>
          <p className="mt-4 max-w-md text-slate-300">Collect feedback, let customers vote, and publish a roadmap and release notes from one workspace.</p>
        </div>
        <p className="text-sm text-slate-400">Demo environment. All data lives in a local JSON Server.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 text-lg font-semibold lg:hidden"><Activity className="h-6 w-6 text-indigo-600" /> ProductPulse</div>
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use a demo account below or enter your credentials.</p>
          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            <Field label="Email" required error={errors.email}>
              <input className={`input ${errors.email ? 'input-error' : ''}`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" required error={errors.password}>
              <input className={`input ${errors.password ? 'input-error' : ''}`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
            <Button type="submit" loading={busy} className="w-full">Sign in</Button>
          </form>

          <div className="mt-8">
            <h3 className="text-sm font-medium text-slate-700">Demo accounts <span className="font-normal text-slate-500">(password: demo123)</span></h3>
            {demo.loading && !demo.data && <Spinner />}
            {demo.error && <div className="mt-3"><ErrorState message={demo.error} onRetry={demo.reload} /></div>}
            {demo.data && (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {demo.data.users.map((u) => (
                    <button key={u.id} type="button" className="card px-3 py-2 text-left text-sm hover:border-brand" onClick={() => { setEmail(u.email); setPassword(u.password); setErrors({}); }}>
                      <span className="block font-medium">{u.name}</span>
                      <span className="block text-xs text-slate-500">{u.email}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">Roles are set per workspace: Aarav is owner, Neha is admin, Rohan is product manager and Sara is a customer in Northwind CRM and Lumen Notes.</p>
                {demo.data.workspaces.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="flex items-center gap-1 text-slate-500"><Globe className="h-4 w-4" /> Public roadmaps:</span>
                    {demo.data.workspaces.map((w) => <Link key={w.id} to={`/public/${w.id}/roadmap`} className="font-medium text-indigo-600 hover:underline">{w.name}</Link>)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
