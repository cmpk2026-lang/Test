import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const { register, join, refresh } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const code = await register(name, email, password, householdName);
        setCreatedCode(code);
      } else {
        await join(name, email, password, inviteCode);
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 text-3xl">🎉</div>
          <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Household created!</h1>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Share this invite code with your partner so they can join your budget:
          </p>
          <div className="mb-6 rounded-lg bg-indigo-50 px-4 py-3 text-2xl font-bold tracking-widest text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {createdCode}
          </div>
          <button
            onClick={async () => {
              await refresh();
              navigate('/');
            }}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl">💞</div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Get started</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Start a new shared budget or join your partner's
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`rounded-md py-1.5 text-sm font-medium transition ${
              mode === 'create' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'
            }`}
          >
            Create household
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`rounded-md py-1.5 text-sm font-medium transition ${
              mode === 'join' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'
            }`}
          >
            Join with code
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Your name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          {mode === 'create' ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Household name
              </label>
              <input
                required
                placeholder="e.g. Alex & Sam"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Invite code
              </label>
              <input
                required
                placeholder="e.g. AB12CD"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase tracking-widest focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {submitting ? 'Please wait…' : mode === 'create' ? 'Create household' : 'Join household'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account? <Link to="/login" className="font-medium text-indigo-600 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
