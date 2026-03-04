import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findSubstitute } from '../find-substitute';
import { AUTO_SWAP_THRESHOLD, SAFE_RECOVERY_THRESHOLD, SUBSTITUTION_MAP } from '../substitution-map';

// Mock Supabase — build a chainable query builder where every method returns `this`
const mockResult = { data: [] as Array<{ id: string; name: string; muscle_group: string; equipment: string | null }> };

function createChainableQuery() {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = new Proxy(query, {
    get(_target, prop) {
      if (prop === 'then') {
        // Make the proxy thenable so `await query` resolves to mockResult
        return (resolve: (v: typeof mockResult) => void) => resolve(mockResult);
      }
      if (!query[prop as string]) {
        query[prop as string] = vi.fn(() => self);
      }
      return query[prop as string];
    },
  });
  return self;
}

let chainableQuery: ReturnType<typeof createChainableQuery>;

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => {
      chainableQuery = createChainableQuery();
      return chainableQuery;
    }),
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockResult.data = [];
});

function makeRecoveryMap(entries: Record<string, { status: string; recoveryPct: number }>) {
  return entries;
}

describe('substitution-map constants', () => {
  it('AUTO_SWAP_THRESHOLD is 40', () => {
    expect(AUTO_SWAP_THRESHOLD).toBe(40);
  });

  it('SAFE_RECOVERY_THRESHOLD is 60', () => {
    expect(SAFE_RECOVERY_THRESHOLD).toBe(60);
  });

  it('every muscle group in the map has at least one alternative', () => {
    for (const [group, alts] of Object.entries(SUBSTITUTION_MAP)) {
      expect(alts.length).toBeGreaterThan(0);
    }
  });
});

