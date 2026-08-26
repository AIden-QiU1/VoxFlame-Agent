import { annotateMandarinText, isBlockedGapCandidate } from './mandarin-coverage-core.mjs'
import { containsBlockedDefaultCorpusContent } from './mandarin-corpus-content-policy.mjs'
import { productScoreForSentence, proposedTaskForSentence, reviewWarningsForSentence } from './mandarin-gap-candidate-core.mjs'

const BLOCKED_WORD_FLAGS = new Set([
  'proper_name',
  'variant',
  'archaic_or_literary',
  'dialect_or_regional',
  'onomatopoeia_or_interjection',
  'single_character',
])

const SPECIALIST_ONLY_CARRIER_TARGETS = new Set([
  'ai2',
  'an3',
  'chan2',
  'chen3',
  'chuan3',
  'chuo4',
  'e3',
  'fen2',
  'feng3',
  'ga4',
  'guai1',
  'hang4',
  'huo1',
  'jiong3',
  'miu4',
  'nao2',
  'nian3',
  'niao4',
  'niu1',
  'nu2',
  'nu4',
  'qiang4',
  'sao1',
  'sha2',
  'tui2',
  'ye1',
  'yo1',
  'za3',
])

/**
 * Targets without a low-burden default carrier still need an explicit route.
 * This metadata is a review protocol, not a prompt generator: it keeps the
 * phonology ledger complete while preventing the recorder from forcing a
 * sensitive or non-standard lexical item onto a user.
 */
