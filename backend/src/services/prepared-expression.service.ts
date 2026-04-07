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

const SPEECH_PREPARED_EXPRESSION: PreparedExpressionTemplate = {
  id: 'speech-2026-04-important-expression',
  title: '燃言公开分享准备稿',
  summary:
    '围绕 speech.md 的公开分享准备稿，把开场说明、个人经历、用户价值、产品能力和收尾愿景压成可练、可记、可现场调用的结构化准备。',
  scene: 'public_speaking',
  source: 'speech.md',
  hotwords: [
    '燃言',
    '邱生峰',
    '上海生声不息科技',
    '构音障碍',
    '脑瘫',
    '帕金森',
    '渐冻症',
    '实时辅助沟通',
    '语句训练反馈',
    '个人记忆管理',
  ],
  highRiskPhrases: [
    '大屏幕上实时显示的文字内容',
    '说话不清带来的最大问题，不是发音本身，而是社交隔离和自我封闭',
    '构音障碍人群',
    '中文相关构音障碍数据稀少',
    '个性化微调的语音识别模型',
    '实时辅助沟通、语句训练反馈、个人记忆管理',
  ],
  fallbackPhrases: [
    '现在屏幕上的文字，就是燃言实时转写的结果。',
    '对我来说，难的不是发音本身，而是被隔离在交流之外。',
    '燃言最核心做三件事：实时辅助沟通、语句训练反馈、个人记忆管理。',
    '我们希望 AI 是外骨骼，不是替用户做主的人。',
  ],
  sections: [
    {
      id: 'opening-demo',
      title: '开场与现场说明',
      summary:
        '先交代被演讲激励过，再把屏幕实时转写这件事讲清楚，让听众先建立正确预期。',
      anchorLine: '先跟大家交代一下：现在大屏幕上实时显示的文字内容，就是用燃言翻译的。',
      practiceLines: [
        '先跟大家交代一下：现在大屏幕上实时显示的文字内容，就是用燃言翻译的。',
        '如果你看到有些错别字，别担心，那正是我们要解决的问题。',
      ],
      highRiskPhrases: [
        '大屏幕上实时显示的文字内容',
        '这是我第一次在公开场合这样使用我们的产品',
        '实时转写成文字',
      ],
      fallbackPhrases: [
        '现在屏幕上的文字，就是燃言实时转写的结果。',
        '如果有错别字，正说明这件事值得做。',
      ],
      hotwords: ['燃言', '实时转写', '公开场合'],
      basePriority: 5,
    },
    {
      id: 'founder-story',
      title: '个人经历与问题来源',
      summary:
        '把身份、成长经历和社交隔离的痛点说清楚，让问题从亲身体验里站住。',
      anchorLine: '我是邱生峰，上海生声不息科技创始人。',
      practiceLines: [
        '我是邱生峰，上海生声不息科技创始人。',
        '说话不清带来的最大问题，不是发音本身，而是社交隔离和自我封闭。',
      ],
      highRiskPhrases: [
        '上海生声不息科技',
        '一出生就患了脑瘫',
        '社交隔离和自我封闭',
        '从所谓的 E 人被迫变成 I 人',
      ],
      fallbackPhrases: [
        '我是邱生峰，也是燃言的创始人。',
        '对我来说，难的不是发音，而是很容易被隔离在交流之外。',
      ],
      hotwords: ['邱生峰', '生声不息科技', '脑瘫', '社交隔离', 'ENTJ'],
      basePriority: 5,
    },
    {
      id: 'user-value',
      title: '用户洞察与人群规模',
      summary:
        '把为什么要做、为谁而做，以及这类人群面临的真实处境一起讲清楚。',
      anchorLine:
        '我们最核心面向的是构音障碍人群，比如脑瘫、渐冻症、中风康复者以及听障导致的语障人群。',
      practiceLines: [
        '我们最核心面向的是构音障碍人群，比如脑瘫、渐冻症、中风康复者以及听障导致的语障人群。',
        '他们面临的最大困难是社交隔离和职场歧视，很多人因此不敢出门、不敢社交。',
      ],
      highRiskPhrases: [
        '构音障碍人群',
        '渐冻症',
        '中风康复者',
        '听障导致的语障人群',
        '全球有近 2 亿',
        '中国有一千多万',
      ],
      fallbackPhrases: [
        '燃言最核心服务的是构音障碍人群。',
        '这类用户最难的，是在真实生活里不敢继续表达自己。',
      ],
      hotwords: ['构音障碍', '渐冻症', '中风康复者', '听障', '社交隔离', '职场歧视'],
      basePriority: 5,
    },
    {
      id: 'challenge-stack',
      title: '研发挑战与工程取舍',
      summary:
        '把数据稀缺、时延压力和需求转产品这三件最难的事讲清楚，形成可信的研发判断。',
      anchorLine: '最大的困难是中文相关构音障碍数据稀少，再加上初期用户不多，模型训练精度上不去。',
      practiceLines: [
        '最大的困难是中文相关构音障碍数据稀少，再加上初期用户不多，模型训练精度上不去。',
        '另外一个问题是实时对话对时延要求极低，用户不能等个两三秒才看到翻译结果。',
      ],
      highRiskPhrases: [
        '中文相关构音障碍数据稀少',
        '模型训练精度上不去',
        '实时对话对时延要求极低',
        '自研的语音 agent 框架',
        'GPU 资源',
      ],
      fallbackPhrases: [
        '我们眼下最难的，是数据稀缺和实时时延这两件事。',
        '所以我们一边补数据，一边把语音 agent 的延迟压下来。',
      ],
      hotwords: ['构音障碍数据', '模型训练', '时延', '语音 agent', 'GPU'],
      basePriority: 4,
    },
    {
      id: 'product-definition',
      title: '产品定义与能力结构',
      summary:
        '把燃言是什么、为什么是软硬件一体，以及记忆、上下文、人机交互三层心智讲清楚。',
      anchorLine:
        '燃言核心的三个功能就是：实时辅助沟通、语句训练反馈、个人记忆管理。',
      practiceLines: [
        '燃言核心的三个功能就是：实时辅助沟通、语句训练反馈、个人记忆管理。',
        '我们不希望用户依赖 AI，而是希望 AI 成为用户的外骨骼。',
      ],
      highRiskPhrases: [
        '个性化微调的语音识别模型',
        '自研的语音 Agent 系统',
        '软硬件一体',
        '记忆、上下文、人机交互',
        '实时辅助沟通、语句训练反馈、个人记忆管理',
      ],
      fallbackPhrases: [
        '燃言最核心做三件事：实时辅助沟通、语句训练反馈、个人记忆管理。',
        '我们想让 AI 成为外骨骼，而不是替用户做主的人。',
      ],
      hotwords: ['语音识别模型', '语音 Agent', '软硬件一体', '记忆', '上下文', '人机交互'],
      basePriority: 5,
    },
    {
      id: 'closing-vision',
      title: '结尾愿景与收束',
      summary:
        '把 AI 的角色、自己的定位和燃言的未来一句句收稳，干净结束这次表达。',
      anchorLine:
        '我要当他的眼睛、他的耳朵，带着对世界的好奇和情感，发现真正的需求。',
      practiceLines: [
        '我要当他的眼睛、他的耳朵，带着对世界的好奇和情感，发现真正的需求。',
        '燃言是第一个，这是一个好的开始。',
      ],
      highRiskPhrases: [
        '人与人之间真实的、真诚的链接',
        '和 AI 一起解决更多伙伴的需求',
        '燃言是第一个，这是一个好的开始',
      ],
      fallbackPhrases: [
        'AI 是帮助我成长的伙伴，不是万能答案。',
        '燃言是一个开始，我们会继续把它做成真正有用的作品。',
      ],
      hotwords: ['真实链接', '好奇', '伙伴', '燃言'],
      basePriority: 3,
    },
  ],
};

export function getDefaultPreparedExpressionTemplate(): PreparedExpressionTemplate {
  return SPEECH_PREPARED_EXPRESSION;
}
