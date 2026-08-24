const COMMERCIAL_NOISE = /学习包|课程包|培训包|资料包|题库|报名|直播课堂|客户端下载|订阅/u
const HIGH_RISK_CONTENT = /色情|性交|强奸|猥亵|嫖娼|卖淫|裸体|自杀|杀人|尸体|绑架|毒品|赌博|枪支|炸弹|宗教|癌症|处方|诊断|法律建议|奴役|排尿|殡|娼/u
const REPEATED_TEMPLATE = /([我你他她它这那])\1|怎么怎么|能能|就是是|有有|到到|今今天|都都知道|老老客户|能够能够/u
const SIMPLIFIED_ONLY = /^[\p{Script=Han}，。！？、；：“”‘’（）,.!?;:()\s]+$/u
const KNOWN_LOW_QUALITY = new Set([
  '东京中城绿意盎然!',
  '差点就酿成怕的火灾了。',
  '她比较鲁莽的相信了他。',
  '水流的强力把桥给冲垮了。',
  '想找个地缝钻进去。',
  '我窘得想找个洞钻进去。',
  '嫉妒是骨中的朽烂。',
  '你缺乏冲劲。',
  '切磋一下,敢吗?',
  '一磅等于十六盎司。',
  '不要这么吹毛求疵。',
  '我们决不能把它两个混淆。',
  '你右边袜子倒转穿了。',
])

function hasRequiredSource(item) {
  if (typeof item.source !== 'string' || item.source.trim() === '') return false
  if (item.source === 'Tatoeba' && !Number.isInteger(item.source_sentence_id)) return false
  if (item.source.includes('CC-CEDICT') && (!item.source_pinyin || !item.target_carriers?.length)) return false
  return true
}

function normalizeTargetToken(value) {
  const match = String(value ?? '').trim().toLowerCase().match(/^(.+?)([0-5])$/u)
  if (!match) return String(value ?? '').trim().toLowerCase()
  return `${match[1]}${match[2] === '5' ? '0' : match[2]}`
}

function hasTargetReadingEvidence(item, target) {
  const wanted = normalizeTargetToken(target)
  const readings = [item?.source_pinyin, item?.source_sentence_pinyin, ...(item?.target_carriers ?? []).map((carrier) => carrier?.source_pinyin)]
    .flatMap((value) => String(value ?? '').trim().toLowerCase().split(/\s+/u))
    .filter(Boolean)
    .map(normalizeTargetToken)
  return readings.includes(wanted)
}

export function validateMandarinRecordingCandidate(item, { existingTexts = new Set() } = {}) {
  const errors = []
  const text = String(item?.text ?? '').normalize('NFKC').trim()
  const hanLength = [...text.match(/\p{Script=Han}/gu) ?? []].length
  if (!item?.id) errors.push('missing_id')
  if (!text) errors.push('empty_text')
  if (!hasRequiredSource(item)) errors.push('untraceable_source')
  if (!Array.isArray(item?.coverage_targets) || item.coverage_targets.length === 0) errors.push('missing_coverage_targets')
  if (!item?.target || !item.coverage_targets?.includes(item.target)) errors.push('target_not_mapped')
  for (const target of item?.coverage_targets ?? []) {
    if (!hasTargetReadingEvidence(item, target)) errors.push(`target_reading_evidence_missing:${target}`)
  }
  if (item?.prompt_type === 'short_sentence' && (hanLength < 7 || hanLength > 18)) errors.push('sentence_length_out_of_range')
  if (item?.prompt_type === 'word' && (hanLength < 2 || hanLength > 6)) errors.push('word_length_out_of_range')
  if (!SIMPLIFIED_ONLY.test(text)) errors.push('non_simplified_or_unsupported_character')
  if (COMMERCIAL_NOISE.test(text)) errors.push('commercial_noise')
  if (HIGH_RISK_CONTENT.test(text)) errors.push('high_risk_content')
  if ((item?.prompt_type === 'short_sentence' && REPEATED_TEMPLATE.test(text)) || KNOWN_LOW_QUALITY.has(text)) errors.push('low_quality_or_repeated_template')
  if (existingTexts.has(text)) errors.push('duplicate_existing_prompt')
  return { valid: errors.length === 0, errors }
}

export const MANDARIN_RECORDING_GATE_RULES = {
  sentence_han_length: [7, 18],
  word_han_length: [2, 6],
  source_required: true,
  whole_word_or_sentence_pinyin_required: true,
  asr_not_a_gate: true,
}
