import { describe, expect, it } from 'vitest';
import { assessClient, type AttentionInput } from '../src/services/attention.service';

const now = new Date('2026-10-07T12:00:00Z');
const day = 86_400_000;
const base: AttentionInput = {
  now, joinedAt: new Date(now.getTime() - 60 * day), lastActivityAt: new Date(now.getTime() - 1 * day),
  workoutsPlanned: 6, workoutsCompleted: 6, missedWorkouts: 0, dietLogsTotal: 20, dietLogsCompleted: 19,
};
const run = (o: Partial<AttentionInput>) => assessClient({ ...base, ...o });

describe('client attention engine', () => {
  it('GOOD when everything is on track', () => {
    expect(run({})).toEqual({ level: 'GOOD', reasons: [] });
  });

  it('MONITOR for a single missed workout or 3 idle days', () => {
    expect(run({ missedWorkouts: 1, workoutsCompleted: 5 }).level).toBe('MONITOR');
    const idle = run({ lastActivityAt: new Date(now.getTime() - 4 * day) });
    expect(idle.level).toBe('MONITOR');
    expect(idle.reasons).toContain('No activity for 4 days');
  });

  it('NEEDS ATTENTION reproduces the spec example: missed workouts + low diet + no activity', () => {
    const r = run({ missedWorkouts: 3, workoutsCompleted: 2, workoutsPlanned: 5, dietLogsTotal: 20, dietLogsCompleted: 4, lastActivityAt: new Date(now.getTime() - 9 * day) });
    expect(r.level).toBe('ATTENTION');
    expect(r.reasons).toEqual(expect.arrayContaining(['3 missed workouts', 'Low diet compliance', 'No activity for 9 days']));
  });

  it('does not judge brand-new clients for having no activity yet', () => {
    const r = run({ joinedAt: new Date(now.getTime() - 2 * day), lastActivityAt: null, workoutsPlanned: 0, workoutsCompleted: 0, dietLogsTotal: 0, dietLogsCompleted: 0 });
    expect(r.level).toBe('NEW');
  });

  it('flags an established client who never did anything', () => {
    const r = run({ lastActivityAt: null, workoutsPlanned: 0, workoutsCompleted: 0, dietLogsTotal: 0, dietLogsCompleted: 0 });
    expect(r.level).toBe('ATTENTION');
    expect(r.reasons).toContain('No recent activity');
  });

  it('ignores compliance ratios when there is too little data to mean anything', () => {
    expect(run({ workoutsPlanned: 1, workoutsCompleted: 0, missedWorkouts: 0, dietLogsTotal: 2, dietLogsCompleted: 0 }).level).toBe('GOOD');
  });

  it('uses the pluralisation correctly', () => {
    expect(run({ missedWorkouts: 1, workoutsCompleted: 5 }).reasons).toContain('1 missed workout');
  });
});
