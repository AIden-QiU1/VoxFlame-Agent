const FUNCTIONAL_OPENING = /^(?:请|麻烦|帮我|我想|我需要|我要|我可以|我能|能不能|能否|请问|哪里|怎么|怎么办|告诉我|给我|带我|等一下|再说一次|不要|别(?:再|这样|这么|动|走|碰|说|急|怕))/u
const FUNCTIONAL_NEED = /^我(?:不舒服|听不清|没听清|看不清|不知道|找不到|无法|不能|不想|不需要|需要|想要|想去|想吃|想喝|想买|想找|想问|想说)/u
const DIALOGUE_ENDING = /[吗呢？]$/u
const FIRST_PERSON_OR_REQUEST = /^(我|我们|请|麻烦|你|您)/u
const HIGH_VALUE_SCENES = /医院|医生|护士|车站|地铁|公交|付款|地址|电话|家人|朋友|老师|同学|工作|会议/u
const LOW_VALUE_READING_TOPICS = /阿尔卑斯|希腊|欧洲|古代|皇帝|战争|诗人|哲学/u

const MAINLAND_USAGE_REVIEW_PATTERNS = [
  /(?:沿|穿|看|拿|跟|随|光)著/u,
  /裡/u,
  /妳/u,
  /計程車|公車|捷運|網路/u,
  /资料夹|设定为共用|乳酪|夸脱|喔/u,
]

const SENSITIVE_CONTENT_REVIEW = /癌|情妇|屁股|傻瓜|愚蠢|骂|酒|毒|乳房|性|死亡|宗教/u

export function proposedTaskForSentence(text) {
  return FUNCTIONAL_OPENING.test(text) || FUNCTIONAL_NEED.test(text) || DIALOGUE_ENDING.test(text)
    ? 'functional_speech'
    : 'connected_reading'
}

export function productScoreForSentence(text, task = proposedTaskForSentence(text)) {
  let score = task === 'functional_speech' ? 18 : 0
  if (FIRST_PERSON_OR_REQUEST.test(text)) score += 6
  if (HIGH_VALUE_SCENES.test(text)) score += 4
  if (LOW_VALUE_READING_TOPICS.test(text)) score -= 8
  return score
}

export function reviewWarningsForSentence(text) {
  const warnings = []
  if (MAINLAND_USAGE_REVIEW_PATTERNS.some((pattern) => pattern.test(text))) {
    warnings.push('mainland_modern_mandarin_usage_review')
  }
  if (SENSITIVE_CONTENT_REVIEW.test(text)) {
    warnings.push('sensitive_content_review')
  }
  return warnings
}

export function pendingReviewState() {
  return {
    linguistic_review: 'pending',
    naturalness_review: 'pending',
    safety_review: 'pending',
    license_review: 'pending',
    task_review: 'pending',
  }
}
