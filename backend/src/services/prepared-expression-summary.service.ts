import {
  buildPreparedExpressionCorrectionPairs,
  buildPreparedExpressionTemplateFromDraft,
  type PreparedExpressionAsset,
  type PreparedExpressionCorrectionPair,
  type PreparedExpressionTrainingPlan,
  type PreparedExpressionTrainingReports,
  type PreparedExpressionTrainingSummaryWindow,
  type PreparedExpressionTemplate,
} from './prepared-expression.service';

export interface PreparedExpressionTrainingSample {
  created_at: string | null;
  target_text: string;
  recognized_text: string;
  feedback_status: string | null;
  prepared_expression_section_id: string | null;
  prepared_expression_section_title: string | null;
  high_risk_phrases: string[];
  hotwords: string[];
  speech_patterns: string[];
  articulation_tips: string[];
  pronunciation_summary: string | null;
}

export type PreparedExpressionSummaryTrigger = 'manual' | 'periodic_auto';

const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DAILY_MODEL_SAMPLE_LIMIT = 24;
const WEEKLY_MODEL_SAMPLE_LIMIT = 56;

interface SummaryWindowPayload {
  summary?: string;
  mismatch_pairs?: Array<{
    target?: string;
    heard?: string;
    occurrence_count?: number;
  }>;
  next_focus?: string[];
  stable_wins?: string[];
  pronunciation_patterns?: string[];
  support_strategies?: string[];
}

interface TrainingPlanPayload {
  summary?: string;
  items?: string[];
}

interface PreparedExpressionTrainingReportPayload {
  daily_summary?: SummaryWindowPayload;
  weekly_summary?: SummaryWindowPayload;
  training_plan?: TrainingPlanPayload;
}

function dedupeStrings(values: Array<string | null | undefined>, limit?: number): string[] {
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

  return typeof limit === 'number' ? results.slice(0, limit) : results;
}

