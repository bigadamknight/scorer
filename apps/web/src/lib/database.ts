import initSqlJs from 'sql.js';
import { MatchEvent } from '@scorer/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

export async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
  });

  db = new SQL.Database();

  // Create matches table
  db.run(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      template_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active'
    )
  `);

  // Create events table
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES matches (id)
    )
  `);

  // Create scores view for quick access
  db.run(`
    CREATE VIEW IF NOT EXISTS match_scores AS
    SELECT
      match_id,
      json_extract(payload, '$.teamId') as team,
      SUM(json_extract(payload, '$.points')) as score
    FROM events
    WHERE type = 'goal_scored'
    GROUP BY match_id, team
  `);

  return db;
}

export function saveMatch(matchId: string, name: string, homeTeam: string, awayTeam: string, templateId: string) {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    INSERT INTO matches (id, name, home_team, away_team, template_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run([matchId, name, homeTeam, awayTeam, templateId]);
  stmt.free();
}

export function saveEvent(event: MatchEvent) {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    INSERT INTO events (id, match_id, type, payload, sequence)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run([
    event.eventId,
    event.matchId,
    event.type,
    JSON.stringify(event.payload),
    event.sequence
  ]);

  stmt.free();
}

export function getMatchEvents(matchId: string): MatchEvent[] {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    SELECT * FROM events
    WHERE match_id = ?
    ORDER BY sequence ASC
  `);

  stmt.bind([matchId]);

  const events: MatchEvent[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    events.push({
      eventId: row.id as string,
      matchId: row.match_id as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: row.type as any,
      payload: JSON.parse(row.payload as string),
      sequence: row.sequence as number,
      createdAt: row.created_at as string,
      source: { deviceId: 'web', platform: 'web' },
      matchVersion: 1
    });
  }

  stmt.free();
  return events;
}

export function getAllMatches() {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    SELECT
      m.*,
      COALESCE(hs.score, 0) as home_score,
      COALESCE(as.score, 0) as away_score
    FROM matches m
    LEFT JOIN match_scores hs ON m.id = hs.match_id AND hs.team = 'home'
    LEFT JOIN match_scores as ON m.id = as.match_id AND as.team = 'away'
    ORDER BY m.created_at DESC
  `);

  const matches = [];
  while (stmt.step()) {
    matches.push(stmt.getAsObject());
  }

  stmt.free();
  return matches;
}

export function exportDatabase(): Uint8Array {
  if (!db) throw new Error('Database not initialized');
  return db.export();
}

export function importDatabase(data: Uint8Array) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SQL = (window as any).SQL;
  if (!SQL) throw new Error('SQL.js not loaded');

  db = new SQL.Database(data);
}