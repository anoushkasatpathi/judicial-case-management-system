import { PriorityFactorType } from '@prisma/client';
import { calculatePriorityScore, comparePriorityQueueItems, PriorityService } from './priority.service.js';

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

  it('emits the documented queue:updated payload after a reorder', async () => {
    const cases = [
      { id: 'case-a', priority_score: 10, filed_at: new Date('2026-01-01') },
      { id: 'case-b', priority_score: 5, filed_at: new Date('2026-02-01') },
    ];
    const prisma = {
      case: {
        findMany: vi.fn().mockImplementation(() => Promise.resolve([...cases].sort(comparePriorityQueueItems))),
        update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: { priority_score: number } }) => {
          const item = cases.find((candidate) => candidate.id === where.id);
          if (item) item.priority_score = data.priority_score;
          return Promise.resolve(item);
        }),
      },
    };
    const audit = { append: vi.fn().mockResolvedValue(undefined) };
    const redis = {
      readQueue: vi.fn().mockResolvedValue(null),
      writeQueueEntries: vi.fn().mockResolvedValue(true),
      replaceQueue: vi.fn().mockResolvedValue(true),
    };
    const gateway = { emitQueueUpdated: vi.fn() };
    const service = new PriorityService(prisma as never, audit as never, redis as never, gateway as never);

    await service.reorder('court-1', ['case-b', 'case-a'], 'registrar-1', 'Emergency reorder');

    expect(gateway.emitQueueUpdated).toHaveBeenCalledTimes(1);
    const [payload] = gateway.emitQueueUpdated.mock.calls[0];
    expect(payload).toEqual({
      courtId: 'court-1',
      caseIds: ['case-b', 'case-a'],
      updatedAt: expect.any(String),
    });
  });
});