import {
  Session,
  UserProfileMemoryRecord,
  normalizeUserProfileMemory,
} from './supabase.service';

type JsonRecord = Record<string, unknown>;

interface MemoryMaintenanceRequest {
  existingProfile: UserProfileMemoryRecord;
  proposedUpdate: UserProfileMemoryRecord;
  session?: Partial<Session>;
}

interface MemoryMaintenancePayload {
  summary?: string;
  common_scenarios?: string[];
  risky_terms?: string[];
  support_strategies?: string[];
}

interface MemoryMaintenanceSessionContext {
  scene: string | null;
  preparedExpressionTitle: string | null;
  preparedExpressionSectionTitle: string | null;
  latestCorrectionOriginal: string | null;
  latestCorrectionText: string | null;
  loadoutMode: string | null;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: JsonRecord | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function dedupeStrings(values: Array<string | null | undefined>, limit: number): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  values.forEach((value) => {
    if (typeof value !== 'string') {
      return;
    }

    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    results.push(normalized);
  });

  return results.slice(0, limit);
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function extractJsonObject(rawText: string): MemoryMaintenancePayload | null {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as unknown;
    return isRecord(parsed) ? parsed as MemoryMaintenancePayload : null;
  } catch {
    return null;
  }
}

function buildSessionContext(session: Partial<Session> | undefined): MemoryMaintenanceSessionContext {
  const metadata = isRecord(session?.metadata) ? session.metadata : undefined;

  return {
    scene: readString(metadata, 'communicationScene') ?? readString(metadata, 'scene'),
    preparedExpressionTitle: readString(metadata, 'currentPreparedExpressionTitle'),
    preparedExpressionSectionTitle: readString(metadata, 'currentPreparedExpressionSectionTitle'),
    latestCorrectionOriginal: readString(metadata, 'latestCorrectionOriginal'),
    latestCorrectionText: readString(metadata, 'latestCorrectionText'),
    loadoutMode: readString(metadata, 'loadoutMode'),
  };
}

function buildHeuristicProfile(
  existingProfile: UserProfileMemoryRecord,
  proposedUpdate: UserProfileMemoryRecord,
  sessionContext: MemoryMaintenanceSessionContext,
  updatedAt: string,
): UserProfileMemoryRecord {
  const riskyTerms = dedupeStrings(
    [
      ...(proposedUpdate.risky_terms ?? []),
      sessionContext.latestCorrectionOriginal,
      ...(existingProfile.risky_terms ?? []),
    ],
    6,
  );

  const supportStrategies = dedupeStrings(
    [
      ...(proposedUpdate.support_strategies ?? []),
      sessionContext.preparedExpressionTitle
        ? `重要表达继续围绕《${truncateText(sessionContext.preparedExpressionTitle, 24)}》准备。`
        : null,
      sessionContext.latestCorrectionOriginal &&
      sessionContext.latestCorrectionText &&
      sessionContext.latestCorrectionOriginal !== sessionContext.latestCorrectionText
        ? `系统听偏时，优先切回“${truncateText(sessionContext.latestCorrectionText, 20)}”这种更稳的说法。`
        : null,
      ...(existingProfile.support_strategies ?? []),
    ],
    6,
  );

  const summary = (() => {
    if (proposedUpdate.summary?.trim()) {
      return truncateText(proposedUpdate.summary.trim(), 140);
    }

    if (
      sessionContext.latestCorrectionOriginal &&
      sessionContext.latestCorrectionText &&
      sessionContext.latestCorrectionOriginal !== sessionContext.latestCorrectionText
    ) {
      return `系统更容易把“${truncateText(sessionContext.latestCorrectionOriginal, 16)}”听偏，改成“${truncateText(sessionContext.latestCorrectionText, 16)}”更稳。`;
    }

    if (existingProfile.summary?.trim()) {
      return truncateText(existingProfile.summary.trim(), 140);
    }

    return undefined;
  })();

  return {
    summary,
    common_scenarios: dedupeStrings(
      [
        ...(proposedUpdate.common_scenarios ?? []),
        sessionContext.scene,
        ...(existingProfile.common_scenarios ?? []),
      ],
      6,
    ),
    risky_terms: riskyTerms,
    support_strategies: supportStrategies,
    updated_at: updatedAt,
  };
}

