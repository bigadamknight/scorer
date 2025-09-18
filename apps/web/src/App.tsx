import { useState, useEffect, useCallback, useMemo } from 'react';
import { ruleTemplates, validateGoalEvent } from '@scorer/rules-netball';
import type {
  GoalScoredEvent,
  MatchEvent,
  PeriodTransitionEvent,
  RuleTemplate,
  MatchCreatedEvent,
  EventSource
} from '@scorer/schema';
import { initDatabase, saveMatch, saveEvent } from './lib/database';

type GameState = 'setup' | 'active' | 'ended';
type TeamKey = 'home' | 'away';

type Team = {
  name: string;
  score: number;
};

type MatchState = {
  matchId: string;
  teams: Record<TeamKey, Team>;
  period: { index: number; label: string };
  template: RuleTemplate;
  events: MatchEvent[];
  gameState: GameState;
};

const POSITIONS = ['GS', 'GA', 'WA', 'C', 'WD', 'GD', 'GK'];

function generateMatchId(): string {
  return `match_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getDeviceSource(): EventSource {
  return {
    deviceId: 'web_device',
    platform: 'web'
  };
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [matchState, setMatchState] = useState<MatchState>({
    matchId: '',
    teams: { home: { name: 'Home', score: 0 }, away: { name: 'Away', score: 0 } },
    period: { index: 0, label: 'Q1' },
    template: ruleTemplates[0],
    events: [],
    gameState: 'setup'
  });

  const [setupData, setSetupData] = useState({
    homeName: '',
    awayName: '',
    templateIndex: 0
  });

  useEffect(() => {
    initDatabase().then(() => {
      setDbReady(true);
    });
  }, []);

  const handleStartMatch = useCallback(() => {
    if (!setupData.homeName || !setupData.awayName) {
      alert('Please enter names for both teams');
      return;
    }

    const matchId = generateMatchId();
    const template = ruleTemplates[setupData.templateIndex];
    const matchName = `${setupData.homeName} vs ${setupData.awayName}`;

    // Save match to database
    saveMatch(matchId, matchName, setupData.homeName, setupData.awayName, template.id);

    const matchCreatedEvent: MatchCreatedEvent = {
      matchId,
      eventId: generateEventId(),
      type: 'match_created',
      createdAt: new Date().toISOString(),
      source: getDeviceSource(),
      sequence: 0,
      matchVersion: 1,
      payload: {
        templateId: template.id,
        matchName,
        scheduledStart: new Date().toISOString()
      }
    };

    const periodStartEvent: PeriodTransitionEvent = {
      matchId,
      eventId: generateEventId(),
      type: 'period_transition',
      createdAt: new Date().toISOString(),
      source: getDeviceSource(),
      sequence: 1,
      matchVersion: 1,
      payload: {
        periodIndex: 0,
        periodLabel: template.defaults.periods[0].label,
        reason: 'start'
      }
    };

    // Save events to database
    saveEvent(matchCreatedEvent);
    saveEvent(periodStartEvent);

    setMatchState({
      matchId,
      teams: {
        home: { name: setupData.homeName, score: 0 },
        away: { name: setupData.awayName, score: 0 }
      },
      period: { index: 0, label: template.defaults.periods[0].label },
      template,
      events: [matchCreatedEvent, periodStartEvent],
      gameState: 'active'
    });
  }, [setupData]);

  const handleAddGoal = useCallback((team: TeamKey, position: string, zoneId: string) => {
    const zone = matchState.template.scoring.zones.find(z => z.id === zoneId);
    if (!zone) return;

    const goalEvent: GoalScoredEvent = {
      matchId: matchState.matchId,
      eventId: generateEventId(),
      type: 'goal_scored',
      createdAt: new Date().toISOString(),
      source: getDeviceSource(),
      sequence: matchState.events.length,
      matchVersion: 1,
      payload: {
        teamId: team,
        position,
        locationZone: zoneId,
        points: zone.points,
        periodIndex: matchState.period.index,
        clockTimeSeconds: 0
      }
    };

    const validation = validateGoalEvent(goalEvent, matchState.template);
    if (!validation.ok) {
      alert(validation.reason);
      return;
    }

    // Save to database
    saveEvent(goalEvent);

    setMatchState(prev => ({
      ...prev,
      teams: {
        ...prev.teams,
        [team]: {
          ...prev.teams[team],
          score: prev.teams[team].score + zone.points
        }
      },
      events: [...prev.events, goalEvent]
    }));
  }, [matchState]);

  const handleRemoveLastGoal = useCallback(() => {
    const lastGoalIndex = matchState.events.findLastIndex((e: MatchEvent) => e.type === 'goal_scored');
    if (lastGoalIndex === -1) return;

    const lastGoal = matchState.events[lastGoalIndex] as GoalScoredEvent;
    const team = lastGoal.payload.teamId as TeamKey;

    setMatchState(prev => ({
      ...prev,
      teams: {
        ...prev.teams,
        [team]: {
          ...prev.teams[team],
          score: Math.max(0, prev.teams[team].score - lastGoal.payload.points)
        }
      },
      events: prev.events.filter((_, idx) => idx !== lastGoalIndex)
    }));
  }, [matchState]);

  const handleAdvancePeriod = useCallback(() => {
    const nextIndex = matchState.period.index + 1;
    if (nextIndex >= matchState.template.defaults.periods.length) {
      alert('Match Complete!');
      setMatchState(prev => ({ ...prev, gameState: 'ended' }));
      return;
    }

    const periodEndEvent: PeriodTransitionEvent = {
      matchId: matchState.matchId,
      eventId: generateEventId(),
      type: 'period_transition',
      createdAt: new Date().toISOString(),
      source: getDeviceSource(),
      sequence: matchState.events.length,
      matchVersion: 1,
      payload: {
        periodIndex: matchState.period.index,
        periodLabel: matchState.period.label,
        reason: 'end'
      }
    };

    const periodStartEvent: PeriodTransitionEvent = {
      matchId: matchState.matchId,
      eventId: generateEventId(),
      type: 'period_transition',
      createdAt: new Date().toISOString(),
      source: getDeviceSource(),
      sequence: matchState.events.length + 1,
      matchVersion: 1,
      payload: {
        periodIndex: nextIndex,
        periodLabel: matchState.template.defaults.periods[nextIndex].label,
        reason: 'start'
      }
    };

    // Save to database
    saveEvent(periodEndEvent);
    saveEvent(periodStartEvent);

    setMatchState(prev => ({
      ...prev,
      period: {
        index: nextIndex,
        label: prev.template.defaults.periods[nextIndex].label
      },
      events: [...prev.events, periodEndEvent, periodStartEvent]
    }));
  }, [matchState]);

  const recentEvents = useMemo(() => {
    return matchState.events
      .filter(e => e.type === 'goal_scored' || e.type === 'period_transition')
      .slice(-10)
      .reverse();
  }, [matchState.events]);

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading database...</div>
      </div>
    );
  }

  if (matchState.gameState === 'setup') {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-8">Netball Scorer</h1>

          <div className="bg-gray-800 rounded-lg p-6 space-y-6">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Home Team
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={setupData.homeName}
                onChange={e => setSetupData(prev => ({ ...prev, homeName: e.target.value }))}
                placeholder="Enter home team name"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Away Team
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={setupData.awayName}
                onChange={e => setSetupData(prev => ({ ...prev, awayName: e.target.value }))}
                placeholder="Enter away team name"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Game Type
              </label>
              <div className="space-y-2">
                {ruleTemplates.map((template, idx) => (
                  <button
                    key={template.id}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                      setupData.templateIndex === idx
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    onClick={() => setSetupData(prev => ({ ...prev, templateIndex: idx }))}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
              onClick={handleStartMatch}
            >
              Start Match
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (matchState.gameState === 'ended') {
    const winner = matchState.teams.home.score > matchState.teams.away.score
      ? matchState.teams.home.name
      : matchState.teams.away.score > matchState.teams.home.score
        ? matchState.teams.away.name
        : 'Draw';

    return (
      <div className="min-h-screen bg-gray-900 p-8 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
          <h2 className="text-3xl font-bold text-white text-center mb-6">Match Complete</h2>
          <div className="space-y-4 text-center">
            <div className="text-2xl text-gray-300">
              {matchState.teams.home.name}: <span className="font-bold text-white">{matchState.teams.home.score}</span>
            </div>
            <div className="text-2xl text-gray-300">
              {matchState.teams.away.name}: <span className="font-bold text-white">{matchState.teams.away.score}</span>
            </div>
            {winner !== 'Draw' && (
              <div className="text-xl text-green-400 font-bold mt-4">
                Winner: {winner}
              </div>
            )}
            <button
              className="w-full mt-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => window.location.reload()}
            >
              New Match
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="text-white">
            <div className="text-2xl font-bold">{matchState.period.label}</div>
            <div className="text-sm text-gray-400">{matchState.template.name}</div>
          </div>
          <button
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            onClick={handleAdvancePeriod}
          >
            Next Period
          </button>
        </div>

        {/* Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <ScoreCard
            team="home"
            name={matchState.teams.home.name}
            score={matchState.teams.home.score}
            template={matchState.template}
            onAddGoal={handleAddGoal}
          />
          <ScoreCard
            team="away"
            name={matchState.teams.away.name}
            score={matchState.teams.away.score}
            template={matchState.template}
            onAddGoal={handleAddGoal}
          />
        </div>

        {/* Event Timeline */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-xl font-bold text-white mb-4">Event Timeline</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentEvents.length === 0 ? (
              <p className="text-gray-400">No events yet</p>
            ) : (
              recentEvents.map(event => (
                <div key={event.eventId} className="text-gray-300 py-2 border-b border-gray-700">
                  {event.type === 'goal_scored' ? (
                    <span>
                      {(event as GoalScoredEvent).payload.teamId === 'home'
                        ? matchState.teams.home.name
                        : matchState.teams.away.name} -
                      {' '}{(event as GoalScoredEvent).payload.position} scored
                      {' '}{(event as GoalScoredEvent).payload.points} point(s)
                    </span>
                  ) : (
                    <span>
                      Period {(event as PeriodTransitionEvent).payload.reason}:
                      {' '}{(event as PeriodTransitionEvent).payload.periodLabel}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6">
          <button
            className="w-full md:w-auto px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            disabled={matchState.events.filter(e => e.type === 'goal_scored').length === 0}
            onClick={handleRemoveLastGoal}
          >
            Undo Last Goal
          </button>
        </div>
      </div>
    </div>
  );
}

type ScoreCardProps = {
  team: TeamKey;
  name: string;
  score: number;
  template: RuleTemplate;
  onAddGoal: (team: TeamKey, position: string, zone: string) => void;
};

function ScoreCard({ team, name, score, template, onAddGoal }: ScoreCardProps) {
  const [selectedPosition, setSelectedPosition] = useState<string>('GA');

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-xl font-bold text-white mb-2">{name}</h3>
      <div className="text-5xl font-bold text-white text-center py-4">{score}</div>

      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map(pos => (
            <button
              key={pos}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedPosition === pos
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setSelectedPosition(pos)}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {template.scoring.zones.map(zone => {
          const canScore = !zone.restrictedToRoles ||
            zone.restrictedToRoles.includes(selectedPosition);

          return (
            <button
              key={zone.id}
              className={`w-full py-3 rounded-lg font-bold transition-colors ${
                canScore
                  ? zone.points === 1
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : zone.points === 2
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'
              }`}
              disabled={!canScore}
              onClick={() => onAddGoal(team, selectedPosition, zone.id)}
            >
              +{zone.points} {zone.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}