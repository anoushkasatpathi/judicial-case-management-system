import { PriorityFactorType } from '@prisma/client';
import { calculatePriorityScore, comparePriorityQueueItems } from './priority.service.js';

describe('priority scoring', () => {
  const filedAt = new Date(Date.now() - 10 * 86_400_000);

  it('combines age and configured statutory and vulnerability factors', () => {
    expect(calculatePriorityScore({
      filedAt,
      isEmergency: false,
      factors: [
        { factor_type: PriorityFactorType.Age, weight: 1, computed_score: 10 },
        { factor_type: PriorityFactorType.StatutoryUrgency, weight: 2, computed_score: 5 },
        { factor_type: PriorityFactorType.VulnerabilityFlag, weight: 1, computed_score: 2 },
      ],
    })).toBe(22);
  });

  it('gives an emergency case a decisive score jump', () => {
    const factors = [{ factor_type: PriorityFactorType.EmergencyFlag, weight: 1, computed_score: 100 }];
    const normal = calculatePriorityScore({ filedAt, isEmergency: false, factors });
    const emergency = calculatePriorityScore({ filedAt, isEmergency: true, factors });
    expect(emergency - normal).toBe(100);
  });

  it('orders equal scores by oldest filing, then id', () => {
    const older = { id: 'b-case', priority_score: 10, filed_at: new Date('2026-01-01') };
    const newer = { id: 'a-case', priority_score: 10, filed_at: new Date('2026-02-01') };
    expect(comparePriorityQueueItems(older, newer)).toBeLessThan(0);
    expect(comparePriorityQueueItems({ ...older, filed_at: newer.filed_at }, newer)).toBeGreaterThan(0);
  });
});