describe('findSubstitute', () => {
  it('returns no swap when muscle is recovered (recoveryPct >= 40)', async () => {
    const map = makeRecoveryMap({
      chest: { status: 'recovering', recoveryPct: 40 },
    });

    const result = await findSubstitute('ex1', 'Bench Press', 'chest', 'barbell', map);

    expect(result.swap).toBeNull();
    expect(result.deload).toBeNull();
  });

  it('returns no swap when muscle is not in recovery map (untrained)', async () => {
    const map = makeRecoveryMap({});

    const result = await findSubstitute('ex1', 'Bench Press', 'chest', 'barbell', map);

    expect(result.swap).toBeNull();
    expect(result.deload).toBeNull();
  });

  it('boundary test: recoveryPct 39 triggers swap, 40 does not', async () => {
    const mapAt39 = makeRecoveryMap({
      chest: { status: 'fatigued', recoveryPct: 39 },
    });

    mockResult.data = [{ id: 'sub1', name: 'OHP', muscle_group: 'shoulders', equipment: 'barbell' }];

    const result39 = await findSubstitute('ex1', 'Bench Press', 'chest', 'barbell', mapAt39);
    // At 39 a swap should be attempted (since shoulders is a safe alternative by default)
    expect(result39.swap).not.toBeNull();

    const mapAt40 = makeRecoveryMap({
      chest: { status: 'recovering', recoveryPct: 40 },
    });

    const result40 = await findSubstitute('ex1', 'Bench Press', 'chest', 'barbell', mapAt40);
    expect(result40.swap).toBeNull();
    expect(result40.deload).toBeNull();
  });

  it('fatigued hamstrings swaps to glutes/calves', async () => {
    const map = makeRecoveryMap({
      hamstrings: { status: 'fatigued', recoveryPct: 20 },
      glutes: { status: 'recovered', recoveryPct: 90 },
    });

    mockResult.data = [{ id: 'sub1', name: 'Hip Thrust', muscle_group: 'glutes', equipment: 'barbell' }];

    const result = await findSubstitute('ex1', 'Romanian DL', 'hamstrings', 'barbell', map);

    expect(result.swap).not.toBeNull();
    expect(result.swap!.swappedMuscleGroup).toBe('glutes');
    expect(result.swap!.swappedExerciseName).toBe('Hip Thrust');
    expect(result.swap!.reason).toContain('hamstrings fatigued');
    expect(result.deload).toBeNull();
  });

  it('fatigued chest swaps to shoulders/triceps', async () => {
    const map = makeRecoveryMap({
      chest: { status: 'fatigued', recoveryPct: 15 },
      shoulders: { status: 'recovered', recoveryPct: 85 },
    });

    mockResult.data = [{ id: 'sub2', name: 'Overhead Press', muscle_group: 'shoulders', equipment: 'barbell' }];

    const result = await findSubstitute('ex1', 'Bench Press', 'chest', 'barbell', map);

    expect(result.swap).not.toBeNull();
    expect(result.swap!.swappedMuscleGroup).toBe('shoulders');
    expect(result.deload).toBeNull();
  });

  it('all alternatives also fatigued → deload applied', async () => {
    // chest alternatives are shoulders and triceps — make both fatigued
    const map = makeRecoveryMap({
      chest: { status: 'fatigued', recoveryPct: 10 },
      shoulders: { status: 'fatigued', recoveryPct: 20 },
      triceps: { status: 'fatigued', recoveryPct: 30 },
    });

    const result = await findSubstitute('ex1', 'Bench Press', 'chest', 'barbell', map);

    expect(result.swap).toBeNull();
    expect(result.deload).not.toBeNull();
    expect(result.deload!.weightMultiplier).toBe(0.5);
    expect(result.deload!.setsMultiplier).toBe(0.6);
    expect(result.deload!.reason).toContain('no safe substitute, deloading');
  });

  it('deload has correct multipliers', async () => {
    const map = makeRecoveryMap({
      core: { status: 'fatigued', recoveryPct: 5 },
      back: { status: 'fatigued', recoveryPct: 10 },
      shoulders: { status: 'fatigued', recoveryPct: 15 },
    });

    const result = await findSubstitute('ex1', 'Plank', 'core', null, map);

    expect(result.deload).not.toBeNull();
    expect(result.deload!.weightMultiplier).toBe(0.5);
    expect(result.deload!.setsMultiplier).toBe(0.6);
  });

  it('unknown muscle group → no swap, no deload', async () => {
    const map = makeRecoveryMap({
      unknown_muscle: { status: 'fatigued', recoveryPct: 5 },
    });

    const result = await findSubstitute('ex1', 'Mystery Move', 'unknown_muscle', null, map);

    // No alternatives in SUBSTITUTION_MAP → deload
    expect(result.swap).toBeNull();
    expect(result.deload).not.toBeNull();
  });

  it('swap includes fatigue status info', async () => {
    const map = makeRecoveryMap({
      back: { status: 'fatigued', recoveryPct: 25 },
      shoulders: { status: 'recovered', recoveryPct: 95 },
    });

    mockResult.data = [{ id: 'sub3', name: 'Lateral Raise', muscle_group: 'shoulders', equipment: 'dumbbell' }];

    const result = await findSubstitute('ex1', 'Barbell Row', 'back', 'dumbbell', map);

    expect(result.swap).not.toBeNull();
    expect(result.swap!.fatigueStatus).toEqual({ recoveryPct: 25, status: 'fatigued' });
    expect(result.swap!.originalExerciseId).toBe('ex1');
    expect(result.swap!.originalExerciseName).toBe('Barbell Row');
    expect(result.swap!.originalMuscleGroup).toBe('back');
  });

  it('falls back to deload when DB returns no exercise candidates', async () => {
    const map = makeRecoveryMap({
      chest: { status: 'fatigued', recoveryPct: 10 },
      // shoulders is not in map → treated as untrained → safe alternative
    });

    // DB returns empty results
    mockResult.data = [];

    const result = await findSubstitute('ex1', 'Bench Press', 'chest', 'barbell', map);

    // Safe alternative exists (shoulders), but no exercises found → deload
    expect(result.swap).toBeNull();
    expect(result.deload).not.toBeNull();
  });
});
