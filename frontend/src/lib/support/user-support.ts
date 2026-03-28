export interface GentleUsePrinciple {
  id: string
  title: string
  description: string
}

export interface SupportResource {
  id: string
  title: string
  summary: string
  href: string
  label: string
}

export const GENTLE_USE_PRINCIPLES: GentleUsePrinciple[] = [
  {
    id: 'one-sentence',
    title: '今天只做一件小事',
    description: '先练一句这周真会说出口的话，做完这一句也算完成，不用一次逼自己练很多。',
  },
  {
    id: 'one-focus',
    title: '一次只盯一个点',
    description: '先抓关键词、节奏或一个最容易混的音，不急着把整句话一次改到最好。',
  },
  {
    id: 'repair',
    title: '没听清就先补救',
    description: '对方没听懂时，先让他重复、写下来或再给你一点时间，不用马上解释全部。',
  },
]

export const CHINESE_COMMUNICATION_RESOURCES: SupportResource[] = [
  {
    id: 'medical-board',
    title: '简体中文就医沟通工具',
    summary: '适合门诊、住院和照护场景，先把症状、需求和决定说清楚。',
    href: 'https://patientprovidercommunication.org/languages/chinese-simplified/',
    label: '就医沟通',
  },
  {
    id: 'public-aac',
    title: '中文 AAC 沟通材料',
    summary: '适合补起手表达、家庭沟通、课堂沟通和高频需求句。',
    href: 'https://apps.apple.com/sa/app/chinese-%E4%B8%AD%E6%96%87%E4%BA%A4%E6%B5%81-aac/id6754344554',
    label: '起手表达',
  },
  {
    id: 'emergency-guide',
    title: '急救与公共服务材料',
    summary: '适合整理紧急求助、就医办理和高压力场景下要说的话。',
    href: 'https://www.redcross.org.cn/html/2025-07/108778.html',
    label: '紧急求助',
  },
  {
    id: 'reading-material',
    title: '中文句子与朗读材料',
    summary: '适合找更自然的中文句子，练节奏、连读和长句稳定性。',
    href: 'https://zh.wikisource.org/',
    label: '朗读练习',
  },
]
