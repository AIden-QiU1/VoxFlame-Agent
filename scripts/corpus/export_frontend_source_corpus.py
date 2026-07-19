#!/usr/bin/env python3
"""
Export a frontend Mandarin training corpus from traceable source texts only.

This script deliberately avoids prompt templates. It accepts already-built
scene/phonology corpora plus optional local manifests, then filters, dedupes,
balances, and writes the JSON shape consumed by the training page.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator

try:
    from opencc import OpenCC
except ImportError:  # pragma: no cover - optional offline corpus dependency
    OpenCC = None  # type: ignore[assignment]

from build_mandarin_scene_corpus import (
    build_coverage_scores,
    build_length_score,
    chinese_length,
    classify_scene,
    iter_sentence_units,
    parse_source_entry,
    read_source,
)


CATEGORY_ORDER = [
    "日常与出行",
    "看病与求助",
    "人群与角色",
    "设备与数字",
    "现代文章朗读",
    "会议与协作",
    "车载与导航",
    "音系强化",
]

SCENE_TO_CATEGORY = {
    "开口先说": "日常与出行",
    "家里需要": "日常与出行",
    "出门办事": "日常与出行",
    "看病拿药": "看病与求助",
    "紧急情况": "看病与求助",
    "手机设备": "设备与数字",
    "数字时间": "设备与数字",
}

SOURCE_HARD_CATEGORY_HINTS = {
    "childmandarin": "人群与角色",
    "classroom": "人群与角色",
    "caregiver": "人群与角色",
    "elder": "人群与角色",
    "nurse": "人群与角色",
    "pep_textbook": "人群与角色",
    "customer_service": "人群与角色",
    "pts_reading": "现代文章朗读",
    "aishell4": "会议与协作",
    "meeting": "会议与协作",
    "conference": "会议与协作",
    "aishell5": "车载与导航",
    "car": "车载与导航",
    "driving": "车载与导航",
    "vehicle": "车载与导航",
}

DEFAULT_CAPS = {
    "日常与出行": 900,
    "看病与求助": 600,
    "人群与角色": 750,
    "设备与数字": 700,
    "现代文章朗读": 4300,
    "会议与协作": 900,
    "车载与导航": 500,
    "音系强化": 2600,
}

OPENCC_T2S = OpenCC("t2s") if OpenCC is not None else None

CATEGORY_SOURCE_SOFT_CAPS = {
    "日常与出行": 650,
    "看病与求助": 450,
    "人群与角色": 520,
    "设备与数字": 520,
    "现代文章朗读": 1900,
    "会议与协作": 650,
    "车载与导航": 420,
    "音系强化": 1200,
}

BLOCK_PATTERNS = (
    "app下载",
    "ai全流程",
    "cookie",
    "iphone",
    "ipad",
    "pmp",
    "扫码",
    "关注",
    "客服热线",
    "在线客服",
    "公众号",
    "下载app",
    "登录",
    "注册",
    "验证码",
    "隐私",
    "协议",
    "版权",
    "版权所有",
    "网站",
    "网页",
    "页面",
    "官方支持",
    "使用手册",
    "当前位置",
    "上一篇",
    "下一篇",
    "相关阅读",
    "推荐阅读",
    "延伸阅读",
    "免费",
    "内购买",
    "专为设计",
    "信息公开",
    "信息来源",
    "发布日期",
    "来源",
    "浏览量",
    "点击",
    "返回",
    "查看",
    "搜索",
    "输入",
    "选择",
    "修改这个控件",
    "自动更新",
    "窗口",
    "菜单",
    "备案",
    "营业执照",
    "出版物经营",
    "风险提示",
    "不构成建议",
    "最终真实收益",
    "收益承诺",
    "权威部门",
    "教师资格",
    "小学教师",
    "中学综合素质",
    "初中学科",
    "学科知识",
    "综合素质",
    "幼儿综合素质",
    "确认通过",
    "备考",
    "告别盲目",
    "刷题",
    "快人一步",
    "在线老师",
    "在线咨询",
    "咨询在线",
    "加入收藏",
    "收藏本站",
    "希赛",
    "育路",
    "考生",
    "题库",
    "课程",
    "资料",
    "证书",
    "考试时间",
    "报名",
    "学员",
    "兑换码",
    "维基",
    "自由的图书馆",
    "图书馆",
    "在其他项目中",
    "维基数据项目",
    "子章节",
    "开关卷",
    "明朝作品",
    "全世界都属于",
    "公共领域",
    "许可协议",
    "原文",
    "本作品",
    "阅论编",
    "图片",
    "image",
    "button",
    "申请表",
    "许可证",
    "协议管理",
    "项目名称",
    "子项名称",
    "联系方式",
    "希望我们通过哪种方式",
    "主编",
    "节选",
    "节先自",
    "费舍尔",
    "达瑞的故事",
    "风筝畅想曲",
    "儿童挣钱",
    "白话文废话",
    "屯將",
    "曲长屯",
    "三国志",
    "明並日月",
    "卷第",
    "正倉院",
    "狡猾",
    "权力屈服",
    "加入我们",
    "点击查看",
    "立即下载",
    "用户协议",
    "隐私政策",
    "打开链接",
    "无法加载",
    "正在加载",
    "阅读全文",
    "阅读更多",
    "广告",
    "赞助",
    "使用入门",
    "个性化推荐",
    "第三方物品",
    "管理字体",
    "游戏控制器",
    "快速备忘录",
    "无边记",
    "相簿",
    "播客",
    "文件夹",
    "发送副本",
    "版本",
    "添加照片",
    "添加视频",
    "更改设置",
    "通知",
    "静音",
    "电子书",
    "僮碎碎念",
    "app下载",
    "视觉及声音扫瞄",
    "适用对象包括",
    "沟通讯息需求",
    "请参阅支持文章",
    "支持文章",
    "更多信息",
    "群组图标",
    "蓝色的发送箭头",
    "锁定屏幕",
    "拟我表情",
    "单线回复",
    "健康数据",
    "步行稳定性",
    "药品",
    "卫星发送",
    "道路救援",
    "月经周期",
    "专属设备",
)

BAD_PREFIXES = tuple("的了和与及或并而但却则又也就都将把被在对从向以由为其此该本等号")
BAD_SUFFIXES = tuple("的和与及或并而但却则将把被在对从向以由为")

SENSITIVE_OR_LOW_VALUE_PATTERNS = (
    "女尸",
    "男尸",
    "尸体",
    "自杀",
    "死亡",
    "杀人",
    "杀害",
    "枪杀",
    "强奸",
    "猥亵",
    "毒品",
    "吸毒",
    "贩毒",
    "赌博",
    "战争",
    "恐怖袭击",
    "爆炸",
    "炸弹",
    "凶杀",
    "血腥",
    "色情",
    "总统",
    "政党",
    "政府军",
    "汤姆",
    "汤米",
    "玛丽",
    "杰克",
    "约翰",
    "凯勒",
    "伦敦",
    "英国",
    "美国",
    "法国",
    "德国",
    "日本",
    "希腊",
    "上帝",
    "耶稣",
    "圣经",
    "基督",
    "法语",
    "德语",
    "英语",
    "日语",
    "国务院",
    "政府",
    "常委",
    "政协",
    "书记",
    "海捕文书",
    "楼盘",
    "国语版",
    "属植物",
    "官员有什么",
    "文物有什么",
    "酒店有什么",
    "国家园项目",
    "净利润",
    "营收",
    "投资者",
    "市场价",
    "万亿元",
    "亿元",
    "万元",
    "君王",
    "皇后",
    "廉吏",
    "清太祖",
    "疫情",
    "新冠",
    "感染者",
    "确诊",
    "病例",
    "隔离",
    "中共中央",
    "外交部",
    "发改委",
    "证监会",
    "银监会",
    "房地产",
    "成交量",
    "限购",
    "股价",
    "股份",
    "上市公司",
    "董事长",
    "总经理",
    "特朗普",
    "奥巴马",
    "拜登",
    "普京",
    "朝鲜",
    "台湾",
    "香港",
    "澳门",
    "搜狐",
    "新浪",
    "腾讯",
    "网易",
    "微博",
    "粉丝量",
    "直播间",
    "带货",
    "秒杀",
    "迪奥",
    "杨树林",
    "宝格莱雅",
    "浪荡",
    "混蛋",
    "魔法",
    "拉丁语",
    "厄尔",
    "达茜",
    "柯林",
    "西雅图",
    "温哥华",
    "富家女",
    "消灭我们",
    "你死了",
    "听逆战",
    "夜空中最亮的星",
    "小情歌",
    "娱乐天空",
    "精忠报国",
    "风雨无阻",
    "月满西楼",
    "刘德华",
    "陈奕迅",
    "刀郎",
    "鹿晗",
    "黄英",
    "李琦",
    "大哲",
    "华语群星",
    "播放音乐",
    "播放下一",
    "来一首",
    "放首歌",
    "放首音乐",
    "我要听",
    "给我听",
    "我想听",
    "听歌曲",
    "唱首",
    "点播",
    "鸿发塑钢",
    "防护栏",
    "旅行社",
    "大厦停车场",
    "商厦停车场",
    "集团加油站",
    "石油加油站",
    "路口站",
    "无人售票",
    "自行车道",
    "开元店",
    "总医院",
    "安德烈",
    "兰迪",
    "卢卡斯",
    "乔希",
    "琼给我",
    "韩磊",
    "孙楠",
    "伍佰",
    "刘紫玲",
    "红尘情歌",
    "月亮惹的祸",
    "同桌的你",
    "朋友的酒",
    "三明治",
    "星际旅行",
    "警局",
    "指控",
    "昏迷",
    "送命",
    "情欲",
    "死狗",
    "被偷",
    "体大",
    "小叮当",
    "电死你",
    "谋杀",
    "逮捕",
    "癌细胞",
    "活不过",
    "手足口病",
    "自闭症",
    "纸尿裤",
    "腿疼",
    "月经",
    "加拿大",
    "渥太华",
    "世界杯",
)

CLASSICAL_OR_OLD_STYLE_PATTERNS = (
    "曰",
    "兮",
    "矣",
    "焉",
    "吾",
    "汝",
    "尔等",
    "寡人",
    "陛下",
    "臣",
    "妾",
    "孰",
    "岂",
    "未尝",
    "不亦",
    "何以",
    "若夫",
    "嗟乎",
    "呜呼",
)

CHINESE_NUMERAL_RE = re.compile(r"[零一二三四五六七八九十百千万亿两幺]+")
CHINESE_ONLY_RE = re.compile(r"^[\u4e00-\u9fff]+$")
ACTION_OR_CONTEXT_TERMS = (
    "我",
    "你",
    "您",
    "我们",
    "请",
    "要",
    "想",
    "需要",
    "可以",
    "帮",
    "去",
    "来",
    "找",
    "看",
    "听",
    "说",
    "问",
    "告诉",
    "确认",
    "提醒",
    "打开",
    "关闭",
    "讨论",
    "安排",
    "时间",
    "医生",
    "护士",
    "老师",
    "同事",
    "朋友",
    "家人",
)

MODERN_READING_TERMS = (
    "生活",
    "世界",
    "自然",
    "阳光",
    "清晨",
    "空气",
    "声音",
    "城市",
    "道路",
    "孩子",
    "老人",
    "学习",
    "工作",
    "科学",
    "文化",
    "历史",
    "社会",
    "环境",
    "心里",
    "希望",
    "变化",
    "成长",
    "美好",
    "认真",
    "努力",
    "平静",
    "温暖",
)

PHONOLOGY_SOURCE_MARKERS = (
    "aishell1",
    "aishell3",
    "wenetspeech",
    "pts_reading",
)

COMMERCIAL_ADVERTISING_RE = re.compile(
    r"(优惠券|优惠价|优惠活动|大礼包|促销|秒杀|折扣|特价|招商|加盟|引流|赠礼|推销|带货|"
    r"直播间|直播课堂|主播|粉丝|客户端下载|下载到.{0,6}客户端|点赞|留言|"
    r"关注.{0,4}公众号|考试真题|模拟试题|高频考点|考试题型|试卷|闭卷|"
    r"资格考试|精讲班|培训中心|培训班|培训机构|辅导班|视频教程|基金从业|"
    r"教师资格|职称考试|考试重点|题库|备考|招生|报名咨询|代理孕母)"
)
ADULT_OR_SEXUAL_RE = re.compile(
    r"(性生活|性交|性爱|性欲|情欲|阴道|阴茎|乳房|精囊|裸体|裸照|黄片|"
    r"色情|嫖娼|卖淫|妓女|强奸|猥亵|自慰|约炮|一夜情|发生性关系|性交易|"
    r"包养|援交|成人用品)"
)
CRIME_VIOLENCE_ACCIDENT_RE = re.compile(
    r"(诈骗|遇害|死者|警方|秘密警察|监狱|盗窃|抢劫|劫持|拘留|被拘|"
    r"犯罪|凶杀|谋杀|杀人|自杀|尸体|枪杀|毒品|吸毒|贩毒|赌博|"
    r"犯罪嫌疑人|交通事故|安全事故|环境污染事故|事故现场|事故发生|"
    r"轻生|跳河|跳楼|猝死|砸死|撞死|伤者|报警|报案|殴打|打伤|砍伤|"
    r"捅伤|身亡|不治身亡|抢救无效|火灾|车祸|坠亡|失踪|拐卖)"
)
NEWS_MEDIA_FRAGMENT_RE = re.compile(
    r"(记者|新华社|中新社|中新网|华商报|日报记者|晨报记者|晚报记者|"
    r"新文化讯|日讯|文摄|专访时说|消息称|据.{0,8}报道|报道后|"
    r"告诉.{0,8}记者|对.{0,8}记者说|向.{0,8}记者表示|本报讯|本台消息|"
    r"新闻发布会|新闻报道|媒体报道|媒体采访|接受采访|我们报道了|"
    r"报道了一位|最新消息|消息人士|获悉|通讯员)"
)
FINANCE_REAL_ESTATE_RE = re.compile(
    r"(房价|房企|豪宅|楼盘|楼市|地产|房产|购房|买房|卖房|住房市场|"
    r"融资|债券|股价|证券|基金经理|投资基金|封闭式基金|开放式基金|基金估值|"
    r"私募|净利润|营收|投资者|成交量|限购|去库存|收益率|利率|"
    r"公积金|保险基金|股票|期货|信托|理财产品|资产管理|房地产|"
    r"阳光城|万科|万达|三四线城市|售楼处|开发商|住宅项目|商业项目)"
)
ENTERTAINMENT_PROMO_RE = re.compile(
    r"(明星大咖|女明星|男明星|艺人|首播|巡演|演唱会|娱乐节目|综艺节目|"
    r"本期节目|我们的节目|听我节目|节目能够|节目对你|影视剧|票房|"
    r"世界冠军|全国冠军|冠军|亚军|季军|锦标赛|联赛|运动会|田径|赛事|"
    r"球员|球队|教练员|运动员|足球|篮球|排球|网球|羽毛球|乒乓球|"
    r"观众|粉丝|颁奖|夺冠|晋级|决赛|半决赛)"
)
ORGANIZATION_OR_POI_FRAGMENT_RE = re.compile(
    r"(有限公司|集团副总裁|集团总裁|证券事务部|公关部|销售中心|"
    r"项目负责人|项目某管理人士|有关负责人对记者|某管理人士对记者|"
    r"支行的客户经理|研究所副所长|协会会长|协会秘书长|委员会主任|"
    r"办公室主任|相关负责人|公司负责人|公司董事|公司高管|某公司|"
    r"某集团|研究院院长|研究中心主任)"
)
ASR_DISFLUENCY_RE = re.compile(
    r"(客户儿|部门儿|为为什么|客客户|项项目|世世界|整整个|线线上|"
    r"一一堆|你你们|我我觉得|女女客户|这个这个|那个那个|这这个|"
    r"那个那个那|能能解决|能够能够|就是就是说|所以就是说)"
)
DISCOURSE_FRAGMENT_PREFIX_RE = re.compile(
    r"^(所以说|就是说|然后就是|那么就是|那个就是|这个就是|"
    r"我觉得就是|我觉得这个|我觉得那个|其实就是|第二个就是说)"
)
BROKEN_FRAGMENT_SUFFIXES = (
    "的话",
    "的是",
    "方面",
    "情况",
    "问题",
    "东西",
    "这个",
    "那个",
    "进行",
    "属于",
    "为主",
    "之一",
    "以来",
    "来看",
    "来说",
    "来讲",
    "能够",
    "取决于",
    "希望达成的是",
)

# Only substantive content defects count toward the source-level 20% gate.
# Technical exclusions such as length, unsupported characters and duplicates
# are still removed sentence by sentence, but do not make a source "low
# quality" because they say nothing about the semantic value of that source.
CONTENT_QUALITY_REJECTION_REASONS = frozenset(
    {
        "web_or_navigation_noise",
        "sensitive_or_low_value",
        "classical_or_old_style",
        "commercial_or_advertising",
        "adult_or_sexual",
        "crime_violence_or_accident",
        "news_or_media_fragment",
        "finance_or_real_estate",
        "entertainment_or_program_promo",
        "organization_or_proper_name_fragment",
        "asr_disfluency_or_duplication",
        "spoken_discourse_fragment",
        "broken_sentence_fragment",
        "repetitive_pronoun",
        "low_character_diversity",
        "repetitive_character",
        "numeric_only_or_low_context",
        "filler_heavy",
        "low_context_spoken_fragment",
        "unframed_question_fragment",
        "repetitive_question_fragment",
        "filler_prefix",
        "poi_or_business_listing",
    }
)

TRADITIONAL_MAP = str.maketrans(
    {
        "國": "国",
        "與": "与",
        "雲": "云",
        "觀": "观",
        "賊": "贼",
        "適": "适",
        "於": "于",
        "傷": "伤",
        "靈": "灵",
        "聞": "闻",
        "騎": "骑",
        "陰": "阴",
        "陽": "阳",
        "賢": "贤",
        "後": "后",
        "內": "内",
        "異": "异",
        "稱": "称",
        "謹": "谨",
        "計": "计",
        "難": "难",
        "補": "补",
        "闕": "缺",
        "氣": "气",
        "餘": "余",
        "論": "论",
        "詔": "诏",
        "吳": "吴",
        "違": "违",
        "據": "据",
        "敗": "败",
        "鈍": "钝",
        "損": "损",
        "無": "无",
        "興": "兴",
        "陳": "陈",
        "諸": "诸",
        "則": "则",
        "聖": "圣",
        "臨": "临",
        "遠": "远",
        "離": "离",
        "涕": "涕",
        "隂": "阴",
        "敘": "叙",
        "並": "并",
        "開": "开",
        "關": "关",
        "書": "书",
        "讀": "读",
        "處": "处",
        "語": "语",
        "聲": "声",
        "韻": "韵",
        "歲": "岁",
        "夢": "梦",
        "歸": "归",
        "風": "风",
        "華": "华",
        "東": "东",
        "萬": "万",
        "長": "长",
        "學": "学",
        "臺": "台",
        "蘭": "兰",
        "懷": "怀",
        "懐": "怀",
        "扵": "于",
        "爲": "为",
        "為": "为",
        "覺": "觉",
        "說": "说",
        "聽": "听",
        "應": "应",
        "醫": "医",
        "藥": "药",
        "婦": "妇",
        "兒": "儿",
        "時": "时",
        "間": "间",
        "現": "现",
        "點": "点",
        "帶": "带",
        "幫": "帮",
        "請": "请",
        "讓": "让",
        "這": "这",
        "個": "个",
        "們": "们",
        "會": "会",
        "來": "来",
        "車": "车",
        "話": "话",
        "發": "发",
        "電": "电",
        "號": "号",
        "門": "门",
        "樓": "楼",
        "亂": "乱",
        "傳": "传",
        "兩": "两",
        "冊": "册",
        "勝": "胜",
        "喚": "唤",
        "嘗": "尝",
        "圖": "图",
        "報": "报",
        "壯": "壮",
        "將": "将",
        "宮": "宫",
        "廬": "庐",
        "張": "张",
        "從": "从",
        "復": "复",
        "慮": "虑",
        "憶": "忆",
        "戰": "战",
        "戶": "户",
        "撲": "扑",
        "攬": "揽",
        "敵": "敌",
        "暢": "畅",
        "業": "业",
        "極": "极",
        "樂": "乐",
        "機": "机",
        "殤": "殇",
        "洩": "泄",
        "漢": "汉",
        "濺": "溅",
        "營": "营",
        "爺": "爷",
        "猶": "犹",
        "畢": "毕",
        "畫": "画",
        "當": "当",
        "盡": "尽",
        "簡": "简",
        "紅": "红",
        "終": "终",
        "絕": "绝",
        "絲": "丝",
        "織": "织",
        "脫": "脱",
        "腳": "脚",
        "蓋": "盖",
        "虛": "虚",
        "見": "见",
        "視": "视",
        "親": "亲",
        "觴": "觞",
        "討": "讨",
        "託": "托",
        "許": "许",
        "訴": "诉",
        "詩": "诗",
        "該": "该",
        "誕": "诞",
        "誠": "诚",
        "諮": "咨",
        "豬": "猪",
        "責": "责",
        "買": "买",
        "賞": "赏",
        "跡": "迹",
        "軍": "军",
        "載": "载",
        "轡": "辔",
        "辭": "辞",
        "連": "连",
        "週": "周",
        "達": "达",
        "遺": "遗",
        "邊": "边",
        "錄": "录",
        "鐵": "铁",
        "閣": "阁",
        "際": "际",
        "隨": "随",
        "雖": "虽",
        "韉": "鞯",
        "領": "领",
        "頭": "头",
        "願": "愿",
        "類": "类",
        "顧": "顾",
        "飛": "飞",
        "馬": "马",
        "馳": "驰",
        "駿": "骏",
        "騁": "骋",
        "驅": "驱",
        "鳴": "鸣",
        "黃": "黄",
        "齊": "齐",
        "龜": "龟",
        "僞": "伪",
        "創": "创",
        "娛": "娱",
        "妝": "妆",
        "爾": "尔",
        "窺": "窥",
        "舊": "旧",
        "舎": "舍",
        "衞": "卫",
        "覩": "睹",
        "遊": "游",
        "歎": "叹",
        "羣": "群",
        "円": "元",
        "脩": "修",
        "稧": "禊",
    }
)


def to_simplified_chinese(raw: str) -> str:
    text = OPENCC_T2S.convert(raw) if OPENCC_T2S is not None else raw
    return text.translate(TRADITIONAL_MAP)


@dataclass(frozen=True)
class SourceItem:
    text: str
    category: str
    source_id: str
    source_ref: str
    score: float
    length: int


@dataclass
class RejectionAudit:
    counts: Counter[str] = field(default_factory=Counter)
    source_counts: dict[str, Counter[str]] = field(default_factory=lambda: defaultdict(Counter))
    category_counts: dict[str, Counter[str]] = field(default_factory=lambda: defaultdict(Counter))
    examples: dict[str, list[dict[str, str]]] = field(default_factory=lambda: defaultdict(list))
    source_quality_decisions: dict[str, dict[str, Any]] = field(default_factory=dict)

    def record(
        self,
        reason: str,
        *,
        text: str,
        source_id: str,
        category: str = "unclassified",
    ) -> None:
        self.counts[reason] += 1
        self.source_counts[source_id][reason] += 1
        self.category_counts[category][reason] += 1
        if len(self.examples[reason]) < 20:
            self.examples[reason].append({
                "text": text,
                "source_id": source_id,
                "category": category,
            })

    def record_source_quality_decision(
        self,
        *,
        source_id: str,
        reviewed_count: int,
        low_quality_count: int,
        threshold: float,
        excluded: bool,
        accepted_before_source_gate: int,
    ) -> None:
        ratio = low_quality_count / reviewed_count if reviewed_count else 0.0
        self.source_quality_decisions[source_id] = {
            "reviewed_content_count": reviewed_count,
            "low_quality_count": low_quality_count,
            "low_quality_ratio": round(ratio, 6),
            "threshold": threshold,
            "decision": "excluded" if excluded else "accepted",
            "accepted_before_source_gate": accepted_before_source_gate,
            "accepted_after_source_gate": 0 if excluded else accepted_before_source_gate,
        }

    def to_payload(self) -> dict[str, Any]:
        return {
            "rejected_total": sum(self.counts.values()),
            "reason_counts": dict(sorted(self.counts.items())),
            "source_reason_counts": {
                source: dict(sorted(counts.items()))
                for source, counts in sorted(self.source_counts.items())
            },
            "category_reason_counts": {
                category: dict(sorted(counts.items()))
                for category, counts in sorted(self.category_counts.items())
            },
            "source_quality_decisions": dict(sorted(self.source_quality_decisions.items())),
            "examples": dict(sorted(self.examples.items())),
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="导出前端训练页真实来源句库")
    parser.add_argument("--scene-corpus", action="append", type=Path, default=[])
    parser.add_argument("--phonology-corpus", action="append", type=Path, default=[])
    parser.add_argument("--manifest", action="append", type=Path, default=[])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--min-length", type=int, default=7)
    parser.add_argument("--max-length", type=int, default=18)
    parser.add_argument("--per-source-cap", type=int, default=3000)
    parser.add_argument("--signature-cap", type=int, default=4)
    parser.add_argument(
        "--max-source-low-quality-ratio",
        type=float,
        default=0.20,
        help="实质低质量句占已评审内容的比例超过该值时整源退出，默认 0.20",
    )
    parser.add_argument("--audit-output", type=Path, default=None)
    parser.add_argument("--cap", action="append", default=[], help="分类上限，如 现代文章朗读=560")
    return parser.parse_args()


def parse_caps(values: Iterable[str]) -> dict[str, int]:
    caps = dict(DEFAULT_CAPS)
    for value in values:
        if "=" not in value:
            raise ValueError(f"cap 必须是 分类=数字: {value}")
        category, raw_count = value.split("=", 1)
        if category not in caps:
            raise ValueError(f"未知分类: {category}")
        caps[category] = int(raw_count)
    return caps


def visible_text(raw: str) -> str:
    text = to_simplified_chinese(raw)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[&＃#%$<>]+", "", text)
    text = text.replace("//", "")
    text = re.sub(r"[“”\"'‘’《》〈〉【】\[\]()（）·…—\-]", "", text)
    text = re.sub(r"[，,、：:/／；;。！？!?\\s]+", "", text)
    return text.strip()


def rejection_reason(text: str, min_length: int = 7, max_length: int = 18) -> str | None:
    if not text:
        return "empty"
    lowered = text.lower()
    if any(pattern in lowered for pattern in BLOCK_PATTERNS):
        return "web_or_navigation_noise"
    if any(pattern in text for pattern in SENSITIVE_OR_LOW_VALUE_PATTERNS):
        return "sensitive_or_low_value"
    if any(pattern in text for pattern in CLASSICAL_OR_OLD_STYLE_PATTERNS):
        return "classical_or_old_style"
    if COMMERCIAL_ADVERTISING_RE.search(text):
        return "commercial_or_advertising"
    if ADULT_OR_SEXUAL_RE.search(text):
        return "adult_or_sexual"
    if CRIME_VIOLENCE_ACCIDENT_RE.search(text):
        return "crime_violence_or_accident"
    if NEWS_MEDIA_FRAGMENT_RE.search(text):
        return "news_or_media_fragment"
    if FINANCE_REAL_ESTATE_RE.search(text):
        return "finance_or_real_estate"
    if ENTERTAINMENT_PROMO_RE.search(text):
        return "entertainment_or_program_promo"
    if ORGANIZATION_OR_POI_FRAGMENT_RE.search(text):
        return "organization_or_proper_name_fragment"
    if ASR_DISFLUENCY_RE.search(text):
        return "asr_disfluency_or_duplication"
    if DISCOURSE_FRAGMENT_PREFIX_RE.search(text):
        return "spoken_discourse_fragment"
    if re.search(r"[A-Za-z0-9]", text):
        return "ascii_or_digit"
    if re.search(r"[^\u4e00-\u9fff]", text):
        return "non_chinese_character"
    if not CHINESE_ONLY_RE.match(text):
        return "non_chinese_character"
    length = chinese_length(text)
    if length < min_length or length > max_length:
        return "length_out_of_range"
    if text.startswith(BAD_PREFIXES) or text.endswith(BAD_SUFFIXES):
        return "dangling_function_word"
    if text.endswith(BROKEN_FRAGMENT_SUFFIXES):
        return "broken_sentence_fragment"
    if text.count("我") >= 3 or text.count("你") >= 3:
        return "repetitive_pronoun"
    if len(set(text)) <= 3:
        return "low_character_diversity"
    if max(Counter(text).values()) > max(3, length // 3):
        return "repetitive_character"
    if len(CHINESE_NUMERAL_RE.sub("", text)) <= 2:
        return "numeric_only_or_low_context"
    if sum(1 for char in text if char in "嗯呃啊哦诶哎嘛吧啦呀呢哈") >= max(3, length // 3):
        return "filler_heavy"
    if re.search(r"(.)\1\1", text):
        return "repetitive_character"
    if re.search(r"(就是|这个|那个|然后|对对|嗯嗯)", text) and length <= 10:
        return "low_context_spoken_fragment"
    if text.endswith(("有什么", "是什么", "在哪儿", "在哪里")) and not any(
        term in text for term in ("请问", "告诉", "知道", "可以", "需要", "我想", "帮我")
    ):
        return "unframed_question_fragment"
    if text.count("什么") >= 2:
        return "repetitive_question_fragment"
    if text.endswith(("方面", "情况", "问题", "东西", "这个", "那个", "一些", "进行", "属于")):
        return "broken_sentence_fragment"
    if text.startswith(("呃", "嗯", "啊", "哦", "零")):
        return "filler_prefix"
    if re.search(r"(.)\1.*\1\1", text):
        return "repetitive_character"
    if text.startswith(("据了解", "据报道", "报道称", "记者", "搜狐", "中新网", "新华社")):
        return "news_or_media_fragment"
    if any(suffix in text for suffix in ("大酒店", "酒店", "旅行社", "总医院", "停车场", "加油站")) and not any(
        term in text for term in ("请", "我", "我们", "去", "到", "找", "停车", "加油")
    ):
        return "poi_or_business_listing"
    return None


def is_bad_text(text: str, min_length: int = 7, max_length: int = 18) -> bool:
    return rejection_reason(text, min_length, max_length) is not None


def category_for_source(source_id: str, text: str) -> str:
    lowered = source_id.lower()
    for marker, category in SOURCE_HARD_CATEGORY_HINTS.items():
        if marker in lowered:
            return category
    if any(
        term in text
        for term in (
            "会议",
            "项目",
            "方案",
            "同事",
            "团队",
            "讨论",
            "协作",
            "安排",
            "进度",
            "风险",
            "确认",
            "汇报",
            "客户",
            "合同",
            "预算",
            "资料",
        )
    ):
        return "会议与协作"
    if any(
        term in text
        for term in (
            "导航",
            "开车",
            "车道",
            "高速",
            "停车",
            "加油",
            "充电",
            "路口",
            "掉头",
            "右转",
            "左转",
            "限速",
            "车里",
            "空调",
            "后备箱",
            "安全带",
        )
    ):
        return "车载与导航"
    if any(term in text for term in ("医生", "护士", "吃药", "用药", "急救", "生病", "发烧", "疼痛", "拉肚子", "排尿")):
        return "看病与求助"
    if any(
        term in text
        for term in (
            "妈妈",
            "爸爸",
            "父亲",
            "母亲",
            "老师",
            "同学",
            "学生",
            "朋友",
            "同事",
            "老板",
            "孩子",
            "儿子",
            "女儿",
            "妹妹",
            "哥哥",
            "姐姐",
            "邻居",
            "服务生",
            "家人",
            "家属",
            "同桌",
            "前台",
            "客服",
            "乘务员",
        )
    ):
        return "人群与角色"
    if any(
        term in text
        for term in (
            "电话",
            "手机",
            "相机",
            "电视",
            "房间号",
            "几点",
            "几月",
            "周一",
            "周二",
            "周三",
            "周四",
            "周五",
            "周六",
            "周日",
            "星期",
            "元",
            "块钱",
            "楼",
            "分钟",
            "公里",
            "密码",
            "账号",
            "短信",
            "蓝牙",
            "音量",
            "字幕",
        )
    ):
        return "设备与数字"
    if any(marker in lowered for marker in PHONOLOGY_SOURCE_MARKERS) or "aishell_transcript" in lowered:
        return "现代文章朗读"
    return "日常与出行"


def content_quality_score(source_id: str, text: str, category: str) -> float:
    lowered_source = source_id.lower()
    score = 0.0
    if "pts_reading" in lowered_source:
        score += 1.8
    if "wenetspeech" in lowered_source:
        score += 0.6
    if "aishell4" in lowered_source:
        score += 1.0
    if "aishell1" in lowered_source:
        score += 0.2
    if any(term in text for term in MODERN_READING_TERMS):
        score += 0.8
    if any(term in text for term in ACTION_OR_CONTEXT_TERMS):
        score += 0.3
    if category in {"日常与出行", "看病与求助", "设备与数字", "车载与导航"} and any(
        term in text for term in ("请", "我", "你", "您", "可以", "需要", "帮")
    ):
        score += 1.0
    if category == "会议与协作" and any(term in text for term in ("会议", "客户", "方案", "项目", "讨论", "安排", "确认")):
        score += 0.9
    if category == "现代文章朗读" and not any(term in text for term in ("我", "你", "他", "她")):
        score += 0.25
    if any(term in text for term in ("播放", "歌曲", "音乐", "酒店", "停车场", "加油站", "路口站", "大厦", "商厦")):
        score -= 2.0
    if any(term in text for term in ("什么", "怎么样", "有没有")) and category == "现代文章朗读":
        score -= 0.5
    return score


def fits_category(category: str, text: str) -> bool:
    lowered = text.lower()
    if any(pattern in lowered for pattern in BLOCK_PATTERNS):
        return False
    if category == "车载与导航":
        has_anchor = any(
            term in text
            for term in (
                "导航",
                "开车",
                "车道",
                "高速",
                "停车",
                "加油站",
                "充电",
                "路口",
                "右转",
                "左转",
                "掉头",
                "限速",
                "车里",
                "空调",
                "安全带",
                "出发",
                "到达",
            )
        )
        has_action = any(term in text for term in ("请", "我", "我们", "先", "别", "不要", "可以", "提醒", "打开", "关闭", "调", "走", "去", "到", "停", "开", "靠", "转"))
        if "加油" in text and "加油站" not in text:
            return False
        if "空调" in text and not any(term in text for term in ("请", "帮", "给我", "替我", "调", "打开", "关闭", "启动", "开启")):
            return False
        looks_like_poi = any(term in text for term in ("大厦", "商厦", "集团", "石化", "花园", "酒店", "公路", "路口站", "停车场", "加油站")) and not has_action
        return has_anchor and has_action and not looks_like_poi
    if category == "会议与协作":
        return any(
            term in text
            for term in (
                "会议",
                "项目",
                "方案",
                "同事",
                "团队",
                "讨论",
                "协作",
                "安排",
                "进度",
                "风险",
                "确认",
                "汇报",
                "客户",
                "合同",
                "预算",
                "资料",
                "补充",
            )
        )
    if category == "看病与求助":
        has_medical_anchor = any(
            term in text
            for term in (
                "医生",
                "护士",
                "吃药",
                "用药",
                "急救",
                "生病",
                "发烧",
                "疼痛",
                "拉肚子",
                "排尿",
                "医院",
                "门诊",
                "急诊",
                "康复",
            )
        )
        has_usable_frame = any(term in text for term in ("我", "请", "需要", "可以", "帮", "告诉", "联系", "预约", "检查", "治疗", "服用", "记录", "门诊", "急诊"))
        return has_medical_anchor and has_usable_frame and not any(term in text for term in ("不相信", "好恐怖", "毒蛇", "肿瘤", "整形", "强忍", "报道", "系列"))
    if category == "日常与出行":
        if any(term in text for term in ("访问", "共享", "控制", "创建", "添加", "响应", "查找", "监测", "请求道路救援", "屏幕时间")):
            return False
        return any(term in text for term in ("我", "你", "您", "请", "可以", "需要", "帮", "去", "来", "先", "再", "告诉", "问", "等", "坐", "走", "付款", "地铁", "公交", "车站", "门口", "回家"))
    if category == "人群与角色":
        return any(term in text for term in ("我", "你", "您", "请", "老师", "同学", "妈妈", "爸爸", "朋友", "同事", "客服", "医生", "护士", "孩子", "家人", "客户"))
    if category == "设备与数字":
        has_device_anchor = any(
            term in text
            for term in (
                "电话",
                "手机",
                "短信",
                "蓝牙",
                "字幕",
                "音量",
                "提醒",
                "验证码",
                "密码",
                "号码",
                "分钟",
                "几点",
                "星期",
                "周一",
                "周二",
                "周三",
                "周四",
                "周五",
                "周六",
                "周日",
            )
        )
        has_action = any(term in text for term in ("我", "你", "请", "帮", "打开", "关闭", "调", "发", "读", "提醒", "告诉", "连接", "保存", "打电话", "发短信"))
        if any(term in text for term in ("工作人员", "保险", "老人家邀请", "事发", "越来越高", "更轻更薄")):
            return False
        return has_device_anchor and has_action
    if category == "现代文章朗读":
        return not any(term in text for term in ("播放", "我要听", "给我听", "来一首", "放首", "歌曲", "音乐", "酒店", "旅行社", "停车场", "加油站"))
    if category == "音系强化":
        return True
    return True


def load_scene_corpus(path: Path, audit: RejectionAudit) -> list[SourceItem]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows: list[SourceItem] = []
    for scene, scene_payload in payload.get("scenes", {}).items():
        category = SCENE_TO_CATEGORY.get(scene)
        if category is None:
            continue
        items = scene_payload.get("items", []) if isinstance(scene_payload, dict) else scene_payload
        for item in items:
            text = visible_text(str(item.get("text", "")))
            source_id = str(item.get("source_id", scene))
            reason = rejection_reason(text)
            if reason:
                audit.record(reason, text=text, source_id=source_id, category=str(scene))
                continue
            length = chinese_length(text)
            rows.append(
                SourceItem(
                    text=text,
                    category=category,
                    source_id=str(item.get("source_id", "unknown")),
                    source_ref=str(item.get("source_ref", path)),
                    score=float(item.get("total_score", 0.0)) + float(item.get("usage_score", 0.0)),
                    length=length,
                )
            )
    return rows


def load_phonology_corpus(path: Path, audit: RejectionAudit) -> list[SourceItem]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows: list[SourceItem] = []
    for item in payload.get("items", []):
        text = visible_text(str(item.get("text", "")))
        source_id = str(item.get("source_id", "phonology"))
        reason = rejection_reason(text)
        if reason:
            audit.record(reason, text=text, source_id=source_id, category="音系强化")
            continue
        rows.append(
            SourceItem(
                text=text,
                category=category_for_source(str(item.get("source_id", "phonology")), text),
                source_id=str(item.get("source_id", "phonology")),
                source_ref=str(item.get("source_ref", path)),
                score=float(item.get("total_score", 0.0)),
                length=chinese_length(text),
            )
        )
    return rows


def load_manifest(
    path: Path,
    per_source_cap: int,
    min_length: int,
    max_length: int,
    max_source_low_quality_ratio: float,
    audit: RejectionAudit,
) -> list[SourceItem]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows: list[SourceItem] = []
    for raw_entry in payload.get("sources", []):
        category_hint = raw_entry.get("category_hint") if isinstance(raw_entry, dict) else None
        spec = parse_source_entry(raw_entry)
        try:
            units, source_ref = iter_manifest_units(spec, raw_entry)
        except Exception as exc:
            print(f"[warn] 跳过 {spec.id}: {exc}")
            continue

        source_rows: list[SourceItem] = []
        seen: set[str] = set()
        reviewed_content_count = 0
        low_quality_count = 0
        for unit in units:
            visible = visible_text(unit)
            length = chinese_length(visible)
            if length < min_length or length > max_length:
                audit.record(
                    "length_out_of_range",
                    text=visible,
                    source_id=spec.id,
                    category=str(category_hint or "unclassified"),
                )
                continue
            reason = rejection_reason(visible, min_length, max_length)
            if reason:
                if reason in CONTENT_QUALITY_REJECTION_REASONS:
                    reviewed_content_count += 1
                    low_quality_count += 1
                audit.record(
                    reason,
                    text=visible,
                    source_id=spec.id,
                    category=str(category_hint or "unclassified"),
                )
                continue
            if visible in seen:
                audit.record(
                    "duplicate_within_source",
                    text=visible,
                    source_id=spec.id,
                    category=str(category_hint or "unclassified"),
                )
                continue
            if spec.id == "tatoeba_cmn_example_sentences" and not is_frontend_usable_example(visible):
                audit.record(
                    "not_frontend_usable_example",
                    text=visible,
                    source_id=spec.id,
                    category=str(category_hint or "unclassified"),
                )
                continue
            seen.add(visible)
            reviewed_content_count += 1
            category = str(category_hint) if category_hint in CATEGORY_ORDER else category_for_source(spec.id, visible)
            if not fits_category(category, visible):
                audit.record(
                    "category_mismatch_or_low_training_value",
                    text=visible,
                    source_id=spec.id,
                    category=category,
                )
                continue
            coverage_seed = build_length_score(length, min_length, max_length, min_length, max_length)
            source_rows.append(
                SourceItem(
                    text=visible,
                    category=category,
                    source_id=spec.id,
                    source_ref=source_ref,
                    score=(coverage_seed + content_quality_score(spec.id, visible, category)) * spec.priority * spec.usage_weight,
                    length=length,
                )
            )
        low_quality_ratio = (
            low_quality_count / reviewed_content_count if reviewed_content_count else 0.0
        )
        excluded = low_quality_ratio > max_source_low_quality_ratio
        audit.record_source_quality_decision(
            source_id=spec.id,
            reviewed_count=reviewed_content_count,
            low_quality_count=low_quality_count,
            threshold=max_source_low_quality_ratio,
            excluded=excluded,
            accepted_before_source_gate=len(source_rows),
        )
        if excluded:
            audit.record(
                "source_excluded_low_quality_ratio",
                text=(
                    f"source:{spec.id};low_quality={low_quality_count};"
                    f"reviewed={reviewed_content_count};ratio={low_quality_ratio:.4f}"
                ),
                source_id=spec.id,
                category=str(category_hint or "unclassified"),
            )
            print(
                f"[source-quality] 退出 {spec.id}: "
                f"{low_quality_count}/{reviewed_content_count}={low_quality_ratio:.2%} > "
                f"{max_source_low_quality_ratio:.2%}"
            )
            continue

        rows.extend(
            sorted(
                source_rows,
                key=lambda item: (
                    -item.score,
                    item.length,
                    repeat_signature(item.text),
                    stable_hash(f"{item.source_id}:{item.text}"),
                ),
            )[:per_source_cap]
        )
    return rows


def is_frontend_usable_example(text: str) -> bool:
    reject_terms = (
        "德国人",
        "法国人",
        "意大利人",
        "日本人",
        "英国人",
        "美国人",
        "总统",
        "政府",
        "战争",
        "杀",
        "死亡",
        "淹死",
        "毒",
        "偷",
        "罪",
        "宗教",
        "上帝",
        "法语",
        "德语",
        "英语",
        "美国",
        "法国",
        "西雅图",
        "温哥华",
        "希腊",
        "杰克",
        "变疯",
        "虐待动物",
        "拉我的腿",
        "月经",
        "抛弃",
        "税收",
        "戒酒",
        "戒烟",
        "吸烟",
        "职业是医生",
        "成为一名医生",
        "嫁给了一个医生",
        "视为村里",
        "动物园",
    )
    if any(term in text for term in reject_terms):
        return False

    usable_terms = (
        "我",
        "你",
        "您",
        "请",
        "可以",
        "能",
        "要",
        "想",
        "需要",
        "知道",
        "告诉",
        "帮",
        "吗",
        "哪",
        "什么",
        "怎么",
        "多少",
        "今天",
        "明天",
        "现在",
        "昨天",
        "电话",
        "房间",
        "门",
        "车",
        "火车",
        "公交",
        "车站",
        "钱",
        "医生",
        "护士",
        "老师",
        "同学",
        "朋友",
        "妈妈",
        "爸爸",
        "孩子",
        "服务生",
    )
    return any(term in text for term in usable_terms)


def iter_manifest_units(spec: Any, raw_entry: Any | None = None) -> tuple[Iterable[str], str]:
    if isinstance(raw_entry, dict) and isinstance(raw_entry.get("items"), list):
        return [str(item) for item in raw_entry["items"]], f"inline:{spec.id}"

    source = str(spec.source)
    if spec.id == "tatoeba_cmn_example_sentences" and source.endswith(".tsv"):
        return iter_tatoeba_rows(Path(source)), source
    if "aishell1" in spec.id.lower() or "aishell_transcript" in spec.id.lower():
        return iter_aishell1_transcripts(Path(source)), source
    if "aishell3" in spec.id.lower():
        return iter_aishell3_transcripts(Path(source)), source
    if "aishell4" in spec.id.lower() or "textgrid" in spec.id.lower():
        return iter_textgrid_transcripts(Path(source)), source
    if "wenetspeech" in spec.id.lower() or "wenet" in spec.id.lower():
        return iter_id_prefixed_transcripts(Path(source)), source

    text, source_ref = read_source(spec)
    return iter_sentence_units(text), source_ref


def iter_tatoeba_rows(path: Path) -> Iterator[str]:
    with path.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        for row in reader:
            if len(row) >= 2 and row[1] != "Simplified":
                yield row[1]


def iter_aishell1_transcripts(path: Path) -> Iterator[str]:
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            parts = line.strip().split()
            if len(parts) <= 1:
                continue
            yield "".join(parts[1:])


def iter_aishell3_transcripts(path: Path) -> Iterator[str]:
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            if "\t" not in line:
                continue
            _, transcript = line.split("\t", 1)
            yield extract_aishell3_characters(transcript)


def iter_id_prefixed_transcripts(path: Path) -> Iterator[str]:
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            parts = line.strip().split(maxsplit=1)
            if len(parts) == 2:
                yield parts[1]


def iter_textgrid_transcripts(path: Path) -> Iterator[str]:
    paths = sorted(path.rglob("*.TextGrid")) if path.is_dir() else [path]
    text_re = re.compile(r'text\s*=\s*"(.*?)"')
    for textgrid_path in paths:
        with textgrid_path.open("r", encoding="utf-8", errors="ignore") as handle:
            for line in handle:
                match = text_re.search(line)
                if not match:
                    continue
                cleaned = clean_textgrid_text(match.group(1))
                if cleaned:
                    yield from iter_sentence_units(cleaned)


def clean_textgrid_text(raw: str) -> str:
    text = raw.strip()
    if not text or text in {"<sil>", "<%>", "<#>", "<$>", "<->"}:
        return ""
    text = re.sub(r"<[^>]*>", "，", text)
    text = text.replace("&嗯&", "，").replace("&呃&", "，")
    text = re.sub(r"[嗯呃啊哦诶哎]{1,3}(?=[，。！？、\s]|$)", "，", text)
    text = re.sub(r"[，,、]{2,}", "，", text)
    return text.strip("，,、。！？!?\t ")


def extract_aishell3_characters(raw: str) -> str:
    chars: list[str] = []
    for token in raw.strip().split():
        if len(token) == 1 and "\u4e00" <= token <= "\u9fff":
            chars.append(token)
    return "".join(chars)


def repeat_signature(text: str) -> str:
    signature = text
    signature = re.sub(r"[零一二三四五六七八九十百千万亿两幺]+", "数", signature)
    signature = re.sub(r"第[数]+", "第数", signature)
    signature = re.sub(r"空调(温度)?(调到|调为|调成|提高到|打到|切换到|设为|启动|开启)?数(度)?", "空调温度数", signature)
    signature = re.sub(r"[年月日号点分秒周星期公里元块楼层号]", "量", signature)
    signature = re.sub(r"(我|你|您|他|她|我们|你们|他们|大家)", "人", signature)
    signature = re.sub(r"(医生|护士|老师|同学|妈妈|爸爸|朋友|同事|客服|司机|乘务员)", "角色", signature)
    signature = re.sub(r"(孩子|小孩子|儿童|学生|女孩子)", "孩子", signature)
    signature = re.sub(r"(客户儿|客户|顾客|主播|员工|部门儿|部门)", "角色", signature)
    signature = re.sub(r"(北京|上海|广州|深圳|杭州|南京|武汉|成都|重庆|天津|河南|河北|山东|山西|江苏|浙江|广东|广西|四川|云南|贵州|陕西|甘肃|新疆|西藏|内蒙古|辽宁|吉林|黑龙江|福建|江西|湖南|湖北|海南|宁夏|青海)", "地名", signature)
    return signature


def stable_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()


def topic_signature(text: str) -> str:
    for topic, terms in {
        "孩子": ("孩子", "小孩子", "儿童", "女孩子", "学生", "同学"),
        "医生": ("医生", "护士", "吃药", "用药", "治疗", "生病", "症状"),
        "手机": ("手机", "电话", "短信", "音量", "密码", "设备"),
        "客户": ("客户", "顾客", "项目", "方案", "会议", "工作"),
        "车载": ("开车", "空调", "停车", "导航", "安全带", "充电"),
    }.items():
        if any(term in text for term in terms):
            return f"topic:{topic}"
    return f"topic:misc:{repeat_signature(text)[:6]}"


def is_phonology_source(source_id: str) -> bool:
    lowered = source_id.lower()
    return any(marker in lowered for marker in PHONOLOGY_SOURCE_MARKERS) or "aishell_transcript" in lowered


def phonology_score(text: str, source_id: str) -> float:
    coverage = build_coverage_scores([text]).get(text, 0.0)
    unique_ratio = len(set(text)) / max(1, len(text))
    tone_like_bonus = 0.4 if any(char in text for char in "清轻声响韵音语读说听气") else 0.0
    source_bonus = 0.8 if is_phonology_source(source_id) else 0.0
    return round(coverage * 2.5 + unique_ratio + tone_like_bonus + source_bonus, 6)


def clone_as_phonology(row: SourceItem) -> SourceItem:
    return SourceItem(
        text=row.text,
        category="音系强化",
        source_id=row.source_id,
        source_ref=row.source_ref,
        score=row.score + phonology_score(row.text, row.source_id),
        length=row.length,
    )


def rebalance(rows: list[SourceItem], caps: dict[str, int], signature_cap: int) -> dict[str, list[SourceItem]]:
    deduped: dict[str, SourceItem] = {}
    coverage_scores = build_coverage_scores([row.text for row in rows])

    for row in rows:
        if row.category == "音系强化":
            continue
        score = row.score + coverage_scores.get(row.text, 0.0) * 2
        boosted = SourceItem(
            text=row.text,
            category=row.category,
            source_id=row.source_id,
            source_ref=row.source_ref,
            score=round(score, 6),
            length=row.length,
        )
        key = row.text
        previous = deduped.get(key)
        if previous is None or boosted.score > previous.score:
            deduped[key] = boosted

    grouped: dict[str, list[SourceItem]] = {category: [] for category in CATEGORY_ORDER}
    for row in deduped.values():
        if row.category in grouped:
            grouped[row.category].append(row)

    balanced: dict[str, list[SourceItem]] = {}
    used_texts: set[str] = set()
    for category in [item for item in CATEGORY_ORDER if item != "音系强化"]:
        category_rows = grouped.get(category, [])
        ordered = sorted(
            category_rows,
            key=lambda item: (
                -item.score,
                item.source_id,
                item.length,
                stable_hash(f"{item.source_id}:{item.text}"),
            ),
        )
        soft_cap = CATEGORY_SOURCE_SOFT_CAPS.get(category)
        selected: list[SourceItem] = []
        deferred: list[SourceItem] = []
        source_counts: dict[str, int] = {}
        signature_counts: dict[str, int] = {}
        for item in ordered:
            if len(selected) >= caps[category]:
                break
            if item.text in used_texts:
                continue
            count = source_counts.get(item.source_id, 0)
            signature = repeat_signature(item.text)
            signature_count = signature_counts.get(signature, 0)
            source_allowed = soft_cap is None or count < soft_cap
            if source_allowed and signature_count < signature_cap:
                selected.append(item)
                used_texts.add(item.text)
                source_counts[item.source_id] = count + 1
                signature_counts[signature] = signature_count + 1
            else:
                deferred.append(item)

        if len(selected) < caps[category]:
            for item in deferred:
                if len(selected) >= caps[category]:
                    break
                if item.text in used_texts:
                    continue
                signature = repeat_signature(item.text)
                signature_count = signature_counts.get(signature, 0)
                if signature_count >= max(signature_cap + 2, signature_cap * 2):
                    continue
                selected.append(item)
                used_texts.add(item.text)
                signature_counts[signature] = signature_count + 1

        balanced[category] = selected[: caps[category]]

    phonology_candidates = sorted(
        (
            clone_as_phonology(row)
            for row in deduped.values()
            if row.text not in used_texts and is_phonology_source(row.source_id)
        ),
        key=lambda item: (-item.score, item.length, stable_hash(f"{item.source_id}:phonology:{item.text}")),
    )
    selected_phonology: list[SourceItem] = []
    source_counts: dict[str, int] = {}
    signature_counts: dict[str, int] = {}
    topic_counts: dict[str, int] = {}
    for item in phonology_candidates:
        if len(selected_phonology) >= caps["音系强化"]:
            break
        count = source_counts.get(item.source_id, 0)
        signature = repeat_signature(item.text)
        signature_count = signature_counts.get(signature, 0)
        topic = topic_signature(item.text)
        topic_count = topic_counts.get(topic, 0)
        soft_cap = CATEGORY_SOURCE_SOFT_CAPS.get("音系强化")
        if soft_cap is not None and count >= soft_cap:
            continue
        if signature_count >= signature_cap:
            continue
        if topic_count >= 280:
            continue
        selected_phonology.append(item)
        source_counts[item.source_id] = count + 1
        signature_counts[signature] = signature_count + 1
        topic_counts[topic] = topic_count + 1
        used_texts.add(item.text)

    balanced["音系强化"] = selected_phonology
    return balanced


def frontend_payload(
    grouped: dict[str, list[SourceItem]],
    args: argparse.Namespace,
    audit: RejectionAudit,
) -> dict[str, Any]:
    categories: dict[str, Any] = {}
    sources: dict[str, int] = {}
    for category in CATEGORY_ORDER:
        items = []
        for index, item in enumerate(grouped.get(category, []), start=1):
            sources[item.source_id] = sources.get(item.source_id, 0) + 1
            items.append(
                {
                    "id": f"{category}_source_{index:04d}",
                    "text": item.text,
                    "category": category,
                }
            )
        categories[category] = {
            "count": len(items),
            "items": items,
        }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "kind": "source_extracted_mandarin_training_corpus",
        "generated_from": {
            "builder": "scripts/corpus/export_frontend_source_corpus.py",
            "scene_corpora": [str(path) for path in args.scene_corpus],
            "phonology_corpora": [str(path) for path in args.phonology_corpus],
            "manifests": [str(path) for path in args.manifest],
            "source_item_counts": dict(sorted(sources.items())),
            "rejection_audit": audit.to_payload(),
        },
        "policy": {
            "template_generation": False,
            "length_range": [args.min_length, args.max_length],
            "source_text_only": True,
            "filters": [
                "target 7-18 visible Chinese characters",
                "reject ASCII/digits in frontend prompts",
                "reject page/navigation/metadata fragments and app-store boilerplate",
                "reject classical/old-style fragments after removing the classical category",
                "reject sensitive news crime/death/political/religious fragments",
                "reject advertising, exam-prep, livestream and commercial promotion fragments",
                "reject adult/sexual anatomy fragments not designed as reviewed clinical prompts",
                "reject finance, real-estate, entertainment and organization-name fragments",
                "reject ASR disfluency, duplicated syllables and incomplete spoken fragments",
                "review every source sentence and exclude a source when substantive low-quality content exceeds 20%",
                "reject dangling Chinese function-word prefixes/suffixes",
                "dedupe globally by target text before frontend merge",
                "limit near-duplicate structural signatures per category",
                "select phonology reinforcement only from modern source transcripts",
                "soft-cap each source inside each category",
            ],
        },
        "categories": categories,
    }


def main() -> int:
    args = parse_args()
    caps = parse_caps(args.cap)
    rows: list[SourceItem] = []
    audit = RejectionAudit()

    for path in args.scene_corpus:
        rows.extend(load_scene_corpus(path, audit))
    for path in args.phonology_corpus:
        rows.extend(load_phonology_corpus(path, audit))
    for path in args.manifest:
        rows.extend(
            load_manifest(
                path,
                args.per_source_cap,
                args.min_length,
                args.max_length,
                args.max_source_low_quality_ratio,
                audit,
            )
        )

    grouped = rebalance(rows, caps, args.signature_cap)
    payload = frontend_payload(grouped, args, audit)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    audit_output = args.audit_output or args.output.with_name(f"{args.output.stem}.audit.json")
    audit_output.write_text(
        json.dumps(audit.to_payload(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"已输出到 {args.output}")
    print(f"清理审计已输出到 {audit_output}")
    for category in CATEGORY_ORDER:
        print(f"{category}: {payload['categories'][category]['count']}")
    print("总数:", sum(payload["categories"][category]["count"] for category in CATEGORY_ORDER))
    print("拒绝总数:", sum(audit.counts.values()))
    for reason, count in audit.counts.most_common():
        print(f"拒绝 {reason}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