function truncateText(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: Record<string, unknown> | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function buildMismatchPairs(
  samples: PreparedExpressionTrainingSample[],
  limit: number,
  maxChars: number,
): PreparedExpressionCorrectionPair[] {
  return buildPreparedExpressionCorrectionPairs(
    samples.map((sample) => ({
      target: sample.target_text,
      heard: sample.recognized_text,
    })),
    {
      maxPairs: limit,
      maxChars,
    },
  );
}

function buildStableWins(samples: PreparedExpressionTrainingSample[], limit: number): string[] {
  return dedupeStrings(
    samples.flatMap((sample) => {
      const target = sample.target_text.trim();
      const recognized = sample.recognized_text.trim();
      const exactMatch = target && recognized && target === recognized;
      const excellent = sample.feedback_status === 'excellent';

      if (!exactMatch && !excellent) {
        return [];
      }

      return [truncateText(target || recognized, 18)];
    }),
    limit,
  );
}

function buildNextFocus(
  samples: PreparedExpressionTrainingSample[],
  asset: PreparedExpressionAsset,
  limit: number,
): string[] {
  return dedupeStrings(
    [
      ...samples.flatMap((sample) => [
        sample.prepared_expression_section_title,
        ...sample.high_risk_phrases,
        ...sample.speech_patterns,
        ...sample.articulation_tips,
      ]),
      ...asset.structured.highRiskPhrases,
      ...asset.structured.sections.slice(0, 4).map((section) => section.title),
    ],
    limit,
  );
}

function buildPronunciationPatterns(
  samples: PreparedExpressionTrainingSample[],
  limit: number,
): string[] {
  return dedupeStrings(
    [
      ...samples.flatMap((sample) => sample.speech_patterns),
      ...samples.flatMap((sample) => sample.articulation_tips),
      ...samples
        .map((sample) => sample.pronunciation_summary)
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
    ],
    limit,
  );
}

function summarizeWindowHeuristically(
  label: 'daily' | 'weekly',
  samples: PreparedExpressionTrainingSample[],
  asset: PreparedExpressionAsset,
): PreparedExpressionTrainingSummaryWindow | null {
  if (samples.length === 0) {
    return null;
  }

  const mismatchPairs = buildMismatchPairs(samples, 6, 1200);
  const stableWins = buildStableWins(samples, 3);
  const nextFocus = buildNextFocus(samples, asset, 4);
  const summaryLead = label === 'daily' ? '今天' : '最近 7 天';
  const mismatchLead = mismatchPairs[0]
    ? `最值得先收口的是“${truncateText(mismatchPairs[0].target, 14)} -> ${truncateText(mismatchPairs[0].heard, 14)}”`
    : nextFocus[0]
      ? `优先继续盯住“${truncateText(nextFocus[0], 16)}”`
      : '继续把今天最常练的句子说稳';
  const stableLead = stableWins[0] ? `已经较稳的是“${stableWins[0]}”` : null;

  return {
    summary: `${summaryLead}共练了 ${samples.length} 句，${mismatchLead}${stableLead ? `；${stableLead}` : ''}。`,
    sampleCount: samples.length,
    mismatchPairs,
    nextFocus,
    stableWins,
    pronunciationPatterns: buildPronunciationPatterns(samples, 8),
    supportStrategies: dedupeStrings(
      [
        mismatchPairs[0]
          ? `先单独练“${truncateText(mismatchPairs[0].target, 16)}”，避免再被听成“${truncateText(mismatchPairs[0].heard, 16)}”。`
          : null,
        asset.structured.fallbackPhrases[0]
          ? `卡住时先回保底句：${asset.structured.fallbackPhrases[0]}`
          : null,
      ],
      4,
    ),
    generated_at: new Date().toISOString(),
  };
}

function summarizePlanHeuristically(
  dailySummary: PreparedExpressionTrainingSummaryWindow | null,
  weeklySummary: PreparedExpressionTrainingSummaryWindow | null,
): PreparedExpressionTrainingPlan | null {
  const baseFocus = dailySummary?.nextFocus[0] ?? weeklySummary?.nextFocus[0] ?? null;
  const basePair = dailySummary?.mismatchPairs[0] ?? weeklySummary?.mismatchPairs[0] ?? null;

  const items = dedupeStrings(
    [
      basePair
        ? `先单独练“${truncateText(basePair.target, 18)}”，重点避免再被听成“${truncateText(basePair.heard, 18)}”。`
        : null,
      baseFocus ? `下一轮先只盯“${truncateText(baseFocus, 18)}”，不要同时改太多点。` : null,
      '先完成一轮短句复练，再回到整句，保证目标句和转录句差异明显缩小。',
    ],
    3,
  );

  if (items.length === 0) {
    return null;
  }

  return {
    summary: '下一轮计划只保留最少、最具体的动作，先把高频差异收小。',
    items,
    generated_at: new Date().toISOString(),
  };
}

function extractJsonObject(rawText: string): PreparedExpressionTrainingReportPayload | null {
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
    if (!isRecord(parsed)) {
      return null;
    }

    return parsed as PreparedExpressionTrainingReportPayload;
  } catch {
    return null;
  }
}

