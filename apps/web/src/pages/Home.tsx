import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { MatchSummary, Team } from '../lib/types';

export function HomePage({ onLogout }: { onLogout: () => void }) {
  const [active, setActive] = useState<MatchSummary[]>([]);
  const [recent, setRecent] = useState<MatchSummary[]>([]);
  const [joining, setJoining] = useState<MatchSummary | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ matches: MatchSummary[] }>('/api/matches').then((r) => {
      setActive(r.matches.filter((m) => m.status === 'active'));
      setRecent(r.matches.filter((m) => m.status === 'completed').slice(0, 8));
    });
  }, []);

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-8">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-4xl font-extrabold uppercase text-violet-deep">Scorer</h1>
        <button className="text-sm text-faint underline" onClick={onLogout}>
          Log out
        </button>
      </header>

      <Link
        to="/setup"
        className="tap mt-8 block bg-violet py-5 text-center text-2xl font-bold text-white"
      >
        New match
      </Link>

      <section className="mt-10">
        <h2 className="label">Live now — join a match</h2>
        {active.length === 0 && (
          <p className="mt-1 text-sm text-faint">
            Nothing live. Start a new match, then a second phone joins it from here to do stats.
          </p>
        )}
        <div className="mt-2 flex flex-col gap-2">
          {active.map((m) => (
            <div key={m.id} className="rounded-md border border-hairline bg-surface p-4">
              <div className="font-display text-xl font-bold uppercase">
                {m.config.home} v {m.config.away}
              </div>
              <div className="text-xs text-faint">
                {m.id} · {new Date(m.createdAt).toLocaleString('en-GB')}
              </div>
              {joining?.id === m.id ? (
                <div className="mt-3">
                  <div className="label">Doing stats for which team?</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['home', 'away'] as Team[]).map((t) => (
                      <button
                        key={t}
                        className="tap bg-violet-wash py-3 text-lg font-bold text-violet-deep"
                        onClick={() => navigate(`/match/${m.id}/stats/${t}`)}
                      >
                        {m.config[t]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="tap bg-violet py-3 text-lg font-bold text-white"
                    onClick={() => navigate(`/match/${m.id}/score`)}
                  >
                    Score
                  </button>
                  <button
                    className="tap bg-violet-wash py-3 text-lg font-bold text-violet-deep"
                    onClick={() => setJoining(m)}
                  >
                    Stats
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="label">Recent matches</h2>
          <div className="mt-2 flex flex-col">
            {recent.map((m) => (
              <Link
                key={m.id}
                to={`/match/${m.id}/report`}
                className="flex items-baseline justify-between border-b border-hairline py-3"
              >
                <span>
                  {m.config.home} v {m.config.away}
                </span>
                <span className="text-xs text-faint">
                  {new Date(m.createdAt).toLocaleDateString('en-GB')}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
