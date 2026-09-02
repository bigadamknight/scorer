import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMatchSync } from '../hooks/useMatchSync';
import { api } from '../lib/api';
import { buildReportText } from '../lib/report';
import type { Team } from '../lib/types';

const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((n / d) * 100)}%`);

export function ReportPage() {
  const { id } = useParams();
  const { match, derived } = useMatchSync(id);
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  if (!match || !derived) {
    return <div className="grid min-h-dvh place-items-center text-faint">Loading report…</div>;
  }

  const c = match.config;

  const handleEmail = async () => {
    setEmailState('sending');
    try {
      const r = await api.post<{ emailed: boolean }>(`/api/matches/${match.id}/complete`, {
        subject: `Match report: ${c.home} v ${c.away}`,
        text: buildReportText(match, derived),
      });
      setEmailState(r.emailed ? 'sent' : 'failed');
    } catch {
      setEmailState('failed');
    }
  };

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-8">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-extrabold uppercase text-violet-deep">Match report</h1>
        <Link to="/" className="text-sm text-faint underline">
          Home
        </Link>
      </header>

      <div className="mt-6 rounded-md bg-violet-deep p-5 text-center text-white">
        <div className="text-sm uppercase tracking-widest text-white/60">
          {c.competition || 'Friendly'} · {c.venue}
        </div>
        <div className="mt-2 font-display text-2xl font-bold uppercase leading-tight">
          {c.home} v {c.away}
        </div>
        <div className="font-display text-7xl font-extrabold tabular-nums">
          {derived.score.home}–{derived.score.away}
        </div>
      </div>

      {derived.periodScores.length > 0 && (
        <section className="mt-6">
          <h2 className="label">Period scores</h2>
          <div className="flex gap-2">
            {derived.periodScores.map((p) => (
              <div key={p.period} className="flex-1 rounded-md border border-hairline bg-surface py-2 text-center">
                <div className="font-bold tabular-nums">
                  {p.home}–{p.away}
                </div>
                <div className="text-xs uppercase text-faint">
                  {match.config.periods === 4 ? `End Q${p.period}` : `End P${p.period}`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(['home', 'away'] as Team[]).map((team) => {
        const s = derived.stats[team];
        const shooters = Object.entries(s.shots);
        const cp = Object.entries(s.cpByPeriod);
        const tot = cp.reduce((a, [, q]) => ({ conv: a.conv + q.conv, total: a.total + q.total }), { conv: 0, total: 0 });
        if (shooters.length === 0 && cp.length === 0 && s.gains === 0 && s.turnovers === 0) return null;
        return (
          <section key={team} className="mt-6 rounded-md border border-hairline bg-surface p-4">
            <h2 className="font-display text-xl font-bold uppercase">{c[team]}</h2>
            {shooters.length > 0 && (
              <div className="mt-2">
                <h3 className="label">Shooting</h3>
                {shooters.map(([name, sh]) => (
                  <div key={name} className="flex justify-between border-b border-hairline py-1.5 text-sm">
                    <span>{name}</span>
                    <span className="tabular-nums">
                      {sh.made}/{sh.att} · {pct(sh.made, sh.att)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {cp.length > 0 && (
              <div className="mt-3">
                <h3 className="label">Centre pass conversion</h3>
                <div className="flex justify-between text-sm">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {tot.conv}/{tot.total} · {pct(tot.conv, tot.total)}
                  </span>
                </div>
                <div className="mt-1 flex gap-2">
                  {cp.map(([p, q]) => (
                    <span key={p} className="rounded bg-ground px-2 py-0.5 text-xs tabular-nums text-faint">
                      P{p}: {q.conv}/{q.total}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(s.gains > 0 || s.turnovers > 0) && (
              <div className="mt-3 flex justify-between text-sm">
                <span>Gains {s.gains}</span>
                <span>
                  Turnovers {s.turnovers}
                  {Object.keys(s.turnoverReasons).length > 0 &&
                    ` (${Object.entries(s.turnoverReasons)
                      .map(([r, n]) => `${r} ${n}`)
                      .join(', ')})`}
                </span>
              </div>
            )}
            {Object.keys(s.penalties).length > 0 && (
              <div className="mt-1 text-sm text-faint">
                Penalties: {Object.entries(s.penalties).map(([k, n]) => `${k} ${n}`).join(', ')}
              </div>
            )}
          </section>
        );
      })}

      <button
        className="tap mt-8 w-full bg-violet py-4 text-xl font-bold text-white disabled:opacity-40"
        disabled={emailState === 'sending'}
        onClick={handleEmail}
      >
        {emailState === 'sending'
          ? 'Sending…'
          : emailState === 'sent'
            ? 'Sent to info@momentumnetball.co.uk ✓'
            : emailState === 'failed'
              ? 'Send failed — tap to retry'
              : 'Email report to the club'}
      </button>
    </div>
  );
}
