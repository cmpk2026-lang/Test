import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Member } from '../types';

export function EnterPage() {
  const { checkCode, enter } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [members, setMembers] = useState<Member[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const existingMembers = await checkCode(code);
      setMembers(existingMembers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect code');
    } finally {
      setSubmitting(false);
    }
  };

  const enterAs = async (memberName: string) => {
    setError('');
    setSubmitting(true);
    try {
      await enter(code, memberName);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not continue');
    } finally {
      setSubmitting(false);
    }
  };

  const submitName = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) enterAs(name.trim());
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl">💞</div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Our Budget</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {members === null ? 'Enter your shared access code' : "Who's this?"}
          </p>
        </div>

        {members === null ? (
          <form onSubmit={submitCode} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Access code
              </label>
              <input
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. CMPK"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg uppercase tracking-widest focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            {error && <p className="text-sm text-rose-500">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting ? 'Checking…' : 'Continue'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {members.length > 0 && (
              <div className="space-y-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => enterAs(m.name)}
                    disabled={submitting}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    I'm {m.name}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={submitName} className="space-y-2">
              <label className="block text-xs font-medium text-slate-500">
                {members.length > 0 ? 'Someone else' : 'Your name'}
              </label>
              <div className="flex gap-2">
                <input
                  autoFocus={members.length === 0}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  Go
                </button>
              </div>
            </form>
            {error && <p className="text-sm text-rose-500">{error}</p>}
            <button
              onClick={() => {
                setMembers(null);
                setError('');
              }}
              className="text-xs text-slate-400 hover:underline"
            >
              ‹ Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
