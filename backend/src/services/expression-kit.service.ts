export type WorkspaceSceneId =
  | 'interview'
  | 'workplace'
  | 'stranger'
  | 'medical'
  | 'caregiver'
  | 'emergency';

export interface RankableExpressionKitSuggestion {
  text: string;
  category: string;
  note?: string;
  priority: number;
}

export interface CommunicationPreferencesLike {
  opening_phrase?: string;
  pace_hint?: string;
  repair_phrase?: string;
}

interface SceneRankingProfile {
  categories: string[];
  keywords: string[];
}

const SCENE_RANKING_PROFILES: Record<WorkspaceSceneId, SceneRankingProfile> = {
  interview: {
    categories: ['opening', 'repair', 'profession', 'greeting'],
    keywords: ['面试', '回答', '能力', '介绍', '评委', '工作'],
  },
  workplace: {
    categories: ['repair', 'profession', 'custom', 'need'],
    keywords: ['工作', '方案', '同事', '会议', '风险', '决定'],
  },
  stranger: {
    categories: ['greeting', 'need', 'transport', 'repair'],
    keywords: ['帮', '请', '问路', '沟通', '时间', '直接'],
  },
  medical: {
    categories: ['medical', 'need', 'repair'],
    keywords: ['医生', '护士', '疼', '症状', '处理', '解释'],
  },
  caregiver: {
    categories: ['family', 'daily', 'need', 'repair'],
    keywords: ['家人', '照护', '休息', '陪', '联系'],
  },
  emergency: {
    categories: ['emergency', 'need', 'repair'],
    keywords: ['马上', '帮助', '急救', '报警', '安全'],
  },
};

function includesKeyword(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function buildSceneScore(
  phrase: RankableExpressionKitSuggestion,
  sceneId: WorkspaceSceneId | undefined,
  preferences?: CommunicationPreferencesLike,
): number {
  if (!sceneId) {
    return phrase.priority;
  }

  const profile = SCENE_RANKING_PROFILES[sceneId];
  const haystack = `${phrase.text} ${phrase.note ?? ''}`;
  let score = phrase.priority;

  if (profile.categories.includes(phrase.category)) {
    score += 28;
  }

  if (includesKeyword(haystack, profile.keywords)) {
    score += 22;
  }

  if (preferences?.opening_phrase && phrase.text === preferences.opening_phrase) {
    score += sceneId === 'interview' || sceneId === 'workplace' || sceneId === 'stranger' ? 24 : 16;
  }

  if (preferences?.repair_phrase && phrase.text === preferences.repair_phrase) {
    score += 18;
  }

  if (preferences?.pace_hint && phrase.text === preferences.pace_hint) {
    score += 14;
  }

  return score;
}

export function normalizeWorkspaceSceneId(value: unknown): WorkspaceSceneId | undefined {
  if (
    value === 'interview' ||
    value === 'workplace' ||
    value === 'stranger' ||
    value === 'medical' ||
    value === 'caregiver' ||
    value === 'emergency'
  ) {
    return value;
  }

  return undefined;
}

export function rankExpressionKitSuggestions<T extends RankableExpressionKitSuggestion>(
  suggestions: T[],
  sceneId: WorkspaceSceneId | undefined,
  preferences?: CommunicationPreferencesLike,
): T[] {
  return [...suggestions].sort((left, right) => {
    const rightScore = buildSceneScore(right, sceneId, preferences);
    const leftScore = buildSceneScore(left, sceneId, preferences);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return right.priority - left.priority;
  });
}
