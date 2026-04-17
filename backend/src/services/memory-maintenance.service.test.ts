import assert from 'node:assert/strict';
import { MemoryMaintenanceService } from './memory-maintenance.service';

async function run() {
  const originalApiKey = process.env.DASHSCOPE_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;

  try {
    const service = new MemoryMaintenanceService();
    const result = await service.maintain({
      existingProfile: {
        summary: '在医疗场景里更需要对方放慢速度。',
        common_scenarios: ['medical'],
        risky_terms: ['挂号'],
        support_strategies: ['请对方重复关键词。'],
        updated_at: '2026-04-15T10:00:00.000Z',
      },
      proposedUpdate: {
        summary: '系统更容易把“拿药”听偏，改成“取药”更稳。',
        common_scenarios: ['medical'],
        risky_terms: ['拿药'],
        support_strategies: ['先说更短的版本。'],
        updated_at: '2026-04-16T10:00:00.000Z',
      },
      session: {
        id: 'session-1',
        metadata: {
          communicationScene: 'medical',
          currentPreparedExpressionTitle: '就医说明',
          latestCorrectionOriginal: '拿药',
          latestCorrectionText: '取药',
        },
      },
    });

    assert.equal(result.summary, '系统更容易把“拿药”听偏，改成“取药”更稳。');
    assert.deepEqual(result.common_scenarios, ['medical']);
    assert.deepEqual(result.risky_terms, ['拿药', '挂号']);
    assert.ok(result.support_strategies?.includes('先说更短的版本。'));
    assert.ok(
      result.support_strategies?.some((item) => item.includes('就医说明')),
      'should keep prepared expression context in heuristic support strategies',
    );
    assert.equal(result.updated_at, '2026-04-16T10:00:00.000Z');
  } finally {
    if (typeof originalApiKey === 'string') {
      process.env.DASHSCOPE_API_KEY = originalApiKey;
    } else {
      delete process.env.DASHSCOPE_API_KEY;
    }
  }
}

void run();

