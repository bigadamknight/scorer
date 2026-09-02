import { useState } from 'react';

export function LoginPage({ onLogin }: { onLogin: (code: string) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onLogin(code.trim());
    } catch {
      setError('That access code is not right — check with the club.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-24">
      <h1 className="font-display text-6xl font-extrabold uppercase leading-none text-violet-deep">
        Netball
        <br />
        Scorer
      </h1>
      <p className="mt-2 text-faint">Momentum Netball · scoring &amp; bench stats</p>
      <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-3">
        <label className="label" htmlFor="code">
          Access code
        </label>
        <input
          id="code"
          className="field text-center font-display text-2xl uppercase tracking-[0.3em]"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
        />
        {error && <p className="text-sm text-missed">{error}</p>}
        <button
          type="submit"
          disabled={busy || code.trim() === ''}
          className="tap mt-2 bg-violet py-3.5 text-xl font-bold text-white disabled:opacity-40"
        >
          {busy ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  );
}
