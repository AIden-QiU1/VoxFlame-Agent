#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { validateMandarinRecordingCandidate } from './mandarin-recording-corpus-gate-core.mjs'
import { annotateMandarinText } from './mandarin-coverage-core.mjs'

const inputPath = process.argv[process.argv.indexOf('--input') + 1]
const outputPath = process.argv[process.argv.indexOf('--output') + 1]

if (!inputPath || !outputPath) {
  throw new Error('usage: build-mandarin-recording-core-gap-corpus --input <phase1-review.json> --output <corpus.json>')
}

const review = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
if (review.kind !== 'voxflame_mandarin_core_gap_phase1_review_pack') {
  throw new Error('input must be the Mandarin core-gap phase-one candidate pack')
}

const blocked = /学习包|课程包|培训包|资料包|色情|强奸|杀人|尸体|绑架|毒品|赌博/u
const naturalContext = new Map([
  ['这是一个筛子。', '桌上放着一个筛子。'],
  ['他很沮丧。', '他最近一直很沮丧。'],
  ['他把门闩上。', '他把门闩上以后就走了。'],
  ['我是右撇子。', '我是一个右撇子。'],
  ['他耸了耸肩。', '他听完以后耸了耸肩。'],
  ['她耸了耸肩。', '她听完以后耸了耸肩。'],
  ['把勺子给我。', '请把那把勺子给我。'],
  ['少了一把勺子。', '餐桌上少了一把勺子。'],
  ['您有火柴吗?', '请问您有火柴吗？'],
  ['我是左撇子。', '我是一个左撇子。'],
  ['请别戳破气球', '请别把这个气球戳破。'],
  ['船长正在掌舵', '现在船长正在掌舵。'],
  ['请别反复啰嗦', '说重点，请别反复啰嗦。'],
  ['请把空瓶扔掉', '请把这个空瓶扔掉。'],
])
const authored = JSON.parse(fs.readFileSync(path.resolve(path.dirname(inputPath), 'mandarin-authored-gap-candidates.json'), 'utf8'))
const authoredByTarget = new Map()
for (const item of authored.items ?? []) {
  if (blocked.test(item.text)) continue
  const hanLength = [...item.text.match(/\p{Script=Han}/gu) ?? []].length
  if (hanLength < 7 || hanLength > 18) continue
  for (const target of item.coverage_targets ?? []) {
    const list = authoredByTarget.get(target) ?? []
    list.push(item)
    authoredByTarget.set(target, list)
  }
}

const replacementsByText = new Map([
  ['老婆打呼噜,我该怎么办?', '家里有人打呼噜，我该怎么办？'],
  ['螺栓我找到了,螺帽在哪里?', '螺栓我找到了，螺帽在哪里？'],
  ['看见新鲜龙虾,我有了食欲。', '看见新鲜龙虾，我有了食欲。'],
  ['我得好好儿地学习', '请在家好好儿休息。'],
  ['你在家好好儿休息', '你可以好好儿休息。'],
  ['那颗星星可以用裸眼看到。', '这幅画用裸眼就能看清。'],
  ['我只是想要听听你的嗓音。', '我想听听你的嗓音。'],
  ['他观察入微,但沉默寡言。', '他观察入微，但沉默寡言。'],
  ['想吃一点巧克力奶酪吗?', '想吃一点巧克力奶酪吗？'],
  ['目前,他情绪沮丧。', '他最近情绪有些沮丧。'],
  ['西葫芦是绿色的。', '菜篮里的西葫芦是绿色的。'],
  ['个人自由是民主的精髓。', '这篇文章讲清了问题的精髓。'],
  ['她给了我一个腼腆的笑容。', '她腼腆地笑了笑。'],
  ['林肯本人是沉默寡言的。', '他平时沉默寡言。'],
  ['这个漱口水的薄荷味太重了。', '这杯薄荷茶的味道很清爽。'],
  ['把书包轻轻拎起', '请把书包拎起来。'],
  ['婆婆正在阳台浇花', '婆婆今天在阳台浇花。'],
  ['她陪婆婆去散步', '她陪婆婆一起去散步。'],
  ['婆婆正在阳台浇花', '婆婆今天在阳台浇花。'],
])

