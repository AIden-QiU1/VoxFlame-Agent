import { MandarinTrainingSource, MandarinTrainingSourceId } from './types'

export const MANDARIN_TRAINING_SOURCES: Record<
  MandarinTrainingSourceId,
  MandarinTrainingSource
> = {
  public_aac: {
    id: 'public_aac',
    label: '中文 AAC 沟通语料',
    url: 'https://apps.apple.com/sa/app/chinese-%E4%B8%AD%E6%96%87%E4%BA%A4%E6%B5%81-aac/id6754344554',
    summary: '公开中文 AAC 沟通材料，适合补高频起手表达、家庭与课堂沟通短句。',
  },
  apple_support_cn: {
    id: 'apple_support_cn',
    label: 'Apple 中文支持页',
    url: 'https://support.apple.com/zh-cn/guide/iphone/welcome/ios',
    summary: '公开中文设备帮助页，适合补电话、信息、定位、闹钟和短指令类句子。',
  },
  public_service_guides: {
    id: 'public_service_guides',
    label: '公共服务与急救材料',
    url: 'https://www.redcross.org.cn/html/2025-07/108778.html',
    summary: '公开急救与就医办理材料，可补求助、急救、病历和就医说明类句子。',
  },
  people_roles_public: {
    id: 'people_roles_public',
    label: '人群与角色公开材料',
    url: 'https://apps.apple.com/cn/app/%E7%AB%8B%E7%9F%A5%E8%AF%BE%E5%A0%82/id1507715553',
    summary: '课堂互动、老人照护、护士礼仪和客服常用语等公开材料，适合补学生、老人、照护者和服务岗位表达。',
  },
  mccsd: {
    id: 'mccsd',
    label: 'MCCSD 中文句集',
    url: 'https://mccs-2024.github.io/',
    summary: '带生活任务感的中文句子来源，可补问候、见面和日常表达。',
  },
  public_classics: {
    id: 'public_classics',
    label: '经典文章与声律材料',
    url: 'https://zh.wikisource.org/',
    summary: '公开经典中文文章和声律材料，适合补句式节奏、押韵和朗读稳定性覆盖。',
  },
}