async function requestDashScopeMemoryMaintenance(
  prompt: string,
  model: string,
  timeoutMs: number,
): Promise<MemoryMaintenancePayload | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${(process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').trim().replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 900,
          messages: [
            {
              role: 'system',
              content:
                '你是 VoxFlame 的记忆维护器。你只返回 JSON，不要 markdown，不要解释。你的职责只有维护用户个人画像，不要生成新的记忆类型，不要写会话复盘。summary 必须短，arrays 只保留稳定、长期有用的点。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          parameters: {
            enable_thinking: false,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ type?: string; text?: string }>;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    const rawText =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content
              .filter((item) => item?.type === 'text' && typeof item.text === 'string')
              .map((item) => item.text)
              .join('')
          : '';

    return extractJsonObject(rawText);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(
  existingProfile: UserProfileMemoryRecord,
  proposedUpdate: UserProfileMemoryRecord,
  sessionContext: MemoryMaintenanceSessionContext,
): string {
  return JSON.stringify(
    {
      task: 'maintain_user_profile_memory',
      instructions: {
        goals: [
          '只维护现有的用户个人画像，不新增新的 memory object。',
          '只保留稳定偏好、稳定误听规律、稳定补救策略。',
          '不要把一次性会话波动写成长期事实。',
          'summary 保持 1 到 2 句话，能直接给后续沟通链复用。',
        ],
        output_schema: {
          summary: 'string',
          common_scenarios: ['string'],
          risky_terms: ['string'],
          support_strategies: ['string'],
        },
        limits: {
          summary_max_chars: 140,
          common_scenarios: 6,
          risky_terms: 6,
          support_strategies: 6,
        },
      },
      existing_user_profile_memory: {
        summary: existingProfile.summary ?? null,
        common_scenarios: existingProfile.common_scenarios ?? [],
        risky_terms: existingProfile.risky_terms ?? [],
        support_strategies: existingProfile.support_strategies ?? [],
      },
      proposed_session_update: {
        summary: proposedUpdate.summary ?? null,
        common_scenarios: proposedUpdate.common_scenarios ?? [],
        risky_terms: proposedUpdate.risky_terms ?? [],
        support_strategies: proposedUpdate.support_strategies ?? [],
      },
      session_context: {
        scene: sessionContext.scene,
        loadout_mode: sessionContext.loadoutMode,
        prepared_expression_title: sessionContext.preparedExpressionTitle,
        prepared_expression_section_title: sessionContext.preparedExpressionSectionTitle,
        latest_correction_original: sessionContext.latestCorrectionOriginal,
        latest_correction_text: sessionContext.latestCorrectionText,
      },
    },
    null,
    2,
  );
}

function mergeModelPayload(
  heuristicProfile: UserProfileMemoryRecord,
  payload: MemoryMaintenancePayload | null,
  updatedAt: string,
): UserProfileMemoryRecord {
  if (!payload) {
    return heuristicProfile;
  }

  return {
    summary: typeof payload.summary === 'string' && payload.summary.trim().length > 0
      ? truncateText(payload.summary.trim(), 140)
      : heuristicProfile.summary,
    common_scenarios: dedupeStrings(
      readStringList(payload.common_scenarios).length > 0
        ? readStringList(payload.common_scenarios)
        : (heuristicProfile.common_scenarios ?? []),
      6,
    ),
    risky_terms: dedupeStrings(
      readStringList(payload.risky_terms).length > 0
        ? readStringList(payload.risky_terms)
        : (heuristicProfile.risky_terms ?? []),
      6,
    ),
    support_strategies: dedupeStrings(
      readStringList(payload.support_strategies).length > 0
        ? readStringList(payload.support_strategies)
        : (heuristicProfile.support_strategies ?? []),
      6,
    ),
    updated_at: updatedAt,
  };
}

export class MemoryMaintenanceService {
  async maintain({
    existingProfile,
    proposedUpdate,
    session,
  }: MemoryMaintenanceRequest): Promise<UserProfileMemoryRecord> {
    const normalizedExisting = normalizeUserProfileMemory(existingProfile);
    const normalizedProposed = normalizeUserProfileMemory(proposedUpdate);
    const updatedAt = normalizedProposed.updated_at ?? new Date().toISOString();
    const sessionContext = buildSessionContext(session);
    const heuristicProfile = buildHeuristicProfile(
      normalizedExisting,
      normalizedProposed,
      sessionContext,
      updatedAt,
    );

    const model = process.env.DASHSCOPE_MEMORY_MAINTENANCE_MODEL?.trim() || 'qwen3.5-plus';
    const timeoutMs = Math.max(
      3000,
      Number.parseInt(process.env.DASHSCOPE_MEMORY_MAINTENANCE_TIMEOUT_SECONDS || '12000', 10) || 12000,
    );
    const payload = await requestDashScopeMemoryMaintenance(
      buildPrompt(normalizedExisting, normalizedProposed, sessionContext),
      model,
      timeoutMs,
    );

    return mergeModelPayload(heuristicProfile, payload, updatedAt);
  }
}