const items = review.items.map((item) => {
  if (blocked.test(item.text)) throw new Error(`blocked production text: ${item.text}`)
  const sourcePinyin = item.source_pinyin
    ?? item.target_carriers?.find((carrier) => carrier.text && item.text.includes(carrier.text))?.source_pinyin
    ?? null
  const replacement = replacementsByText.get(item.text) ?? naturalContext.get(item.text)
  const text = (replacement ?? item.text)
    .replaceAll(',', '，')
    .replaceAll('?', '？')
    .replaceAll('!', '！')
  const targetCarriers = item.target_carriers ?? (item.source_pinyin ? [{
    text: item.text,
    source_pinyin: item.source_pinyin,
    source: 'CC-CEDICT whole-word reading',
  }] : [])
  return {
    id: `coverage-recording-gap-${item.id}`,
    text,
    category: '音系强化',
    target: item.coverage_targets[0],
    coverage_targets: item.coverage_targets,
    source: replacement ? 'VoxFlame authored candidate (normalized context)' : item.source,
    source_text: item.text,
    source_pinyin: sourcePinyin,
    source_sentence_pinyin: annotateMandarinText(item.text).syllables.map((syllable) => syllable.syllableTone).join(' '),
    prompt_type: item.type,
    target_carriers: targetCarriers,
    source_sentence_id: item.source_sentence_id ?? null,
    source_url: item.source_url ?? null,
    contributor: item.contributor ?? null,
    recording_readiness: 'ready_for_recording',
    language_review: 'machine_checked_candidate_pack',
    review_note: '录音区可见不等于模型训练导入；录音后只按有效音频、非空 target 和质量异常状态进入后续质检。',
  }
}).map((item) => {
  if (item.prompt_type !== 'short_sentence' || item.text.length >= 7) return item
  const alternate = authoredByTarget.get(item.target)?.find((candidate) => candidate.text !== item.text)
  if (!alternate) return item
  return {
    ...item,
    id: `${item.id}-replacement`,
    text: alternate.text,
    source: 'VoxFlame authored candidate',
    source_text: item.text,
    target_carriers: alternate.target_carriers ?? item.target_carriers,
  }
})

const targetSet = new Set(items.flatMap((item) => item.coverage_targets))
const validation = items.map((item) => ({ id: item.id, ...validateMandarinRecordingCandidate(item) }))
const invalid = validation.filter((item) => !item.valid)
if (invalid.length > 0) {
  throw new Error(`recording candidate gate failed:\n${invalid.map((item) => `${item.id}: ${item.errors.join(',')}`).join('\n')}`)
}
if (items.length !== 263 || targetSet.size !== 88) {
  throw new Error(`unexpected recording corpus size: items=${items.length}, targets=${targetSet.size}`)
}
const payload = {
  kind: 'voxflame_mandarin_recording_core_gap_corpus',
  generated_at: new Date().toISOString(),
  generated_from: path.basename(inputPath),
  policy: {
    linguistic_coverage_is_the_root_criterion: true,
    machine_language_and_content_checks_passed: true,
    human_spoken_text_is_not_required_before_recording: true,
    valid_audio_and_non_empty_target_are_collection_prerequisites: true,
    asr_is_hint_only_and_never_an_automatic_rejection_gate: true,
    recording_visibility_does_not_equal_model_training_import: true,
    existing_prompts_recordings_manifests_and_sources_preserved: true,
    gate_rules: 'frontend/scripts/mandarin-recording-corpus-gate-core.mjs',
  },
  summary: {
    recording_ready_items: items.length,
    recording_ready_targets: targetSet.size,
    words: items.filter((item) => item.prompt_type === 'word').length,
    short_sentences: items.filter((item) => item.prompt_type === 'short_sentence').length,
    gate_passed_items: validation.filter((item) => item.valid).length,
  },
  items,
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`wrote ${items.length} recording-ready core-gap prompts for ${targetSet.size} targets`)
