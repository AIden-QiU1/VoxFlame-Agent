export interface PreparedExpressionSectionTemplate {
  id: string;
  title: string;
  summary: string;
  anchorLine: string;
  practiceLines: string[];
  highRiskPhrases: string[];
  fallbackPhrases: string[];
  hotwords: string[];
  basePriority: number;
}

export interface PreparedExpressionTemplate {
  id: string;
  title: string;
  summary: string;
  scene: string | null;
  source: string;
  hotwords: string[];
  highRiskPhrases: string[];
  fallbackPhrases: string[];
  sections: PreparedExpressionSectionTemplate[];
}

export interface PreparedExpressionDraft {
  id: string;
  title: string;
  scene: string | null;
  source: string;
  content: string;
  updated_at: string;
}

export interface PreparedExpressionAsrHotwordEntry {
  text: string;
  weight: number;
  lang: 'zh' | 'en';
}

export interface PreparedExpressionCorrectionPair {
  target: string;
  heard: string;
  occurrenceCount: number;
}

export interface PreparedExpressionRehearsalSummary {
  summary: string;
  hotwords: string[];
  recurringErrors: string[];
  pronunciationPatterns: string[];
  supportStrategies: string[];
  fallbackPhrases: string[];
  nextFocus: string[];
  asrHotwordEntries: PreparedExpressionAsrHotwordEntry[];
  referenceLines: string[];
  trainingPairs: PreparedExpressionCorrectionPair[];
  basedOnTrainingCount: number;
  model: string;
  updated_at: string;
}

export interface PreparedExpressionAsset {
  draft: PreparedExpressionDraft;
  structured: PreparedExpressionTemplate;
  rehearsal_summary: PreparedExpressionRehearsalSummary | null;
}

const COMMON_STOPWORDS = new Set([
  '大家',
  '我们',
  '你们',
  '这个',
  '那个',
  '这里',
  '那里',
  '自己',
  '现在',
  '这样',
  '就是',
  '因为',
  '所以',
  '但是',
  '以及',
  '还有',
  '一些',
  '可以',
  '不是',
  '没有',
  '需要',
  '希望',
  '然后',
  '已经',
  '继续',
  '更多',
  '其实',
  '如果',
  '一个',
  '一种',
  '一样',
  '真的',
  '时候',
  '场景',
  '表达',
  '问题',
  '产品',
  '用户',
  '沟通',
]);

const TARGET_SEGMENT_MIN_LENGTH = 10;
const TARGET_SEGMENT_MAX_LENGTH = 20;
const HARD_SEGMENT_MAX_LENGTH = 24;
const CLAUSE_BREAK_PUNCTUATION = new Set(['，', '、', '：', ':', '；', ';', '。', '！', '？', '!', '?']);
const SOFT_SPLIT_HINTS = ['如果', '但是', '因为', '所以', '然后', '并且', '以及', '同时', '或者', '比如', '例如', '为了'];

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