async function requestDashScopeTrainingReport(
  prompt: string,
  model: string,
  timeoutMs: number,
): Promise<PreparedExpressionTrainingReportPayload | null> {
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
          max_tokens: 1400,
          messages: [
            {
              role: 'system',
              content:
                '你是 VoxFlame 的训练总结器。你只返回 JSON，不要 markdown，不要解释。你的工作只有三件事：基于目标句和转录句的差异，生成今日总结、7天总结、下一轮计划。不要重写准备材料，不要生成 document summary，不要扩写成长文。',
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

function buildModelPrompt(
  asset: PreparedExpressionAsset,
  dailySamples: PreparedExpressionTrainingSample[],
  weeklySamples: PreparedExpressionTrainingSample[],
  trigger: PreparedExpressionSummaryTrigger,
): string {
  const compactDaily = dailySamples.slice(0, DAILY_MODEL_SAMPLE_LIMIT).map((sample) => ({
    created_at: sample.created_at,
    section: sample.prepared_expression_section_title,
    target_text: sample.target_text,
    recognized_text: sample.recognized_text,
    feedback_status: sample.feedback_status,
    speech_patterns: sample.speech_patterns,
    articulation_tips: sample.articulation_tips,
    pronunciation_summary: sample.pronunciation_summary,
  }));

  const compactWeekly = weeklySamples.slice(0, WEEKLY_MODEL_SAMPLE_LIMIT).map((sample) => ({
    created_at: sample.created_at,
    section: sample.prepared_expression_section_title,
    target_text: sample.target_text,
    recognized_text: sample.recognized_text,
    feedback_status: sample.feedback_status,
    speech_patterns: sample.speech_patterns,
    articulation_tips: sample.articulation_tips,
    pronunciation_summary: sample.pronunciation_summary,
  }));

  return JSON.stringify(
    {
      task: 'training_daily_weekly_summary_and_plan',
      trigger,
      instructions: {
        focus: [
          'daily_summary 只根据 last_24h_samples 生成。',
          'weekly_summary 只根据 last_7d_samples 生成。',
          '只总结 target_text 和 recognized_text 的稳定差异，不要把准备材料本身改写成训练结论。',
          'mismatch_pairs 只保留真实稳定出现的“目标 -> 系统听到”错配。',
          'training_plan 只给 2 到 3 条最具体、最窄的下一步动作。',
          'weekly_summary 会同时服务训练页和纠错链路，所以要精确、短、可复用。',
        ],
        limits: {
          daily_mismatch_pairs: 4,
          weekly_mismatch_pairs: 6,
          next_focus: 4,
          stable_wins: 3,
          plan_items: 3,
          pronunciation_patterns: 8,
          support_strategies: 4,
        },
        output_schema: {
          daily_summary: {
            summary: 'string',
            mismatch_pairs: [
              {
                target: 'string',
                heard: 'string',
                occurrence_count: 1,
              },
            ],
            next_focus: ['string'],
            stable_wins: ['string'],
            pronunciation_patterns: ['string'],
            support_strategies: ['string'],
          },
          weekly_summary: {
            summary: 'string',
            mismatch_pairs: [
              {
                target: 'string',
                heard: 'string',
                occurrence_count: 1,
              },
            ],
            next_focus: ['string'],
            stable_wins: ['string'],
            pronunciation_patterns: ['string'],
            support_strategies: ['string'],
          },
          training_plan: {
            summary: 'string',
            items: ['string'],
          },
        },
      },
      prepared_expression_context: {
        title: asset.draft.title,
        scene: asset.draft.scene,
        source: asset.draft.source,
        high_risk_phrases: asset.structured.highRiskPhrases.slice(0, 6),
        section_titles: asset.structured.sections.slice(0, 8).map((section) => section.title),
      },
      last_24h_samples: compactDaily,
      last_7d_samples: compactWeekly,
    },
    null,
    2,
  );
}

function readPayloadPairs(
  value: unknown,
  limit: number,
  maxChars: number,
): PreparedExpressionCorrectionPair[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return buildPreparedExpressionCorrectionPairs(
    value
      .map((pair) => {
        if (!isRecord(pair)) {
          return null;
        }

        return {
          target: readString(pair, 'target'),
          heard: readString(pair, 'heard'),
        };
      })
      .filter((pair): pair is { target: string | null; heard: string | null } => Boolean(pair)),
    {
      maxPairs: limit,
      maxChars,
    },
  );
}

function buildWindowFromPayload(
  payload: SummaryWindowPayload | undefined,
  heuristic: PreparedExpressionTrainingSummaryWindow | null,
): PreparedExpressionTrainingSummaryWindow | null {
  if (!heuristic && !payload) {
    return null;
  }

  const mismatchPairs = payload
    ? readPayloadPairs(payload.mismatch_pairs, 6, 1200)
    : [];

  return {
    summary: payload?.summary?.trim() || heuristic?.summary || '',
    sampleCount: heuristic?.sampleCount || mismatchPairs.length,
    mismatchPairs: mismatchPairs.length > 0 ? mismatchPairs : heuristic?.mismatchPairs ?? [],
    nextFocus: dedupeStrings(payload?.next_focus ?? heuristic?.nextFocus ?? [], 4),
    stableWins: dedupeStrings(payload?.stable_wins ?? heuristic?.stableWins ?? [], 3),
    pronunciationPatterns: dedupeStrings(
      payload?.pronunciation_patterns ?? heuristic?.pronunciationPatterns ?? [],
      8,
    ),
    supportStrategies: dedupeStrings(
      payload?.support_strategies ?? heuristic?.supportStrategies ?? [],
      4,
    ),
    generated_at: heuristic?.generated_at ?? new Date().toISOString(),
  };
}

function buildPlanFromPayload(
  payload: TrainingPlanPayload | undefined,
  heuristic: PreparedExpressionTrainingPlan | null,
): PreparedExpressionTrainingPlan | null {
  if (!heuristic && !payload?.summary?.trim()) {
    return null;
  }

  const items = dedupeStrings(payload?.items ?? heuristic?.items ?? [], 3);
  const summary = payload?.summary?.trim() || heuristic?.summary;
  if (!summary) {
    return null;
  }

  return {
    summary,
    items,
    generated_at: heuristic?.generated_at ?? new Date().toISOString(),
  };
}

export class PreparedExpressionSummaryService {
  public async summarize(
    asset: PreparedExpressionAsset,
    samples: PreparedExpressionTrainingSample[],
    trigger: PreparedExpressionSummaryTrigger,
  ): Promise<PreparedExpressionAsset> {
    if (samples.length === 0) {
      return {
        draft: asset.draft,
        structured: buildPreparedExpressionTemplateFromDraft(asset.draft),
        training_reports: null,
      };
    }

    const structured: PreparedExpressionTemplate =
      asset.structured.sections.length > 0
        ? asset.structured
        : buildPreparedExpressionTemplateFromDraft(asset.draft);
    const normalizedAsset: PreparedExpressionAsset = {
      ...asset,
      structured,
      training_reports: null,
    };
    const now = Date.now();
    const dailySamples = samples.filter((sample) => {
      const timestamp = toTimestamp(sample.created_at);
      return timestamp !== null && now - timestamp <= DAILY_WINDOW_MS;
    });
    const weeklySamples = samples.filter((sample) => {
      const timestamp = toTimestamp(sample.created_at);
      return timestamp !== null && now - timestamp <= WEEKLY_WINDOW_MS;
    });

    const heuristicDaily = summarizeWindowHeuristically('daily', dailySamples, normalizedAsset);
    const heuristicWeekly = summarizeWindowHeuristically('weekly', weeklySamples, normalizedAsset);
    const heuristicPlan = summarizePlanHeuristically(heuristicDaily, heuristicWeekly);

    const model = process.env.DASHSCOPE_TRAINING_REPORT_MODEL?.trim() || 'qwen3.5-plus';
    const timeoutMs = Math.max(
      3000,
      Number.parseInt(
        process.env.DASHSCOPE_TRAINING_REPORT_TIMEOUT_SECONDS
          || process.env.DASHSCOPE_PREPARED_EXPRESSION_SUMMARY_TIMEOUT_SECONDS
          || '12000',
        10,
      ) || 12000,
    );
    const payload = await requestDashScopeTrainingReport(
      buildModelPrompt(normalizedAsset, dailySamples, weeklySamples, trigger),
      model,
      timeoutMs,
    );

    const trainingReports: PreparedExpressionTrainingReports = {
      dailySummary: buildWindowFromPayload(payload?.daily_summary, heuristicDaily),
      weeklySummary: buildWindowFromPayload(payload?.weekly_summary, heuristicWeekly),
      trainingPlan: buildPlanFromPayload(payload?.training_plan, heuristicPlan),
    };

    return {
      draft: asset.draft,
      structured,
      training_reports:
        trainingReports.dailySummary || trainingReports.weeklySummary || trainingReports.trainingPlan
          ? trainingReports
          : null,
    };
  }
}
