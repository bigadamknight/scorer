import type { DerivedState } from './derive';
import type { Match, Team } from './types';

const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((n / d) * 100)}%`);

export function buildReportText(match: Match, derived: DerivedState): string {
  const c = match.config;
  const lines: string[] = [];
  lines.push(`${c.home} ${derived.score.home} – ${derived.score.away} ${c.away}`);
  lines.push(`${c.competition ? c.competition + ' · ' : ''}${c.venue} · ${new Date(match.createdAt).toLocaleDateString('en-GB')}`);
  if (c.umpire1 || c.umpire2) lines.push(`Umpires: ${[c.umpire1, c.umpire2].filter(Boolean).join(', ')}`);
  lines.push('');
  lines.push('Period scores (cumulative):');
  for (const p of derived.periodScores) {
    lines.push(`  P${p.period}: ${p.home}–${p.away}`);
  }
  for (const team of ['home', 'away'] as Team[]) {
    const s = derived.stats[team];
    const shooters = Object.entries(s.shots);
    const cp = Object.entries(s.cpByPeriod);
    if (shooters.length === 0 && cp.length === 0 && s.gains === 0 && s.turnovers === 0) continue;
    lines.push('');
    lines.push(`${c[team]} bench stats:`);
    if (shooters.length > 0) {
      lines.push('  Shooting:');
      for (const [name, sh] of shooters) lines.push(`    ${name}: ${sh.made}/${sh.att} (${pct(sh.made, sh.att)})`);
    }
    if (cp.length > 0) {
      const tot = cp.reduce((a, [, q]) => ({ conv: a.conv + q.conv, total: a.total + q.total }), { conv: 0, total: 0 });
      lines.push(`  Centre pass conversion: ${tot.conv}/${tot.total} (${pct(tot.conv, tot.total)})`);
      for (const [p, q] of cp) lines.push(`    P${p}: ${q.conv}/${q.total}`);
    }
    if (s.gains > 0 || s.turnovers > 0) {
      lines.push(`  Gains: ${s.gains} · Turnovers: ${s.turnovers}`);
      const reasons = Object.entries(s.turnoverReasons);
      if (reasons.length > 0) lines.push(`    Turnovers by reason: ${reasons.map(([r, n]) => `${r} ${n}`).join(', ')}`);
    }
    const pens = Object.entries(s.penalties);
    if (pens.length > 0) lines.push(`  Penalties: ${pens.map(([k, n]) => `${k} ${n}`).join(', ')}`);
  }
  lines.push('');
  lines.push(`Recorded with Netball Scorer · match ${match.id}`);
  return lines.join('\n');
}