function normalizeContent(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function truncateText(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function measureSegmentLength(value: string): number {
  return value.replace(/\s+/g, '').trim().length;
}

function slugifyId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return normalized || `prepared-expression-${Date.now()}`;
}

function splitParagraphs(content: string): string[] {
  const normalized = normalizeContent(content);
  if (!normalized) {
    return [];
  }

  const grouped = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (grouped.length > 1) {
    return grouped;
  }

  return normalized
    .split(/(?<=[。！？!?])/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function splitIntoClauses(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const clauses: string[] = [];
  let current = '';

  for (const char of normalized) {
    current += char;
    if (CLAUSE_BREAK_PUNCTUATION.has(char)) {
      const clause = current.trim();
      if (clause) {
        clauses.push(clause);
      }
      current = '';
    }
  }

  const tail = current.trim();
  if (tail) {
    clauses.push(tail);
  }

  return clauses;
}

function splitTrailingPunctuation(value: string): { core: string; suffix: string } {
  const match = value.match(/^(.*?)([，。、！？；：:;!?]*)$/);
  if (!match) {
    return {
      core: value,
      suffix: '',
    };
  }

  return {
    core: match[1]?.trim() || '',
    suffix: match[2] || '',
  };
}

function findPreferredSplitIndex(text: string): number {
  const upperBound = Math.min(TARGET_SEGMENT_MAX_LENGTH, text.length - 1);
  const lowerBound = Math.min(TARGET_SEGMENT_MIN_LENGTH, upperBound);

  for (let index = upperBound; index >= lowerBound; index -= 1) {
    const previousChar = text[index - 1];
    if (previousChar && CLAUSE_BREAK_PUNCTUATION.has(previousChar)) {
      return index;
    }
  }

  for (let index = upperBound; index >= lowerBound; index -= 1) {
    const prefix = text.slice(0, index);
    if (prefix.endsWith(' ')) {
      return index;
    }

    if (SOFT_SPLIT_HINTS.some((hint) => prefix.endsWith(hint))) {
      return index;
    }
  }

  return upperBound;
}

function splitLongClause(clause: string): string[] {
  const normalized = clause.trim();
  if (!normalized) {
    return [];
  }

  const { core, suffix } = splitTrailingPunctuation(normalized);
  const chunks: string[] = [];
  let remaining = core;

  while (measureSegmentLength(remaining) > TARGET_SEGMENT_MAX_LENGTH) {
    const splitIndex = findPreferredSplitIndex(remaining);
    const head = remaining.slice(0, splitIndex).trim();
    const tail = remaining.slice(splitIndex).trim();

    if (!head || !tail) {
      break;
    }

    chunks.push(head);
    remaining = tail;
  }

  const tailChunk = remaining.trim();
  if (tailChunk) {
    chunks.push(tailChunk);
  }

  if (suffix && chunks.length > 0) {
    chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}${suffix}`;
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

function mergeClausesIntoPracticeLines(clauses: string[]): string[] {
  const results: string[] = [];
  let current = '';

  clauses.forEach((rawClause) => {
    const clause = rawClause.trim();
    if (!clause) {
      return;
    }

    const segments =
      measureSegmentLength(clause) > HARD_SEGMENT_MAX_LENGTH
        ? splitLongClause(clause)
        : [clause];

    segments.forEach((segment) => {
      if (!current) {
        current = segment;
        return;
      }

      const combined = `${current}${segment}`.trim();
      if (
        measureSegmentLength(current) < TARGET_SEGMENT_MIN_LENGTH ||
        measureSegmentLength(combined) <= TARGET_SEGMENT_MAX_LENGTH
      ) {
        current = combined;
        return;
      }

      results.push(current);
      current = segment;
    });
  });

  if (current) {
    if (
      results.length > 0 &&
      measureSegmentLength(current) < TARGET_SEGMENT_MIN_LENGTH
    ) {
      results[results.length - 1] = `${results[results.length - 1]}${current}`;
    } else {
      results.push(current);
    }
  }

  return results
    .flatMap((segment) => (
      measureSegmentLength(segment) > HARD_SEGMENT_MAX_LENGTH
        ? splitLongClause(segment)
        : [segment]
    ))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function splitSentences(text: string): string[] {
  return mergeClausesIntoPracticeLines(splitIntoClauses(text));
}

function buildHeuristicSectionTitle(index: number, paragraph: string): string {
  const sentences = splitSentences(paragraph);
  const firstSentence = sentences[0] ?? paragraph;
  const prefix = firstSentence
    .replace(/[：:]/g, ' ')
    .replace(/[，。！？!?、]/g, ' ')
    .trim();
  return prefix ? truncateText(prefix, 16) : `第 ${index + 1} 段`;
}

function extractHotwordCandidates(text: string): string[] {
  const matches = text.match(/[\u4e00-\u9fffA-Za-z0-9·-]{2,18}/g) ?? [];
  const counter = new Map<string, number>();

  matches.forEach((match) => {
    const normalized = match.trim();
    if (!normalized) {
      return;
    }
    if (/^\d+$/.test(normalized)) {
      return;
    }
    if (COMMON_STOPWORDS.has(normalized)) {
      return;
    }
    if (/^[\u4e00-\u9fff]+$/.test(normalized) && normalized.length > 10) {
      return;
    }
    counter.set(normalized, (counter.get(normalized) ?? 0) + 1);
  });

  return [...counter.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return right[0].length - left[0].length;
    })
    .map(([value]) => value)
    .slice(0, 16);
}

function selectHighRiskPhrases(sentences: string[]): string[] {
  return dedupeStrings(
    sentences
      .filter((sentence) => sentence.length >= 10)
      .sort((left, right) => right.length - left.length),
    3,
  );
}

function selectFallbackPhrases(sentences: string[]): string[] {
  const ranked = [...sentences].sort((left, right) => left.length - right.length);
  return dedupeStrings(ranked, 2);
}

export function buildAsrHotwordEntries(
  values: Array<string | null | undefined>,
): PreparedExpressionAsrHotwordEntry[] {
  return dedupeStrings(values, 12).map((text) => ({
    text,
    lang: /[A-Za-z]/.test(text) && !/[\u4e00-\u9fff]/.test(text) ? 'en' : 'zh',
    weight: 2,
  }));
}

export function buildPreparedExpressionReferenceLines(
  template: PreparedExpressionTemplate,
  options?: {
    maxLines?: number;
    maxChars?: number;
  },
): string[] {
  const maxLines = Math.max(1, options?.maxLines ?? 60);
  const maxChars = Math.max(120, options?.maxChars ?? 3200);
  const results: string[] = [];
  let totalChars = 0;

  const candidates = template.sections.flatMap((section) => [
    section.anchorLine,
    ...section.practiceLines,
  ]);

  for (const candidate of dedupeStrings(candidates)) {
    const normalized = candidate.trim();
    if (!normalized) {
      continue;
    }

    const nextTotalChars = totalChars + normalized.length;
    if (results.length > 0 && nextTotalChars > maxChars) {
      break;
    }

    results.push(normalized);
    totalChars = nextTotalChars;

    if (results.length >= maxLines) {
      break;
    }
  }

  return results;
}

export function buildPreparedExpressionCorrectionPairs(
  values: Array<{
    target: string | null | undefined;
    heard: string | null | undefined;
  }>,
  options?: {
    maxPairs?: number;
    maxChars?: number;
  },
): PreparedExpressionCorrectionPair[] {
  const maxPairs = Math.max(1, options?.maxPairs ?? 60);
  const maxChars = Math.max(120, options?.maxChars ?? 3200);
  const aggregated = new Map<
    string,
    PreparedExpressionCorrectionPair & { order: number }
  >();

  values.forEach((value, index) => {
    const target = value.target?.trim();
    const heard = value.heard?.trim();
    if (!target || !heard || target === heard) {
      return;
    }

    const key = `${target}__${heard}`;
    const current = aggregated.get(key);
    if (current) {
      current.occurrenceCount += 1;
      return;
    }

    aggregated.set(key, {
      target,
      heard,
      occurrenceCount: 1,
      order: index,
    });
  });

  const ranked = [...aggregated.values()].sort((left, right) => {
    if (right.occurrenceCount !== left.occurrenceCount) {
      return right.occurrenceCount - left.occurrenceCount;
    }

    return left.order - right.order;
  });

  const results: PreparedExpressionCorrectionPair[] = [];
  let totalChars = 0;

  for (const item of ranked) {
    const pairChars = item.target.length + item.heard.length + 12;
    if (results.length > 0 && totalChars + pairChars > maxChars) {
      break;
    }

    results.push({
      target: item.target,
      heard: item.heard,
      occurrenceCount: item.occurrenceCount,
    });
    totalChars += pairChars;

    if (results.length >= maxPairs) {
      break;
    }
  }

  return results;
}

export function buildPreparedExpressionDraft(params: {
  title?: string | null;
  scene?: string | null;
  source?: string | null;
  content: string;
  id?: string | null;
  updatedAt?: string | null;
}): PreparedExpressionDraft {
  const content = normalizeContent(params.content);
  const title =
    params.title?.trim() ||
    truncateText(splitParagraphs(content)[0] ?? '重要表达准备稿', 24);
  const source = params.source?.trim() || 'workspace_preparation';

  return {
    id: params.id?.trim() || slugifyId(`${title}-${source}`),
    title,
    scene: params.scene?.trim() || null,
    source,
    content,
    updated_at: params.updatedAt?.trim() || new Date().toISOString(),
  };
}

export function buildPreparedExpressionTemplateFromDraft(
  draft: PreparedExpressionDraft,
): PreparedExpressionTemplate {
  const paragraphs = splitParagraphs(draft.content);
  const documentHotwords = extractHotwordCandidates(draft.content);
  const sections = paragraphs.slice(0, 12).map((paragraph, index) => {
    const sentences = splitSentences(paragraph);
    const anchorLine = sentences[0] ?? paragraph;
    const practiceLines = dedupeStrings(
      [
        anchorLine,
        ...sentences.slice(1, 3),
      ],
      3,
    );
    const highRiskPhrases = selectHighRiskPhrases(sentences);
    const fallbackPhrases = selectFallbackPhrases(sentences);
    const sectionHotwords = dedupeStrings(
      [
        ...extractHotwordCandidates(paragraph).slice(0, 4),
        ...documentHotwords.slice(0, 4),
      ],
      6,
    );

    return {
      id: slugifyId(`${draft.id}-${index + 1}-${buildHeuristicSectionTitle(index, paragraph)}`),
      title: buildHeuristicSectionTitle(index, paragraph),
      summary: truncateText(paragraph, 68),
      anchorLine,
      practiceLines,
      highRiskPhrases: highRiskPhrases.length > 0 ? highRiskPhrases : [anchorLine],
      fallbackPhrases: fallbackPhrases.length > 0 ? fallbackPhrases : [anchorLine],
      hotwords: sectionHotwords,
      basePriority: Math.max(1, 6 - index),
    } satisfies PreparedExpressionSectionTemplate;
  });

  return {
    id: draft.id,
    title: draft.title,
    summary:
      paragraphs.length > 0
        ? `已从这份准备稿里切出 ${sections.length} 个可练段落，先按锚点句和风险句逐段收紧，再继续压缩成上台前最小上下文。`
        : '这份准备稿已经保存，接下来可以继续做结构化压缩和 rehearsal 总结。',
    scene: draft.scene,
    source: draft.source,
    hotwords: dedupeStrings(
      [
        ...documentHotwords,
        ...sections.flatMap((section) => section.hotwords),
      ],
      12,
    ),
    highRiskPhrases: dedupeStrings(
      sections.flatMap((section) => section.highRiskPhrases),
      8,
    ),
    fallbackPhrases: dedupeStrings(
      sections.flatMap((section) => section.fallbackPhrases),
      6,
    ),
    sections,
  };
}

export function createPreparedExpressionAssetFromDraft(
  params: Parameters<typeof buildPreparedExpressionDraft>[0],
): PreparedExpressionAsset {
  const draft = buildPreparedExpressionDraft(params);
  return {
    draft,
    structured: buildPreparedExpressionTemplateFromDraft(draft),
    rehearsal_summary: null,
  };
}

export function createPreparedExpressionAssetFromTemplate(
  template: PreparedExpressionTemplate,
): PreparedExpressionAsset {
  return {
    draft: buildPreparedExpressionDraft({
      id: template.id,
      title: template.title,
      scene: template.scene,
      source: template.source,
      content: template.sections
        .flatMap((section) => [
          section.anchorLine,
          ...section.practiceLines,
        ])
        .join('\n'),
    }),
    structured: template,
    rehearsal_summary: null,
  };
}

function normalizeAsrHotwordEntry(value: unknown): PreparedExpressionAsrHotwordEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const text = readString(value, 'text');
  if (!text) {
    return null;
  }

  const lang = readString(value, 'lang') === 'en' ? 'en' : 'zh';
  const rawWeight = value.weight;
  const weight =
    typeof rawWeight === 'number' && Number.isInteger(rawWeight)
      ? Math.max(-6, Math.min(5, rawWeight))
      : 2;

  return {
    text,
    lang,
    weight,
  };
}

function normalizeCorrectionPair(value: unknown): PreparedExpressionCorrectionPair | null {
  if (!isRecord(value)) {
    return null;
  }

  const target = readString(value, 'target');
  const heard = readString(value, 'heard');
  if (!target || !heard || target === heard) {
    return null;
  }

  const rawOccurrenceCount = value.occurrenceCount ?? value.occurrence_count;
  const occurrenceCount =
    typeof rawOccurrenceCount === 'number' && Number.isFinite(rawOccurrenceCount)
      ? Math.max(1, Math.trunc(rawOccurrenceCount))
      : 1;

  return {
    target,
    heard,
    occurrenceCount,
  };
}

function normalizeSection(value: unknown, fallbackIndex: number): PreparedExpressionSectionTemplate | null {
  if (!isRecord(value)) {
    return null;
  }

  const anchorLine = readString(value, 'anchorLine') ?? readString(value, 'anchor_line');
  const title = readString(value, 'title');
  if (!anchorLine || !title) {
    return null;
  }

  return {
    id: readString(value, 'id') ?? `section-${fallbackIndex + 1}`,
    title,
    summary: readString(value, 'summary') ?? truncateText(anchorLine, 60),
    anchorLine,
    practiceLines: dedupeStrings([
      ...readStringList(value.practiceLines),
      ...readStringList(value.practice_lines),
      anchorLine,
    ], 3),
    highRiskPhrases: dedupeStrings([
      ...readStringList(value.highRiskPhrases),
      ...readStringList(value.high_risk_phrases),
      anchorLine,
    ], 4),
    fallbackPhrases: dedupeStrings([
      ...readStringList(value.fallbackPhrases),
      ...readStringList(value.fallback_phrases),
      anchorLine,
    ], 3),
    hotwords: dedupeStrings(readStringList(value.hotwords), 6),
    basePriority: typeof value.basePriority === 'number' ? Math.max(1, Math.min(6, value.basePriority)) : 3,
  };
}

export function normalizePreparedExpressionAsset(value: unknown): PreparedExpressionAsset | null {
  if (!isRecord(value)) {
    return null;
  }

  const draftValue = isRecord(value.draft) ? value.draft : undefined;
  const structuredValue = isRecord(value.structured) ? value.structured : undefined;

  const draftContent = readString(draftValue, 'content');
  if (!draftValue || !draftContent) {
    return null;
  }

  const draft = buildPreparedExpressionDraft({
    id: readString(draftValue, 'id'),
    title: readString(draftValue, 'title'),
    scene: readString(draftValue, 'scene'),
    source: readString(draftValue, 'source'),
    content: draftContent,
    updatedAt: readString(draftValue, 'updated_at'),
  });

  const structuredSections = Array.isArray(structuredValue?.sections)
    ? structuredValue.sections
        .map((section, index) => normalizeSection(section, index))
        .filter((section): section is PreparedExpressionSectionTemplate => Boolean(section))
    : [];

  const structured: PreparedExpressionTemplate =
    structuredValue && structuredSections.length > 0
      ? {
          id: readString(structuredValue, 'id') ?? draft.id,
          title: readString(structuredValue, 'title') ?? draft.title,
          summary: readString(structuredValue, 'summary') ?? buildPreparedExpressionTemplateFromDraft(draft).summary,
          scene: readString(structuredValue, 'scene') ?? draft.scene,
          source: readString(structuredValue, 'source') ?? draft.source,
          hotwords: dedupeStrings(readStringList(structuredValue.hotwords), 12),
          highRiskPhrases: dedupeStrings(
            readStringList(structuredValue.highRiskPhrases).concat(
              readStringList(structuredValue.high_risk_phrases),
            ),
            8,
          ),
          fallbackPhrases: dedupeStrings(
            readStringList(structuredValue.fallbackPhrases).concat(
              readStringList(structuredValue.fallback_phrases),
            ),
            6,
          ),
          sections: structuredSections,
        }
      : buildPreparedExpressionTemplateFromDraft(draft);

  const rehearsalSummaryValue = isRecord(value.rehearsal_summary)
    ? value.rehearsal_summary
    : undefined;

  const rehearsalSummary =
    rehearsalSummaryValue && readString(rehearsalSummaryValue, 'summary')
      ? {
          summary: readString(rehearsalSummaryValue, 'summary') ?? '',
          hotwords: dedupeStrings(readStringList(rehearsalSummaryValue.hotwords), 12),
          recurringErrors: dedupeStrings(
            readStringList(rehearsalSummaryValue.recurringErrors).concat(
              readStringList(rehearsalSummaryValue.recurring_errors),
            ),
            8,
          ),
          pronunciationPatterns: dedupeStrings(
            readStringList(rehearsalSummaryValue.pronunciationPatterns).concat(
              readStringList(rehearsalSummaryValue.pronunciation_patterns),
            ),
            8,
          ),
          supportStrategies: dedupeStrings(
            readStringList(rehearsalSummaryValue.supportStrategies).concat(
              readStringList(rehearsalSummaryValue.support_strategies),
            ),
            6,
          ),
          fallbackPhrases: dedupeStrings(
            readStringList(rehearsalSummaryValue.fallbackPhrases).concat(
              readStringList(rehearsalSummaryValue.fallback_phrases),
            ),
            6,
          ),
          nextFocus: dedupeStrings(
            readStringList(rehearsalSummaryValue.nextFocus).concat(
              readStringList(rehearsalSummaryValue.next_focus),
            ),
            6,
          ),
          asrHotwordEntries: Array.isArray(rehearsalSummaryValue.asrHotwordEntries)
            ? rehearsalSummaryValue.asrHotwordEntries
                .map((entry) => normalizeAsrHotwordEntry(entry))
                .filter((entry): entry is PreparedExpressionAsrHotwordEntry => Boolean(entry))
            : Array.isArray(rehearsalSummaryValue.asr_hotword_entries)
              ? rehearsalSummaryValue.asr_hotword_entries
                  .map((entry) => normalizeAsrHotwordEntry(entry))
                  .filter((entry): entry is PreparedExpressionAsrHotwordEntry => Boolean(entry))
              : [],
          referenceLines: dedupeStrings(
            readStringList(rehearsalSummaryValue.referenceLines).concat(
              readStringList(rehearsalSummaryValue.reference_lines),
            ),
            60,
          ),
          trainingPairs: Array.isArray(rehearsalSummaryValue.trainingPairs)
            ? rehearsalSummaryValue.trainingPairs
                .map((pair) => normalizeCorrectionPair(pair))
                .filter((pair): pair is PreparedExpressionCorrectionPair => Boolean(pair))
            : Array.isArray(rehearsalSummaryValue.training_pairs)
              ? rehearsalSummaryValue.training_pairs
                  .map((pair) => normalizeCorrectionPair(pair))
                  .filter((pair): pair is PreparedExpressionCorrectionPair => Boolean(pair))
              : [],
          basedOnTrainingCount:
            typeof rehearsalSummaryValue.basedOnTrainingCount === 'number'
              ? rehearsalSummaryValue.basedOnTrainingCount
              : typeof rehearsalSummaryValue.based_on_training_count === 'number'
                ? rehearsalSummaryValue.based_on_training_count
                : 0,
          model: readString(rehearsalSummaryValue, 'model') ?? 'heuristic',
          updated_at: readString(rehearsalSummaryValue, 'updated_at') ?? new Date().toISOString(),
        }
      : null;

  const normalizedRehearsalSummary =
    rehearsalSummary && rehearsalSummary.basedOnTrainingCount > 0
      ? {
          ...rehearsalSummary,
          referenceLines:
            rehearsalSummary.referenceLines.length > 0
              ? rehearsalSummary.referenceLines
              : buildPreparedExpressionReferenceLines(structured, {
                  maxLines: 60,
                  maxChars: 3200,
                }),
          trainingPairs: buildPreparedExpressionCorrectionPairs(
            rehearsalSummary.trainingPairs.map((pair) => ({
              target: pair.target,
              heard: pair.heard,
            })),
            {
              maxPairs: 60,
              maxChars: 3200,
            },
          ),
        }
      : null;

  return {
    draft,
    structured: {
      ...structured,
      hotwords: dedupeStrings(
        [
          ...structured.hotwords,
          ...structured.sections.flatMap((section) => section.hotwords),
        ],
        12,
      ),
      highRiskPhrases: dedupeStrings(
        [
          ...structured.highRiskPhrases,
          ...structured.sections.flatMap((section) => section.highRiskPhrases),
        ],
        8,
      ),
      fallbackPhrases: dedupeStrings(
        [
          ...structured.fallbackPhrases,
          ...structured.sections.flatMap((section) => section.fallbackPhrases),
        ],
        6,
      ),
    },
    rehearsal_summary: normalizedRehearsalSummary,
  };
}
