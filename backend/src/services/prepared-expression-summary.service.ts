import {
  buildAsrHotwordEntries,
  buildPreparedExpressionTemplateFromDraft,
  type PreparedExpressionAsset,
  type PreparedExpressionRehearsalSummary,
  type PreparedExpressionSectionTemplate,
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

const SUMMARY_SAMPLE_WINDOW = 50;

interface PreparedExpressionSummaryPayload {
  document_summary?: string;
  document_hotwords?: string[];
  document_high_risk_phrases?: string[];
  document_fallback_phrases?: string[];
  sections?: Array<{
    id?: string;
    title?: string;
    summary?: string;
    anchor_line?: string;
    practice_lines?: string[];
    high_risk_phrases?: string[];
    fallback_phrases?: string[];
    hotwords?: string[];
    base_priority?: number;
  }>;
  rehearsal_summary?: string;
  rehearsal_hotwords?: string[];
  recurring_errors?: string[];
  pronunciation_patterns?: string[];
  support_strategies?: string[];
  fallback_phrases?: string[];
  next_focus?: string[];
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

function normalizeSectionSuggestions(
  existing: PreparedExpressionSectionTemplate[],
  payload: PreparedExpressionSummaryPayload | null,
): PreparedExpressionSectionTemplate[] {
  if (!payload?.sections || payload.sections.length === 0) {
    return existing;
  }

  return existing.map((section) => {
    const suggested = payload.sections?.find((item) => {
      if (!item) {
        return false;
      }

      const suggestedId = typeof item.id === 'string' ? item.id.trim() : '';
      const suggestedTitle = typeof item.title === 'string' ? item.title.trim() : '';
      return suggestedId === section.id || suggestedTitle === section.title;
    });

    if (!suggested) {
      return section;
    }

    return {
      ...section,
      title: suggested.title?.trim() || section.title,
      summary: suggested.summary?.trim() || section.summary,
      anchorLine: suggested.anchor_line?.trim() || section.anchorLine,
      practiceLines: dedupeStrings(
        [
          ...readStringList(suggested.practice_lines),
          ...section.practiceLines,
        ],
        4,
      ),
      highRiskPhrases: dedupeStrings(
        [
          ...readStringList(suggested.high_risk_phrases),
          ...section.highRiskPhrases,
        ],
        4,
      ),
      fallbackPhrases: dedupeStrings(
        [
          ...readStringList(suggested.fallback_phrases),
          ...section.fallbackPhrases,
        ],
        3,
      ),
      hotwords: dedupeStrings(
        [
          ...readStringList(suggested.hotwords),
          ...section.hotwords,
        ],
        6,
      ),
      basePriority:
        typeof suggested.base_priority === 'number'
          ? Math.max(1, Math.min(6, suggested.base_priority))
          : section.basePriority,
    };
  });
}

function buildTargetHeardPairs(
  samples: PreparedExpressionTrainingSample[],
): string[] {
  return dedupeStrings(
    samples.flatMap((sample) => {
      const target = sample.target_text.trim();
      const recognized = sample.recognized_text.trim();
      if (!target || !recognized || target === recognized) {
        return [];
      }

      return [`目标“${truncateText(target, 18)}”常被听成“${truncateText(recognized, 18)}”`];
    }),
    8,
  );
}

function buildHeuristicSummary(
  asset: PreparedExpressionAsset,
  samples: PreparedExpressionTrainingSample[],
): {
  structured: PreparedExpressionTemplate;
  rehearsal: PreparedExpressionRehearsalSummary;
} {
  const fallbackStructured = buildPreparedExpressionTemplateFromDraft(asset.draft);
  const sectionStats = new Map<
    string,
    {
      title: string;
      total: number;
      weak: number;
    }
  >();
  const targetHeardPairs = buildTargetHeardPairs(samples);

  const recurringErrors = dedupeStrings(
    samples.flatMap((sample) => {
      const target = sample.target_text.trim();
      const recognized = sample.recognized_text.trim();
      if (!target || !recognized || target === recognized) {
        return [
          ...sample.speech_patterns,
          ...sample.articulation_tips,
        ];
      }

      return [
        `目标“${truncateText(target, 18)}”常被听成“${truncateText(recognized, 18)}”`,
        ...sample.speech_patterns,
        ...sample.articulation_tips,
      ];
    }),
    8,
  );

  samples.forEach((sample) => {
    const sectionKey =
      sample.prepared_expression_section_id?.trim() ||
      sample.prepared_expression_section_title?.trim();
    const sectionTitle = sample.prepared_expression_section_title?.trim();
    if (!sectionKey || !sectionTitle) {
      return;
    }

    const current = sectionStats.get(sectionKey) ?? {
      title: sectionTitle,
      total: 0,
      weak: 0,
    };

    current.total += 1;
    if (sample.feedback_status !== 'excellent') {
      current.weak += 1;
    }

    sectionStats.set(sectionKey, current);
  });

  const prioritizedSections = [...sectionStats.values()]
    .sort((left, right) => {
      if (right.weak !== left.weak) {
        return right.weak - left.weak;
      }
      return right.total - left.total;
    })
    .slice(0, 3)
    .map((item) => item.title);

  const hotwords = dedupeStrings(
    [
      ...asset.structured.hotwords,
      ...asset.structured.sections.flatMap((section) => section.hotwords),
      ...samples.flatMap((sample) => sample.hotwords),
      ...samples.flatMap((sample) => sample.high_risk_phrases),
    ],
    12,
  );

  const fallbackPhrases = dedupeStrings(
    [
      ...asset.structured.fallbackPhrases,
      ...asset.structured.sections.flatMap((section) => section.fallbackPhrases),
    ],
    6,
  );

  const pronunciationPatterns = dedupeStrings(
    [
      ...samples.flatMap((sample) => sample.speech_patterns),
      ...samples.flatMap((sample) => sample.articulation_tips),
      ...samples
        .map((sample) => sample.pronunciation_summary)
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
    ],
    8,
  );

  const supportStrategies = dedupeStrings(
    [
      fallbackPhrases[0] ? `卡住时先退回保底句：${fallbackPhrases[0]}` : null,
      prioritizedSections[0] ? `下一轮先把“${prioritizedSections[0]}”里的重点词和短句练稳。` : null,
      targetHeardPairs[0] ? `先单独纠正这组高频替换，再把整句接回去：${targetHeardPairs[0]}` : null,
    ],
    4,
  );

  return {
    structured: {
      ...fallbackStructured,
      summary:
        samples.length > 0
          ? `这份准备内容当前已累计 ${samples.length} 条训练样本，优先继续保护 ${prioritizedSections[0] ?? fallbackStructured.sections[0]?.title ?? '当前重点段落'} 里的热词和风险句。`
          : fallbackStructured.summary,
      hotwords,
      highRiskPhrases: dedupeStrings(
        [
          ...fallbackStructured.highRiskPhrases,
          ...samples.flatMap((sample) => sample.high_risk_phrases),
        ],
        8,
      ),
      fallbackPhrases,
    },
    rehearsal: {
      summary:
        samples.length > 0
          ? `最近 ${samples.length} 条训练样本里，系统最常听偏的是 ${targetHeardPairs[0] ?? prioritizedSections[0] ?? '当前重点段落'}。`
          : '准备内容已经保存。先继续按拆句训练，积累到下一轮总结门槛后再自动压规律和热词。',
      hotwords,
      recurringErrors,
      pronunciationPatterns,
      supportStrategies,
      fallbackPhrases,
      nextFocus: dedupeStrings(
        [
          ...prioritizedSections,
          ...asset.structured.highRiskPhrases.slice(0, 2),
        ],
        6,
      ),
      asrHotwordEntries: buildAsrHotwordEntries(hotwords),
      basedOnTrainingCount: samples.length,
      model: 'heuristic',
      updated_at: new Date().toISOString(),
    },
  };
}

function extractJsonObject(rawText: string): PreparedExpressionSummaryPayload | null {
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

    return parsed as PreparedExpressionSummaryPayload;
  } catch {
    return null;
  }
}

async function requestDashScopeSummary(
  prompt: string,
  model: string,
  timeoutMs: number,
): Promise<PreparedExpressionSummaryPayload | null> {
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
          max_tokens: 1200,
          messages: [
            {
              role: 'system',
              content:
                '你是 VoxFlame 的 correction memory summarizer。你只返回 JSON，不要 markdown，不要解释。你的目标是把用户自定义准备内容和训练样本压成适合 qwen3.6 / qwen3-asr 使用的最小必要上下文，只保留热词、风险句、目标句和系统听到的差距、保底句与下一轮重点。',
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
  samples: PreparedExpressionTrainingSample[],
  trigger: PreparedExpressionSummaryTrigger,
): string {
  const compactSamples = samples.slice(0, SUMMARY_SAMPLE_WINDOW).map((sample) => ({
    created_at: sample.created_at,
    section: sample.prepared_expression_section_title,
    target_text: sample.target_text,
    recognized_text: sample.recognized_text,
    feedback_status: sample.feedback_status,
    hotwords: sample.hotwords,
    speech_patterns: sample.speech_patterns,
    articulation_tips: sample.articulation_tips,
    pronunciation_summary: sample.pronunciation_summary,
  }));

  return JSON.stringify(
    {
      task: 'prepared_expression_compaction_for_correction',
      trigger,
      instructions: {
        limits: {
          document_hotwords: 12,
          document_high_risk_phrases: 8,
          document_fallback_phrases: 6,
          sections: 12,
          rehearsal_hotwords: 12,
          recurring_errors: 8,
          pronunciation_patterns: 8,
          support_strategies: 6,
          next_focus: 6,
        },
        focus: [
          '优先提取对实时 correction 最有帮助的信息，不要生成成长报表。',
          '训练总结只从 rehearsal_samples 提炼，不要把准备稿原文伪装成训练结论。',
          '高频错误尽量写成“目标 -> 系统听到”的形式。',
          '优先总结稳定复现的局部替换规律，不要重写整句风格。',
          '热词需要适合直接进入 ASR hotword 列表和 LLM preparation context。',
        ],
        output_schema: {
          document_summary: 'string',
          document_hotwords: ['string'],
          document_high_risk_phrases: ['string'],
          document_fallback_phrases: ['string'],
          sections: [
            {
              id: 'string',
              title: 'string',
              summary: 'string',
              anchor_line: 'string',
              practice_lines: ['string'],
              high_risk_phrases: ['string'],
              fallback_phrases: ['string'],
              hotwords: ['string'],
              base_priority: 1,
            },
          ],
          rehearsal_summary: 'string',
          rehearsal_hotwords: ['string'],
          recurring_errors: ['string'],
          pronunciation_patterns: ['string'],
          support_strategies: ['string'],
          fallback_phrases: ['string'],
          next_focus: ['string'],
        },
      },
      prepared_expression: {
        draft: {
          title: asset.draft.title,
          scene: asset.draft.scene,
          source: asset.draft.source,
          content: asset.draft.content.slice(0, 7000),
        },
        structured: {
          title: asset.structured.title,
          summary: asset.structured.summary,
          hotwords: asset.structured.hotwords,
          high_risk_phrases: asset.structured.highRiskPhrases,
          fallback_phrases: asset.structured.fallbackPhrases,
          sections: asset.structured.sections.map((section) => ({
            id: section.id,
            title: section.title,
            summary: section.summary,
            anchor_line: section.anchorLine,
            practice_lines: section.practiceLines,
            high_risk_phrases: section.highRiskPhrases,
            fallback_phrases: section.fallbackPhrases,
            hotwords: section.hotwords,
            base_priority: section.basePriority,
          })),
        },
      },
      rehearsal_samples: compactSamples,
    },
    null,
    2,
  );
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
        rehearsal_summary: null,
      };
    }

    const heuristic = buildHeuristicSummary(asset, samples);
    const model =
      process.env.DASHSCOPE_PREPARED_EXPRESSION_SUMMARY_MODEL?.trim() ||
      process.env.DASHSCOPE_LLM_MODEL?.trim() ||
      'qwen3.5-plus';
    const timeoutMs = Math.max(
      3000,
      Number.parseInt(
        process.env.DASHSCOPE_PREPARED_EXPRESSION_SUMMARY_TIMEOUT_SECONDS || '12000',
        10,
      ) || 12000,
    );
    const payload = await requestDashScopeSummary(
      buildModelPrompt(asset, samples, trigger),
      model,
      timeoutMs,
    );

    const structuredSections = normalizeSectionSuggestions(heuristic.structured.sections, payload);
    const structured: PreparedExpressionTemplate = {
      ...heuristic.structured,
      summary: payload?.document_summary?.trim() || heuristic.structured.summary,
      hotwords: dedupeStrings(
        [
          ...readStringList(payload?.document_hotwords),
          ...heuristic.structured.hotwords,
          ...structuredSections.flatMap((section) => section.hotwords),
        ],
        12,
      ),
      highRiskPhrases: dedupeStrings(
        [
          ...readStringList(payload?.document_high_risk_phrases),
          ...heuristic.structured.highRiskPhrases,
          ...structuredSections.flatMap((section) => section.highRiskPhrases),
        ],
        8,
      ),
      fallbackPhrases: dedupeStrings(
        [
          ...readStringList(payload?.document_fallback_phrases),
          ...heuristic.structured.fallbackPhrases,
          ...structuredSections.flatMap((section) => section.fallbackPhrases),
          ...readStringList(payload?.fallback_phrases),
        ],
        6,
      ),
      sections: structuredSections,
    };

    const rehearsalHotwords = dedupeStrings(
      [
        ...readStringList(payload?.rehearsal_hotwords),
        ...structured.hotwords,
        ...heuristic.rehearsal.hotwords,
      ],
      12,
    );
    const fallbackPhrases = dedupeStrings(
      [
        ...readStringList(payload?.fallback_phrases),
        ...structured.fallbackPhrases,
        ...heuristic.rehearsal.fallbackPhrases,
      ],
      6,
    );

    return {
      draft: asset.draft,
      structured,
      rehearsal_summary: {
        summary: payload?.rehearsal_summary?.trim() || heuristic.rehearsal.summary,
        hotwords: rehearsalHotwords,
        recurringErrors: dedupeStrings(
          [
            ...readStringList(payload?.recurring_errors),
            ...heuristic.rehearsal.recurringErrors,
          ],
          8,
        ),
        pronunciationPatterns: dedupeStrings(
          [
            ...readStringList(payload?.pronunciation_patterns),
            ...heuristic.rehearsal.pronunciationPatterns,
          ],
          8,
        ),
        supportStrategies: dedupeStrings(
          [
            ...readStringList(payload?.support_strategies),
            ...heuristic.rehearsal.supportStrategies,
          ],
          6,
        ),
        fallbackPhrases,
        nextFocus: dedupeStrings(
          [
            ...readStringList(payload?.next_focus),
            ...heuristic.rehearsal.nextFocus,
          ],
          6,
        ),
        asrHotwordEntries: buildAsrHotwordEntries(rehearsalHotwords),
        basedOnTrainingCount: samples.length,
        model: payload ? model : heuristic.rehearsal.model,
        updated_at: new Date().toISOString(),
      },
    };
  }
}
