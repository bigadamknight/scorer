import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { EventType, Match, MatchEvent } from '../lib/types';
import { derive } from '../lib/derive';

// Events captured while offline wait in localStorage and flush on the next tick,
// so courtside capture never blocks on venue wifi.
const queueKey = (matchId: string) => `scorer-queue-${matchId}`;
const deviceId = (() => {
  let d = localStorage.getItem('scorer-device');
  if (!d) {
    d = Math.random().toString(36).slice(2, 8);
    localStorage.setItem('scorer-device', d);
  }
  return d;
})();

interface QueuedEvent {
  clientId: string;
  type: EventType;
  payload: Record<string, unknown>;
  device: string;
  ts: string;
}

const loadQueue = (matchId: string): QueuedEvent[] => {
  try {
    return JSON.parse(localStorage.getItem(queueKey(matchId)) || '[]');
  } catch {
    return [];
  }
};
const saveQueue = (matchId: string, q: QueuedEvent[]) => {
  try {
    localStorage.setItem(queueKey(matchId), JSON.stringify(q));
  } catch {
    /* storage unavailable — events stay in memory for this session */
  }
};

export function useMatchSync(matchId: string | undefined) {
  const [match, setMatch] = useState<Match | null>(null);
  const [online, setOnline] = useState(true);
  const seqRef = useRef(0);
  const pendingRef = useRef<QueuedEvent[]>(matchId ? loadQueue(matchId) : []);
  const tempSeq = useRef(1_000_000);

  const flushAndPoll = useCallback(async () => {
    if (!matchId) return;
    try {
      if (pendingRef.current.length > 0) {
        await api.post(`/api/matches/${matchId}/events`, { events: pendingRef.current });
        pendingRef.current = [];
        saveQueue(matchId, []);
      }
      const r = await api.get<{ seq: number; status: Match['status']; events: MatchEvent[] }>(
        `/api/matches/${matchId}/events?since=${seqRef.current}`
      );
      setOnline(true);
      if (r.events.length > 0 || seqRef.current === 0) {
        seqRef.current = r.seq;
        setMatch((prev) => {
          if (!prev) return prev;
          const confirmed = prev.events.filter((e) => !e.pending);
          const known = new Set(confirmed.map((e) => e.seq));
          const merged = confirmed.concat(r.events.filter((e) => !known.has(e.seq)));
          merged.sort((a, b) => a.seq - b.seq);
          const pendingIds = new Set(pendingRef.current.map((q) => q.clientId));
          const stillPending = prev.events.filter((e) => e.pending && pendingIds.has(e.clientId || ''));
          return { ...prev, status: r.status, seq: r.seq, events: merged.concat(stillPending) };
        });
      } else {
        setMatch((prev) => (prev && prev.status !== r.status ? { ...prev, status: r.status } : prev));
      }
    } catch {
      setOnline(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    let stop = false;
    api
      .get<Match>(`/api/matches/${matchId}`)
      .then((m) => {
        if (stop) return;
        seqRef.current = m.seq;
        setMatch(m);
      })
      .catch(() => setOnline(false));
    const t = setInterval(flushAndPoll, 2500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [matchId]);

  const append = useCallback(
    (type: EventType, payload: Record<string, unknown>) => {
      if (!matchId) return;
      const q: QueuedEvent = {
        clientId: `${deviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        payload,
        device: deviceId,
        ts: new Date().toISOString(),
      };
      pendingRef.current = pendingRef.current.concat(q);
      saveQueue(matchId, pendingRef.current);
      setMatch((prev) =>
        prev
          ? {
              ...prev,
              events: prev.events.concat({
                seq: (tempSeq.current += 1),
                clientId: q.clientId,
                ts: q.ts,
                device: deviceId,
                type,
                payload,
                pending: true,
              }),
            }
          : prev
      );
      void flushAndPoll();
    },
    [matchId, flushAndPoll]
  );

  const derived = match ? derive(match) : null;
  return { match, derived, append, online, refresh: flushAndPoll };
}