export const SPECIALIST_TARGET_ROUTES = Object.freeze({
  ai2: { reason_category: 'medical_content', allowed_evidence: ['neutral_medical_term_confirmed_by_linguist', 'speaker_opt_in'], default_recording_policy: 'never_default_record', next_action: 'confirm_neutral_carrier_or_hold_edge_only' },
  an3: { reason_category: 'dialect_or_specialized_lexicon', allowed_evidence: ['mainland_standard_usage_source', 'linguist_pronunciation_confirmation'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_standard_carrier_or_hold_edge_only' },
  chan2: { reason_category: 'religious_or_rare_lexicon', allowed_evidence: ['modern_neutral_word_attestation', 'linguist_pronunciation_confirmation'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_modern_neutral_carrier_or_hold_edge_only' },
  chen3: { reason_category: 'stigmatizing_or_low_frequency_lexicon', allowed_evidence: ['modern_usage_source', 'linguist_user_burden_review'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'seek_neutral_carrier_or_hold_edge_only' },
  chuan3: { reason_category: 'medical_or_bodily_context', allowed_evidence: ['neutral_health_context', 'speaker_opt_in'], default_recording_policy: 'never_default_record', next_action: 'confirm_non_sensitive_carrier_or_hold_edge_only' },
  chuo4: { reason_category: 'education_or_distress_context', allowed_evidence: ['neutral_modern_word_attestation', 'linguist_user_burden_review'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_neutral_carrier_or_hold_edge_only' },
  e3: { reason_category: 'bodily_sensation_context', allowed_evidence: ['neutral_sensory_context', 'speaker_opt_in'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_neutral_carrier_or_hold_edge_only' },
  fen2: { reason_category: 'death_or_grief_context', allowed_evidence: ['neutral_historical_or_natural_context', 'speaker_opt_in'], default_recording_policy: 'never_default_record', next_action: 'confirm_non_grief_carrier_or_hold_edge_only' },
  feng3: { reason_category: 'ridicule_or_person_directed_context', allowed_evidence: ['non_person_directed_modern_usage', 'linguist_user_burden_review'], default_recording_policy: 'never_default_record', next_action: 'confirm_non_directed_carrier_or_hold_edge_only' },
  ga4: { reason_category: 'slang_or_regional_usage', allowed_evidence: ['mainland_standard_usage_source', 'linguist_register_confirmation'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_register_and_carrier_or_hold_edge_only' },
  guai1: { reason_category: 'lexical_attestation_scarcity', allowed_evidence: ['modern_neutral_word_attestation', 'linguist_pronunciation_confirmation'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_neutral_carrier_or_hold_edge_only' },
  hang4: { reason_category: 'archaic_or_idiomatic_lexicon', allowed_evidence: ['modern_usage_source', 'linguist_register_confirmation'], default_recording_policy: 'never_default_record', next_action: 'confirm_modern_carrier_or_hold_edge_only' },
  huo1: { reason_category: 'rare_or_regional_lexicon', allowed_evidence: ['mainland_standard_usage_source', 'linguist_pronunciation_confirmation'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_standard_carrier_or_hold_edge_only' },
  jiong3: { reason_category: 'embarrassment_or_user_burden', allowed_evidence: ['neutral_object_or_scene_context', 'linguist_user_burden_review'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_non_person_directed_carrier_or_hold_edge_only' },
  miu4: { reason_category: 'negative_evaluation_context', allowed_evidence: ['neutral_technical_context', 'linguist_user_burden_review'], default_recording_policy: 'never_default_record', next_action: 'confirm_non_person_directed_carrier_or_hold_edge_only' },
  nao2: { reason_category: 'rare_or_action_context', allowed_evidence: ['modern_neutral_word_attestation', 'linguist_pronunciation_confirmation'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_neutral_carrier_or_hold_edge_only' },
  nian3: { reason_category: 'accident_or_force_context', allowed_evidence: ['neutral_object_process_context', 'speaker_opt_in'], default_recording_policy: 'never_default_record', next_action: 'confirm_non_accident_carrier_or_hold_edge_only' },
  niao4: { reason_category: 'bodily_privacy_or_medical_content', allowed_evidence: ['neutral_health_context', 'speaker_opt_in'], default_recording_policy: 'never_default_record', next_action: 'confirm_privacy_safe_carrier_or_hold_edge_only' },
  niu1: { reason_category: 'gendered_or_person_directed_context', allowed_evidence: ['neutral_non_person_usage', 'linguist_user_burden_review'], default_recording_policy: 'never_default_record', next_action: 'confirm_non_gendered_carrier_or_hold_edge_only' },
  nu2: { reason_category: 'slavery_or_historical_harm_context', allowed_evidence: ['neutral_historical_context', 'speaker_opt_in'], default_recording_policy: 'never_default_record', next_action: 'confirm_safe_historical_carrier_or_hold_edge_only' },
  nu4: { reason_category: 'anger_or_conflict_context', allowed_evidence: ['neutral_emotion_description', 'speaker_opt_in'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_non_directed_carrier_or_hold_edge_only' },
  qiang4: { reason_category: 'choking_or_conflict_context', allowed_evidence: ['neutral_object_context', 'speaker_opt_in'], default_recording_policy: 'never_default_record', next_action: 'confirm_non_bodily_carrier_or_hold_edge_only' },
  sao1: { reason_category: 'harassment_or_sexualized_context', allowed_evidence: ['neutral_object_context', 'speaker_opt_in'], default_recording_policy: 'never_default_record', next_action: 'confirm_non_sensitive_carrier_or_hold_edge_only' },
  sha2: { reason_category: 'dialect_scope', allowed_evidence: ['mainland_standard_usage_source', 'linguist_register_confirmation'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_scope_as_standard_or_hold_edge_only' },
  tui2: { reason_category: 'negative_or_literary_context', allowed_evidence: ['modern_neutral_word_attestation', 'linguist_register_confirmation'], default_recording_policy: 'never_default_record', next_action: 'confirm_modern_neutral_carrier_or_hold_edge_only' },
  ye1: { reason_category: 'religious_or_proper_name_context', allowed_evidence: ['neutral_common_word_attestation', 'linguist_pronunciation_confirmation'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_common_word_carrier_or_hold_edge_only' },
  yo1: { reason_category: 'interjection_or_paralinguistic_context', allowed_evidence: ['modern_dialogue_attestation', 'linguist_prosody_confirmation'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_dialogue_task_or_hold_edge_only' },
  za3: { reason_category: 'dialect_scope', allowed_evidence: ['mainland_standard_usage_source', 'linguist_register_confirmation'], default_recording_policy: 'specialist_pack_only_after_confirmation', next_action: 'confirm_scope_as_standard_or_hold_edge_only' },
})

const HIGH_BURDEN_DEFAULT_CONTENT = /枪|炸弹|爆炸|强奸|自杀|杀人|尸体|死亡|去世|坟墓|地狱|鬼魂|癌|色情|性交|毒品|赌博|情妇|妓女|傻瓜|笨蛋|胆小鬼|混蛋|胖子|残废|罪犯|小偷|抢劫|绑架|醉醺醺|奴隶|贫穷|吝啬|命运多舛|咆哮|罪魁祸首|勃然大怒|胎盘|分泌物|反科学|讥讽|侮辱/u
const BODY_OR_MEDICAL_BURDEN = /尿床|尿布|尿液|排尿|糖尿病|胆固醇|乳糖不耐|乳牙|乳牛|母乳|肥胖|减肥|长胖|发胖|体重|疤痕|流血|沾满了血|哮喘|水泡|胳膊动不了|起鸡皮疙瘩|颤抖|发抖|喘不过气|气喘吁吁|生病|除颤器|葡萄糖|解剖|酸痛|疙瘩|脚趾/u
const ACCIDENT_OR_CONFLICT_BURDEN = /崩塌|碾过|砸伤|纵火|强盗|窃贼|闯入|残骸|瓦砾|谋杀|战争|军队|游击队|殖民地|驾崩|丧家之犬|危害人类罪|奴役制|遭到闯入|火给灭|拔掉|拔除|辍学|绷带|珠宝店/u
const PERSON_DIRECTED_BURDEN = /你(?:相当粗鲁|纯粹|个小屁孩|胆子很大|在耍脾气|不好惹)|我不是称职|他(?:胖乎乎|出奇的帅气|是一个驼背|笨手笨脚|胆小如鼠)|那位帅哥|隔壁帅哥|外国佬|泡妞|咪咪|蜜大腿|脱了|马屁|跟屁虫|蛮横无礼|羞辱你|激怒了|怒气|恼怒|怒火|常常发怒|愤怒|怒不可遏|怒吼|粗鲁|粗俗|胆小|宠坏|猪窝|舔鞋|洁癖|荒谬|狗咬狗|图谋不轨|抹黑|神魂颠倒|牢骚|鄙视|仆人|放屁|沾沾自喜|证明你不/u
const SENSITIVE_IDEOLOGY_OR_RELIGION = /宗教|灵魂|教堂|斋戒月|伊斯兰|占星|菩萨|农奴|奴役|反科学|殖民|皇上|国王|朕|政治家|犯罪|警方/u
const DEFAULT_PROPER_NAME_BURDEN = /汤姆|玛丽|萨米|约翰|彼得|杰克|爱丽丝|鲍勃|亨利|安妮|莎莉|齐里|里玛|惠子|富子|加博|杰西|达芬奇|日本|美国|伦敦|纽约|马其顿|葡萄牙|亚利桑那|凤凰城|墨西哥/u
const NON_MAINLAND_OR_TRANSLATION_BURDEN = /梦想著|闲著|笼罩著|程式设计师|线上查看|洽商|脚踏车|比萨|批萨|夸脱|瓦斯|开辟新天地|开拓你的思想|其乐无穷|轰轰烈烈地在一起|蕴含浑厚实力|一股意识流|事实与谬误的混合体|开车送你到家为止比较妥当/u
const ADULT_OR_PRIVATE_CONTENT = /炮友|泡妞|内裤|短衬裤|脱下衬衫|请把衬衫脱|吻|性爱/u
const DEFAULT_RECORDING_CONTEXT_BURDEN = /尴尬|骚扰|爆胎|愚笨|女婿|叽哩咕噜|起酥油|鹿肉|钻石恒久远|假发|老牛吃嫩草/u
const HIGH_BURDEN_CARRIER_CONTENT = /挨|鸡掰|假掰|牛掰|殡|膑刑|髌骨|娼|伥鬼|参禅|谗|拜忏|忏悔|残喘|喘气|喘息|颤抖|闯祸|啜泣|坟|焚尸|嘲讽|反讽|讽刺|沆瀣|丢魂|犯浑|勾魂|孤魂|还魂|捞女|鄙吝|淋病|淋球菌|蹂躏|撸管|婚驴|叫驴|荒谬|泡妞|洋妞|奴|暴怒|嗔怒|触怒|大怒|动怒|发怒|怒潮|尿|肥胖|发胖|胖人|胖揍|解剖|剖腹|疯犬|军犬|报丧|奔丧|出丧|吊丧|发丧|服丧|父丧|居丧|哭丧|母丧|发骚|牢骚|撩骚|聊骚|闷骚|搔扰|骚包|骚话|骚货|颓废|颓败|绑扎|结扎|腌臜|拶刑|拶指|瘛疭|放纵|娇纵|骄纵|女婿/u
const ALLOWED_SENTENCE_CHARACTERS = /^[\p{Script=Han}，。！？；：、…—“”‘’（）《》\s]+$/u

function hanLength(text) {
  return Array.from(String(text).match(/\p{Script=Han}/gu) ?? []).length
}

function normalizedText(text) {
  return String(text).normalize('NFKC').trim()
}

function normalizedHanText(text) {
  return normalizedText(text).replace(/[^\p{Script=Han}]/gu, '')
}

export function pendingReinforcementReviews() {
  return {
    linguistic: 'pending',
    naturalness: 'pending',
    user_burden: 'pending',
    safety: 'pending',
    license: 'pending',
    product: 'pending',
  }
}

export function isSafeReinforcementCarrier(candidate) {
  const length = hanLength(candidate?.simplified)
  return length >= 2
    && length <= 5
    && !candidate.flags.some((flag) => BLOCKED_WORD_FLAGS.has(flag))
    && !containsBlockedDefaultCorpusContent(candidate.simplified)
    && !HIGH_BURDEN_DEFAULT_CONTENT.test(candidate.simplified)
    && !BODY_OR_MEDICAL_BURDEN.test(candidate.simplified)
    && !ACCIDENT_OR_CONFLICT_BURDEN.test(candidate.simplified)
    && !PERSON_DIRECTED_BURDEN.test(candidate.simplified)
    && !SENSITIVE_IDEOLOGY_OR_RELIGION.test(candidate.simplified)
    && !ADULT_OR_PRIVATE_CONTENT.test(candidate.simplified)
    && !HIGH_BURDEN_CARRIER_CONTENT.test(candidate.simplified)
}

export function isSafeReinforcementSentence(text) {
  const normalized = normalizedText(text)
  const length = hanLength(normalized)
  return length >= 5
    && length <= 16
    && ALLOWED_SENTENCE_CHARACTERS.test(normalized)
    && !containsBlockedDefaultCorpusContent(normalized)
    && !HIGH_BURDEN_DEFAULT_CONTENT.test(normalized)
    && !BODY_OR_MEDICAL_BURDEN.test(normalized)
    && !ACCIDENT_OR_CONFLICT_BURDEN.test(normalized)
    && !PERSON_DIRECTED_BURDEN.test(normalized)
    && !SENSITIVE_IDEOLOGY_OR_RELIGION.test(normalized)
    && !DEFAULT_PROPER_NAME_BURDEN.test(normalized)
    && !NON_MAINLAND_OR_TRANSLATION_BURDEN.test(normalized)
    && !ADULT_OR_PRIVATE_CONTENT.test(normalized)
    && !DEFAULT_RECORDING_CONTEXT_BURDEN.test(normalized)
    && !isBlockedGapCandidate(normalized)
    && reviewWarningsForSentence(normalized).length === 0
}

export function buildCarrierIndex(wordRows, targetIds) {
  const byWord = new Map()
  const safeWordsByTarget = new Map()
  for (const target of targetIds) {
    const safeWords = (SPECIALIST_ONLY_CARRIER_TARGETS.has(target) ? [] : (wordRows.get(target) ?? []))
      .filter(isSafeReinforcementCarrier)
      .sort((left, right) => (
        (right.external_sentence_occurrences ?? 0) - (left.external_sentence_occurrences ?? 0)
          || hanLength(left.simplified) - hanLength(right.simplified)
          || left.simplified.localeCompare(right.simplified, 'zh-CN')
      ))
    safeWordsByTarget.set(target, safeWords)
    for (const word of safeWords) {
      const rows = byWord.get(word.simplified) ?? []
      rows.push({
        target,
        text: word.simplified,
        source_pinyin: word.pinyin,
        source: 'CC-CEDICT whole-word reading',
      })
      byWord.set(word.simplified, rows)
    }
  }
  return { byWord, safeWordsByTarget }
}

function hanNgrams(text, maximumLength) {
  const characters = Array.from(normalizedHanText(text))
  const values = new Set()
  for (let start = 0; start < characters.length; start += 1) {
    for (let length = 2; length <= maximumLength && start + length <= characters.length; length += 1) {
      values.add(characters.slice(start, start + length).join(''))
    }
  }
  return values
}

export function candidateFromSentence({ id, text, contributor, carrierIndex, currentTextSet }) {
  const normalized = normalizedText(text)
  if (!isSafeReinforcementSentence(normalized) || currentTextSet.has(normalized)) return null
  const matchedCarrierRows = [...hanNgrams(normalized, 5)]
    .flatMap((word) => carrierIndex.get(word) ?? [])
    .filter((carrier, index, rows) => rows.findIndex((item) => (
      item.target === carrier.target
        && item.text === carrier.text
        && item.source_pinyin === carrier.source_pinyin
    )) === index)
  if (matchedCarrierRows.length === 0) return null

  const actualTargets = new Set(annotateMandarinText(normalized).syllables.map((syllable) => syllable.syllableTone))
  const targetCarriers = matchedCarrierRows.filter((carrier) => actualTargets.has(carrier.target))
  if (targetCarriers.length === 0) return null
  const taskId = proposedTaskForSentence(normalized)

  return {
    id: `reinforcement-tatoeba-${id}`,
    type: 'short_sentence',
    text: normalized,
    coverage_targets: [...new Set(targetCarriers.map((carrier) => carrier.target))].sort(),
    source: 'Tatoeba',
    source_sentence_id: Number(id),
    contributor,
    source_url: `https://tatoeba.org/en/sentences/show/${id}`,
    proposed_task_id: 'targeted_gap',
    discourse_style: taskId,
    target_carriers: targetCarriers.map(({ target: _target, ...carrier }) => carrier),
    product_score: productScoreForSentence(normalized, taskId) - Math.max(0, hanLength(normalized) - 10),
    reviews: pendingReinforcementReviews(),
  }
}

function carrierRealizesTarget(carrierPinyin, target) {
  return carrierPinyin.split(/\s+/u).some((token) => {
    const match = token.replaceAll('u:', 'ü').match(/^([A-Za-züê]+)([1-5])$/iu)
    if (!match) return false
    const tone = match[2] === '5' ? '0' : match[2]
    return `${match[1].toLowerCase()}${tone}` === target
  })
}

export function candidateFromAuthoredEntry({ entry, safeWordsByTarget, currentTextSet }) {
  const text = normalizedText(entry?.text)
  const target = String(entry?.target ?? '')
  const carrier = normalizedText(entry?.carrier)
  const carrierPinyin = normalizedText(entry?.carrier_pinyin)
  if (!/^auth-[a-zü]+\d-\d{2}$/u.test(entry?.id ?? '')) throw new Error(`invalid authored candidate id: ${entry?.id ?? ''}`)
  if (!isSafeReinforcementSentence(text)) throw new Error(`${entry.id} is not a safe reinforcement sentence`)
  if (currentTextSet.has(text)) throw new Error(`${entry.id} duplicates an active prompt`)
  if (!carrier || !text.includes(carrier)) throw new Error(`${entry.id} carrier must occur continuously in text`)
  if (!carrierRealizesTarget(carrierPinyin, target)) throw new Error(`${entry.id} carrier pinyin does not realize ${target}`)
  const safeCarrier = (safeWordsByTarget.get(target) ?? []).find((word) => (
    word.simplified === carrier && word.pinyin === carrierPinyin
  ))
  if (!safeCarrier) throw new Error(`${entry.id} carrier is not an approved low-burden whole-word reading for ${target}`)

  return {
    id: `reinforcement-${entry.id}`,
    type: 'short_sentence',
    text,
    coverage_targets: [target],
    source: 'VoxFlame authored candidate',
    source_sentence_id: null,
    contributor: null,
    source_url: null,
    proposed_task_id: 'targeted_gap',
    discourse_style: proposedTaskForSentence(text),
    target_carriers: [{
      text: carrier,
      source_pinyin: carrierPinyin,
      source: 'CC-CEDICT whole-word reading',
    }],
    product_score: 100 - Math.max(0, hanLength(text) - 10),
    reviews: pendingReinforcementReviews(),
  }
}

function compareCandidates(left, right) {
  const sourceRank = (candidate) => candidate.source === 'Tatoeba' ? 0 : 1
  return sourceRank(left) - sourceRank(right)
    || right.product_score - left.product_score
    || left.text.length - right.text.length
    || left.id.localeCompare(right.id)
}

export function selectReinforcementCandidatePack({
  targets,
  candidates,
  safeWordsByTarget,
  contextsPerTarget = 3,
  generatedAt = new Date().toISOString(),
  sources,
}) {
  const candidatesByTarget = new Map(targets.map((target) => [target.syllable_tone, []]))
  for (const candidate of candidates) {
    for (const target of candidate.coverage_targets) {
      if (candidatesByTarget.has(target)) candidatesByTarget.get(target).push(candidate)
    }
  }

  const selectedById = new Map()
  const targetStatus = []
  const authoringBriefs = []
  for (const target of targets) {
    const available = [...(candidatesByTarget.get(target.syllable_tone) ?? [])].sort(compareCandidates)
    const selected = []
    const usedCarriers = new Set()
    for (const candidate of available) {
      if (selected.length >= contextsPerTarget) break
      const carriers = candidate.target_carriers.filter((carrier) => (
        (safeWordsByTarget.get(target.syllable_tone) ?? []).some((word) => (
          word.simplified === carrier.text && word.pinyin === carrier.source_pinyin
        ))
      ))
      const introducesCarrier = carriers.some((carrier) => !usedCarriers.has(`${carrier.text}:${carrier.source_pinyin}`))
      if (selected.length > 0 && !introducesCarrier && available.length > contextsPerTarget) continue
      selected.push(candidate)
      for (const carrier of carriers) usedCarriers.add(`${carrier.text}:${carrier.source_pinyin}`)
    }
    for (const candidate of available) {
      if (selected.length >= contextsPerTarget) break
      if (!selected.some((item) => item.id === candidate.id)) selected.push(candidate)
    }

    for (const candidate of selected) {
      const existing = selectedById.get(candidate.id)
      if (!existing) selectedById.set(candidate.id, { ...candidate })
      else {
        existing.coverage_targets = [...new Set([...existing.coverage_targets, target.syllable_tone])].sort()
        existing.target_carriers = [
          ...existing.target_carriers,
          ...candidate.target_carriers.filter((carrier) => !existing.target_carriers.some((item) => (
            item.text === carrier.text && item.source_pinyin === carrier.source_pinyin
          ))),
        ]
      }
    }

    const remaining = Math.max(0, contextsPerTarget - selected.length)
    const safeCarrierOptions = (safeWordsByTarget.get(target.syllable_tone) ?? []).slice(0, 6).map((word) => ({
      text: word.simplified,
      source_pinyin: word.pinyin,
      source: 'CC-CEDICT whole-word reading',
    }))
    const authoringPath = safeCarrierOptions.length > 0
      ? 'guided_authoring'
      : 'specialist_review_required'
    targetStatus.push({
      syllable_tone: target.syllable_tone,
      current_prompt_hits: target.current_prompt_hits,
      prompt_deficit_to_minimum: target.prompt_deficit_to_minimum,
      external_candidates_found: available.length,
      selected_contexts: selected.length,
      distinct_selected_carriers: usedCarriers.size,
      remaining_contexts_to_author: remaining,
      readiness: remaining === 0 ? 'candidate_contexts_ready_pending_review' : authoringPath,
    })
    if (remaining > 0) {
      const specialistRoute = SPECIALIST_TARGET_ROUTES[target.syllable_tone] ?? null
      authoringBriefs.push({
        syllable_tone: target.syllable_tone,
        contexts_required: remaining,
        authoring_path: authoringPath,
        specialist_review_required: authoringPath === 'specialist_review_required',
        safe_carrier_options: safeCarrierOptions,
        specialist_route: specialistRoute,
        specialist_review_reason: authoringPath === 'specialist_review_required'
          ? `未找到适合默认录音任务的低负担连续整词；${specialistRoute?.next_action ?? '请由普通话语言学审稿人确认承载词或决定仅进入边缘专项。'}`
          : null,
        constraints: [
          '5–16个汉字的现代普通话自然短句',
          '承载词必须在句中连续出现并保留整词拼音证据',
          '避免污名、灾难、成人、犯罪、指人评价和商业学习包内容',
          '人工补写后仍需六项审核，不直接进入生产',
        ],
      })
    }
  }

  const items = [...selectedById.values()].sort((left, right) => left.id.localeCompare(right.id))
  return {
    kind: 'voxflame_mandarin_reinforcement_context_review_pack',
    decision_kind: 'voxflame_mandarin_reinforcement_review_decisions',
    generated_at: generatedAt,
    status: 'human_review_required_not_for_production',
    policy: {
      scope: 'below-minimum targets with insufficient safe active prompt diversity',
      existing_prompts_and_recordings_are_preserved: true,
      full_tatoeba_snapshot_is_rescanned_instead_of_using_first_three_ledger_order: true,
      whole_word_reading_and_sentence_citation_reading_must_agree: true,
      existing_prompt_text_is_excluded: true,
      contexts_per_target_goal: contextsPerTarget,
      all_six_reviews_start_pending: true,
      no_item_is_production_eligible_without_human_review: true,
      authoring_briefs_are_not_prompt_text: true,
    },
    sources,
    summary: {
      target_count: targets.length,
      contexts_per_target_goal: contextsPerTarget,
      targets_with_context_goal: targetStatus.filter((target) => target.readiness === 'candidate_contexts_ready_pending_review').length,
      targets_requiring_authoring: targetStatus.filter((target) => ['guided_authoring', 'specialist_review_required'].includes(target.readiness)).length,
      guided_authoring_targets: targetStatus.filter((target) => target.readiness === 'guided_authoring').length,
      specialist_review_targets: targetStatus.filter((target) => target.readiness === 'specialist_review_required').length,
      selected_items: items.length,
      selected_target_assignments: targetStatus.reduce((sum, target) => sum + target.selected_contexts, 0),
      authoring_briefs: authoringBriefs.length,
      production_items: 0,
    },
    target_status: targetStatus,
    authoring_briefs: authoringBriefs,
    items,
  }
}
