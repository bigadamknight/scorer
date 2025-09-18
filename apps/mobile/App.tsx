import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform
} from 'react-native';
import { ruleTemplates, validateGoalEvent } from '@scorer/rules-netball';
import {
  GoalScoredEvent,
  MatchEvent,
  PeriodTransitionEvent,
  RuleTemplate,
  MatchCreatedEvent,
  EventSource
} from '@scorer/schema';

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
    deviceId: 'mobile_device',
    platform: 'mobile'
  };
}

export default function App() {
  // Add a simple loading check
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

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

  const handleStartMatch = useCallback(() => {
    if (!setupData.homeName || !setupData.awayName) {
      Alert.alert('Team Names Required', 'Please enter names for both teams');
      return;
    }

    const matchId = generateMatchId();
    const template = ruleTemplates[setupData.templateIndex];

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
        matchName: `${setupData.homeName} vs ${setupData.awayName}`,
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
      Alert.alert('Invalid Goal', validation.reason);
      return;
    }

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
    const lastGoalIndex = matchState.events.findLastIndex(e => e.type === 'goal_scored');
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
      Alert.alert('Match Complete', 'The match has ended');
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

  if (!isReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.endedContainer}>
          <Text style={styles.title}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (matchState.gameState === 'setup') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.setupScrollContainer}>
          <View style={styles.setupContent}>
            <Text style={styles.title}>Setup Match</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Home Team</Text>
              <TextInput
                style={styles.input}
                value={setupData.homeName}
                onChangeText={text => setSetupData(prev => ({ ...prev, homeName: text }))}
                placeholder="Enter home team name"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Away Team</Text>
              <TextInput
                style={styles.input}
                value={setupData.awayName}
                onChangeText={text => setSetupData(prev => ({ ...prev, awayName: text }))}
                placeholder="Enter away team name"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Game Type</Text>
              {ruleTemplates.map((template, idx) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.optionButton,
                    setupData.templateIndex === idx && styles.selectedOption
                  ]}
                  onPress={() => setSetupData(prev => ({ ...prev, templateIndex: idx }))}
                >
                  <Text style={styles.optionText}>{template.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleStartMatch}>
              <Text style={styles.primaryButtonText}>Start Match</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (matchState.gameState === 'ended') {
    const winner = matchState.teams.home.score > matchState.teams.away.score
      ? matchState.teams.home.name
      : matchState.teams.away.score > matchState.teams.home.score
        ? matchState.teams.away.name
        : 'Draw';

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.endedContainer}>
          <Text style={styles.title}>Match Complete</Text>
          <Text style={styles.finalScore}>
            {matchState.teams.home.name}: {matchState.teams.home.score}
          </Text>
          <Text style={styles.finalScore}>
            {matchState.teams.away.name}: {matchState.teams.away.score}
          </Text>
          {winner !== 'Draw' && (
            <Text style={styles.winnerText}>Winner: {winner}</Text>
          )}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setMatchState({
              matchId: '',
              teams: { home: { name: 'Home', score: 0 }, away: { name: 'Away', score: 0 } },
              period: { index: 0, label: 'Q1' },
              template: ruleTemplates[0],
              events: [],
              gameState: 'setup'
            })}
          >
            <Text style={styles.primaryButtonText}>New Match</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.mainContent}>
        <View style={styles.header}>
          <Text style={styles.periodLabel}>{matchState.period.label}</Text>
          <Text style={styles.gameType}>{matchState.template.name}</Text>
          <TouchableOpacity style={styles.periodButton} onPress={handleAdvancePeriod}>
            <Text style={styles.periodButtonText}>Next Period</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.scoreRow}>
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
        </View>

        <View style={styles.timelineContainer}>
          <Text style={styles.timelineHeading}>Event Timeline</Text>
          <ScrollView style={styles.timeline}>
            {recentEvents.length === 0 ? (
              <Text style={styles.timelinePlaceholder}>No events yet</Text>
            ) : (
              recentEvents.map(event => (
                <View key={event.eventId} style={styles.eventItem}>
                  {event.type === 'goal_scored' ? (
                    <Text style={styles.eventText}>
                      {(event as GoalScoredEvent).payload.teamId === 'home'
                        ? matchState.teams.home.name
                        : matchState.teams.away.name} -
                      {' '}{(event as GoalScoredEvent).payload.position} scored
                      {' '}{(event as GoalScoredEvent).payload.points} point(s)
                    </Text>
                  ) : (
                    <Text style={styles.eventText}>
                      Period {(event as PeriodTransitionEvent).payload.reason}:
                      {' '}{(event as PeriodTransitionEvent).payload.periodLabel}
                    </Text>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, matchState.events.filter(e => e.type === 'goal_scored').length === 0 && styles.disabledButton]}
            disabled={matchState.events.filter(e => e.type === 'goal_scored').length === 0}
            onPress={handleRemoveLastGoal}
          >
            <Text style={styles.secondaryButtonText}>Undo Last Goal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
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
    <View style={styles.scoreCard}>
      <Text style={styles.teamLabel}>{name}</Text>
      <Text style={styles.scoreValue}>{score}</Text>

      <View style={styles.positionRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {POSITIONS.map(pos => (
            <TouchableOpacity
              key={pos}
              style={[
                styles.positionChip,
                selectedPosition === pos && styles.selectedPosition
              ]}
              onPress={() => setSelectedPosition(pos)}
            >
              <Text style={styles.positionText}>{pos}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.zoneButtons}>
        {template.scoring.zones.map(zone => {
          const canScore = !zone.restrictedToRoles ||
            zone.restrictedToRoles.includes(selectedPosition);

          return (
            <TouchableOpacity
              key={zone.id}
              style={[
                styles.zoneButton,
                !canScore && styles.disabledButton,
                zone.points === 2 && styles.zone2Points,
                zone.points === 3 && styles.zone3Points
              ]}
              disabled={!canScore}
              onPress={() => onAddGoal(team, selectedPosition, zone.id)}
            >
              <Text style={styles.zoneButtonText}>
                +{zone.points} {zone.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010'
  },
  mainContent: {
    flex: 1,
    padding: 16
  },
  setupScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  setupContent: {
    padding: 20
  },
  endedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  title: {
    color: '#FAFAFA',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 32
  },
  inputGroup: {
    marginBottom: 20
  },
  inputLabel: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 16,
    color: '#FAFAFA',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#404040'
  },
  optionButton: {
    backgroundColor: '#1F1F1F',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#404040'
  },
  selectedOption: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6'
  },
  optionText: {
    color: '#FAFAFA',
    fontSize: 16,
    textAlign: 'center'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  periodLabel: {
    color: '#FAFAFA',
    fontSize: 20,
    fontWeight: '600'
  },
  gameType: {
    color: '#94A3B8',
    fontSize: 14
  },
  periodButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  periodButtonText: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  scoreRow: {
    flexDirection: 'row',
    marginBottom: 16
  },
  scoreCard: {
    flex: 1,
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 4
  },
  teamLabel: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12
  },
  positionRow: {
    height: 36,
    marginBottom: 12
  },
  positionChip: {
    backgroundColor: '#262626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#404040'
  },
  selectedPosition: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6'
  },
  positionText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500'
  },
  zoneButtons: {
    marginTop: 8
  },
  zoneButton: {
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8
  },
  zone2Points: {
    backgroundColor: '#F59E0B'
  },
  zone3Points: {
    backgroundColor: '#DC2626'
  },
  zoneButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#262626',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#404040'
  },
  secondaryButtonText: {
    color: '#E5E7EB',
    fontWeight: '600',
    fontSize: 16
  },
  disabledButton: {
    opacity: 0.4
  },
  timelineContainer: {
    flex: 1,
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16
  },
  timelineHeading: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8
  },
  timeline: {
    flex: 1
  },
  timelinePlaceholder: {
    color: '#94A3B8',
    fontSize: 14
  },
  eventItem: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#262626'
  },
  eventText: {
    color: '#E5E7EB',
    fontSize: 14
  },
  actionsRow: {
    flexDirection: 'row'
  },
  finalScore: {
    color: '#FAFAFA',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8
  },
  winnerText: {
    color: '#16A34A',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16
  }
});