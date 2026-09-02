import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Team } from '../lib/types';

function ShooterList({
  label,
  names,
  onChange,
}: {
  label: string;
  names: string[];
  onChange: (names: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const handleAdd = () => {
    const n = draft.trim();
    if (n && !names.includes(n)) onChange(names.concat(n));
    setDraft('');
  };
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-2">
        <input
          className="field"
          placeholder="Shooter name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button type="button" className="tap bg-violet-wash px-4 text-xl font-bold text-violet-deep" onClick={handleAdd}>
          Add
        </button>
      </div>
      {names.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {names.map((n) => (
            <button
              key={n}
              type="button"
              className="tap rounded-full bg-violet-deep px-3 py-1 text-sm normal-case tracking-normal text-white"
              onClick={() => onChange(names.filter((x) => x !== n))}
              title="Tap to remove"
            >
              {n} ✕
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SetupPage() {
  const navigate = useNavigate();
  const [venue, setVenue] = useState('');
  const [competition, setCompetition] = useState('');
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [umpire1, setUmpire1] = useState('');
  const [umpire2, setUmpire2] = useState('');
  const [periods, setPeriods] = useState(4);
  const [periodMinutes, setPeriodMinutes] = useState(15);
  const [firstCentrePass, setFirstCentrePass] = useState<Team>('home');
  const [homeShooters, setHomeShooters] = useState<string[]>([]);
  const [awayShooters, setAwayShooters] = useState<string[]>([]);
  const [homePlayers, setHomePlayers] = useState<string[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!home.trim() || !away.trim() || !venue.trim()) {
      setError('Venue and both team names are needed.');
      return;
    }
    setBusy(true);
    try {
      const r = await api.post<{ id: string }>('/api/matches', {
        config: {
          venue: venue.trim(),
          competition: competition.trim(),
          home: home.trim(),
          away: away.trim(),
          umpire1: umpire1.trim(),
          umpire2: umpire2.trim(),
          periods,
          periodMinutes,
          firstCentrePass,
          shooters: { home: homeShooters, away: awayShooters },
          players: { home: homePlayers, away: awayPlayers },
        },
      });
      navigate(`/match/${r.id}/score`);
    } catch {
      setError('Could not create the match — are you online?');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-8">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-4xl font-extrabold uppercase text-violet-deep">Match setup</h1>
        <Link to="/" className="text-sm text-faint underline">
          Back
        </Link>
      </header>

      <form onSubmit={handleStart} className="mt-6 flex flex-col gap-5">
        <div>
          <label className="label" htmlFor="venue">Venue</label>
          <input id="venue" className="field" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="competition">Competition</label>
          <input id="competition" className="field" value={competition} onChange={(e) => setCompetition(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="home">Home team</label>
            <input id="home" className="field" value={home} onChange={(e) => setHome(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="away">Away team</label>
            <input id="away" className="field" value={away} onChange={(e) => setAway(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="u1">Umpire 1</label>
            <input id="u1" className="field" value={umpire1} onChange={(e) => setUmpire1(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="u2">Umpire 2</label>
            <input id="u2" className="field" value={umpire2} onChange={(e) => setUmpire2(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="periods">Periods</label>
            <select id="periods" className="field" value={periods} onChange={(e) => setPeriods(Number(e.target.value))}>
              <option value={2}>2 halves</option>
              <option value={3}>3 thirds</option>
              <option value={4}>4 quarters</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="mins">Minutes</label>
            <input
              id="mins"
              type="number"
              min={1}
              max={20}
              className="field"
              value={periodMinutes}
              onChange={(e) => setPeriodMinutes(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="fcp">First CP</label>
            <select
              id="fcp"
              className="field"
              value={firstCentrePass}
              onChange={(e) => setFirstCentrePass(e.target.value as Team)}
            >
              <option value="home">{home.trim() || 'Home'}</option>
              <option value="away">{away.trim() || 'Away'}</option>
            </select>
          </div>
        </div>

        <div className="rounded-md border border-hairline bg-surface p-4">
          <p className="mb-3 text-sm text-faint">
            Shooters — added here so the stats phone gets one button per shooter. Skip any team you are not
            doing stats for.
          </p>
          <div className="flex flex-col gap-4">
            <ShooterList label={`${home.trim() || 'Home'} shooters`} names={homeShooters} onChange={setHomeShooters} />
            <ShooterList label={`${away.trim() || 'Away'} shooters`} names={awayShooters} onChange={setAwayShooters} />
          </div>
        </div>

        <div className="rounded-md border border-hairline bg-surface p-4">
          <p className="mb-3 text-sm text-faint">
            Rest of the squad (optional) — lets the stats phone attribute intercepts, feeds and the rest to a
            player. Players can also be added mid-match from the stats screen.
          </p>
          <div className="flex flex-col gap-4">
            <ShooterList label={`${home.trim() || 'Home'} squad`} names={homePlayers} onChange={setHomePlayers} />
            <ShooterList label={`${away.trim() || 'Away'} squad`} names={awayPlayers} onChange={setAwayPlayers} />
          </div>
        </div>

        {error && <p className="text-sm text-missed">{error}</p>}
        <button type="submit" disabled={busy} className="tap bg-violet py-4 text-2xl font-bold text-white disabled:opacity-40">
          {busy ? 'Creating…' : 'Start match'}
        </button>
      </form>
    </div>
  );
}
