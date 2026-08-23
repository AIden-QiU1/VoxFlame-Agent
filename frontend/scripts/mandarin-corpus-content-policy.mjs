const BLOCKED_DEFAULT_CORPUS_CONTENT = /学习包|课程包|培训包|资料包|阴茎|乳头|裸体|堕胎|烧死|丧生|屁眼|嫖|瘸|傻|蠢|瞎/u

const BLOCKED_KNOWN_LOW_QUALITY_PROMPTS = new Set([
  '东京中城绿意盎然!',
  '差点就酿成怕的火灾了。',
  '她比较鲁莽的相信了他。',
  '水流的强力把桥给冲垮了。',
  '想找个地缝钻进去。',
  '我窘得想找个洞钻进去。',
  '嫉妒是骨中的朽烂。',
  '她的老公通常醉醺醺的。',
  '一磅等于十六盎司。',
  '不要这么吹毛求疵。',
  '你缺乏冲劲。',
  '切磋一下,敢吗?',
  '这种人注定惨败。',
  '我一定不能让这个女人得逞。',
  '我不会让他们得逞的。',
  '这些是无用且冗长的会议。',
  '我们决不能把它两个混淆。',
  '你右边袜子倒转穿了。',
])

export function containsBlockedDefaultCorpusContent(text) {
  const normalized = String(text ?? '')
  return BLOCKED_DEFAULT_CORPUS_CONTENT.test(normalized)
    || BLOCKED_KNOWN_LOW_QUALITY_PROMPTS.has(normalized)
}
