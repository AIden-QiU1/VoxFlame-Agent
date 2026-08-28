import { sha256 } from 'js-sha256'
import type { MandarinTrainingExercise } from '@/lib/corpus/mandarin-training'

export type ReadingArticleDifficulty = '轻松' | '平稳' | '进阶'

export interface MandarinReadingSegment {
  id: string
  index: number
  text: string
  chineseCharacterCount: number
}

export interface MandarinReadingArticle {
  id: string
  version: string
  title: string
  summary: string
  theme: string
  difficulty: ReadingArticleDifficulty
  fullText: string
  source: {
    kind: 'voxflame_original'
    label: string
    license: 'internal_product_use'
    createdAt: string
    contentHash: string
  }
  segments: MandarinReadingSegment[]
}

type RawReadingArticle = readonly [
  title: string,
  theme: string,
  difficulty: ReadingArticleDifficulty,
  summary: string,
  seedSegments: readonly string[],
]

const ARTICLE_BRIDGE_SENTENCES = [
  '这段经历从眼前的小事展开，也留下了清楚的顺序。',
  '我把看到的细节记在心里，也留意事情之间自然的联系。',
  '每一步都不必着急，先把眼前的意思说清楚。',
  '这样的经历并不特别，却能让人发现稳定而温和的变化。',
  '当我们愿意停下来观察，熟悉的场景也会出现新的线索。',
  '我和身边的人一起完成这件小事，过程中多了一点理解。',
  '回头看看，原本分散的片刻已经连成了一段记忆。',
  '这件小事提醒我，认真生活就能发现值得珍惜的部分。',
] as const

function buildFullText(
  title: string,
  summary: string,
  theme: string,
  seedSegments: readonly string[],
): string {
  const opening = `《${title}》写的是${summary.replace(/。$/, '')}。作为${theme}中的一个普通片段，我从一个清楚的起点开始，把当时看到、听到和想到的事情按顺序说出来。`
  const body = seedSegments.map((segment, index) => {
    const bridge = ARTICLE_BRIDGE_SENTENCES[index % ARTICLE_BRIDGE_SENTENCES.length]
    return `${segment}。${bridge}`
  }).join('')
  const ending = '事情结束以后，我把重要的部分重新想了一遍，也提醒自己以后遇到类似情况时保持耐心。平常的经历值得被认真记录，因为它们组成了我们真实而具体的生活。'
  return `${opening}${body}${ending}`
}

const RAW_READING_ARTICLES: readonly RawReadingArticle[] = [
  ['清晨散步', '日常生活', '轻松', '沿着熟悉的小路慢慢醒来。', ['天刚亮时街道很安静', '树叶上还留着一点露水', '早餐店正在升起热气', '有人牵着小狗慢慢走', '我沿着河边的小路前行', '微风把困意轻轻吹散', '远处传来清脆的鸟鸣', '新的一天就这样开始']],
  ['阳台上的花', '日常生活', '轻松', '照料阳台植物的一段日常。', ['阳台上摆着几盆绿植', '清晨的阳光落在叶面', '我先摸摸泥土的湿度', '缺水的花需要慢慢浇', '新长的嫩芽颜色很浅', '枯黄的叶子轻轻剪掉', '小小花盆也有四季变化', '照料它们让人心里安静']],
  ['整理书桌', '日常生活', '轻松', '把凌乱的桌面重新整理好。', ['书桌上堆着几本旧杂志', '散落的纸张需要分类', '常用的笔放进浅色笔筒', '充电线沿着桌边收好', '不用的物品放回抽屉', '桌面渐渐露出原来颜色', '窗边留下一个阅读位置', '整齐以后做事更加从容']],
  ['午后的茶', '日常生活', '轻松', '给忙碌的午后留一点停顿。', ['午后的房间有些安静', '我烧开一壶清澈的水', '茶叶在杯中慢慢舒展', '淡淡香气随着热气升起', '窗外偶尔传来脚步声', '手边的工作先放一放', '喝茶不必追求复杂讲究', '片刻停顿也能恢复精神']],
  ['雨天回家', '日常生活', '平稳', '在细雨中平安走回家的过程。', ['傍晚忽然下起一阵细雨', '路面很快映出灯光', '我把雨伞稍微压低一些', '经过路口时放慢脚步', '鞋边溅起几滴清凉雨水', '屋檐下面有人短暂停留', '回到家先擦干外套', '窗外的雨声仍然很轻']],
  ['周末做饭', '日常生活', '平稳', '一起完成一顿简单的家常饭。', ['周末适合做一顿家常饭', '新鲜蔬菜先洗净沥水', '案板上的食材分开放好', '锅热以后再倒少量油', '厨房里渐渐有了香气', '家人帮忙摆好碗筷', '简单饭菜也值得认真准备', '大家坐下以后慢慢品尝']],
  ['窗边阅读', '日常生活', '轻松', '安静读完几页喜欢的书。', ['窗边的光线柔和明亮', '我翻开一本熟悉的书', '纸张带着淡淡的气味', '故事从一行文字开始', '读到喜欢的地方会停下', '有些句子值得再看一遍', '时间在安静中慢慢过去', '合上书时心里很充实']],
  ['晾晒衣服', '日常生活', '轻松', '把洗好的衣服晾到阳光下。', ['洗好的衣服带着清香', '阳台上的风刚刚合适', '我把衣角轻轻抖平', '衣架之间留出一点距离', '阳光穿过浅色的布料', '水珠沿着袖口慢慢落下', '傍晚衣服已经干爽', '收进屋里还带着暖意']],
  ['晚间收拾', '日常生活', '平稳', '在睡前把家里简单归整。', ['晚饭以后屋里亮起灯', '餐桌需要简单擦拭', '杯子洗净以后倒扣晾干', '明天要用的东西提前放好', '窗帘缓缓遮住夜色', '手机也该暂时放远一些', '睡前收拾不用追求完美', '整洁环境让休息更安心']],
  ['旧物盒子', '日常生活', '进阶', '从旧物中看见生活留下的痕迹。', ['柜子深处有一个纸盒', '里面放着许多旧物件', '褪色车票记着一次远行', '小小卡片写着温暖祝福', '有些照片已经微微卷边', '每件东西都有一段来历', '整理不是为了忘记过去', '而是给回忆找到合适位置']],

  ['河边的风', '自然观察', '轻松', '观察河岸、水面与轻风的变化。', ['河水沿着石岸缓缓流动', '风从开阔的水面吹来', '岸边芦苇轻轻摆动', '几只水鸟停在远处', '云影在水面慢慢移动', '偶尔有落叶顺流而下', '我站在桥边安静观看', '自然的变化从不匆忙']],
  ['春日新芽', '自然观察', '轻松', '发现春天刚刚到来的细节。', ['早春的风还有一点凉', '枝头已经冒出细小新芽', '草地颜色一天比一天深', '墙角开出几朵小花', '燕子从屋檐附近飞过', '泥土散发清新的气息', '季节变化藏在细节里面', '只要留心就能慢慢发现']],
  ['夏夜虫鸣', '自然观察', '平稳', '听见夏夜里丰富而安静的声音。', ['夏夜的空气温暖湿润', '树影落在安静的小院', '草丛里传来连续虫鸣', '声音忽远忽近很有层次', '一轮月亮升到屋顶上方', '晚风偶尔摇动窗边风铃', '人们说话也自然放轻', '夜色因此显得更加辽阔']],
  ['秋天的树', '自然观察', '平稳', '从一棵树看见秋季的变化。', ['秋风先改变树叶颜色', '绿色里面渐渐添了金黄', '阳光穿过稀疏的枝叶', '地上铺开柔软的落叶', '孩子弯腰挑选完整叶片', '清洁人员慢慢扫过小路', '树木正在准备安静过冬', '明年春天还会长出新叶']],
  ['冬日阳光', '自然观察', '轻松', '感受寒冷天气里温暖的阳光。', ['冬天的天空格外清澈', '阳光照在背上很温暖', '老人坐在墙边轻声聊天', '猫在台阶上蜷成一团', '晾晒的被子慢慢蓬松', '风里仍有明显的凉意', '人们珍惜这段明亮时光', '平常日子也有温柔光亮']],
  ['山间小路', '自然观察', '进阶', '沿着山间小路稳稳向前。', ['山间小路绕过一片树林', '石阶被雨水洗得干净', '脚下偶尔响起枯枝声', '高处可以看见远方村庄', '我们走累了就在亭中休息', '清风带来草木的气息', '登山不必一直追赶速度', '稳稳向前也能到达高处']],
  ['海边清晨', '自然观察', '平稳', '在清晨看海浪与天空渐渐明亮。', ['海边清晨带着淡淡雾气', '浪花一层接一层靠岸', '沙滩留下弯曲的水线', '远处渔船缓慢移动', '太阳从云层后面露出', '天空逐渐变得明亮', '海风吹乱额前的头发', '眼前景色让人心胸开阔']],
  ['云的旅行', '自然观察', '进阶', '跟随一片云想象它经过的地方。', ['一片白云越过城市上空', '它先看见密集的屋顶', '随后飘向开阔的田野', '风让它不断改变形状', '有时像船有时像山', '傍晚云边染上暖色', '夜里它会去往哪里', '也许明天出现在另一座城']],
  ['雨后的公园', '自然观察', '平稳', '雨停后重新走进清新的公园。', ['阵雨刚停公园很清新', '石板路上还有浅浅积水', '树叶被冲洗得格外明亮', '空气里带着湿润泥土味', '孩子小心绕开水洼', '长椅上的雨珠慢慢蒸发', '阳光重新落在草地上', '公园很快恢复往日活力']],
  ['田野傍晚', '自然观察', '进阶', '观察田野从明亮走向黄昏。', ['傍晚的田野十分开阔', '整齐作物延伸到远处', '劳作的人准备收好工具', '小路上响起归家的车铃', '晚霞把云层染成暖红色', '鸟群从天空快速掠过', '村庄的灯一盏盏亮起', '一天在平静中慢慢结束']],

  ['邻里问候', '社区生活', '轻松', '从一句问候开始熟悉身边的人。', ['早上出门遇见楼上邻居', '我们笑着互相问声早', '电梯里不再只有沉默', '偶尔也会聊聊天气', '谁家有事大家顺手帮忙', '快递放错也能及时提醒', '简单问候拉近彼此距离', '熟悉社区让生活更安心']],
  ['社区花园', '社区生活', '平稳', '大家一起维护共享的小花园。', ['楼下有一块小小花园', '居民轮流照看花草', '有人松土有人清理落叶', '孩子给新苗挂上名字', '休息长椅重新刷了颜色', '经过的人都会放慢脚步', '公共空间需要共同爱护', '一点付出换来长久美好']],
  ['图书角落', '社区生活', '轻松', '在社区里共享阅读的快乐。', ['社区大厅有一个图书角', '书架不高方便大家取阅', '旧书旁边贴着分类标签', '借阅只需做好简单登记', '有人放下读完的故事书', '也有人带走一本新读物', '书籍在不同家庭间流动', '阅读因此多了一份分享']],
  ['安静楼道', '社区生活', '平稳', '共同保持楼道安全与整洁。', ['楼道是大家共同的通道', '门口杂物需要及时收好', '夜间说话可以放轻声音', '照明损坏要尽快报修', '雨天注意擦掉地面水迹', '老人孩子经过更加安全', '彼此体谅并不需要提醒', '安静整洁让邻里更舒适']],
  ['旧衣分享', '社区生活', '平稳', '让闲置衣物继续发挥作用。', ['换季时整理出一些旧衣', '完好衣物洗净以后叠好', '不同尺寸分别装进袋子', '社区设置了固定收集点', '工作人员会再次检查分类', '合适物品能够继续使用', '分享不是随意丢掉东西', '认真整理才是尊重他人']],
  ['便民雨伞', '社区生活', '轻松', '一把共享雨伞带来的小方便。', ['服务台旁放着几把雨伞', '突遇下雨的人可以借用', '伞柄贴着清楚的编号', '用完晾干以后及时归还', '简单安排解决临时困难', '也让陌生人感到被照顾', '公共便利依靠大家维护', '守约会让善意继续流动']],
  ['周末活动', '社区生活', '平稳', '参加一场轻松的社区活动。', ['周末广场举办小型活动', '桌上摆着纸笔和手工作品', '居民可以自由选择参加', '有人教孩子折纸画画', '老人围坐分享种花经验', '新搬来的住户认识了朋友', '活动不必安排得很复杂', '轻松交流就是最好收获']],
  ['失物招领', '社区生活', '进阶', '一次完整而清楚的失物归还。', ['门卫捡到一个蓝色布包', '他先查看外面是否有姓名', '随后登记发现时间地点', '广播没有透露私人物品', '失主说明包内主要特征', '核对无误以后签字领回', '规范流程保护每个人', '诚实也让社区更加可信']],
  ['楼下修路', '社区生活', '进阶', '面对临时施工时互相提醒和绕行。', ['楼下小路正在进行维修', '入口提前放置清楚提示', '行人需要从另一侧绕行', '施工人员保持通道整洁', '噪声较大时会提前告知', '居民出门也预留更多时间', '短暂不便换来长期安全', '互相理解让过程更顺利']],
  ['共享长椅', '社区生活', '平稳', '一张长椅连接不同人的片刻。', ['树下长椅每天都有人坐', '清晨属于出来锻炼的人', '中午有人在这里短暂休息', '傍晚孩子围着它做游戏', '木板旧了就及时修补', '旁边始终保持干净', '小小设施承载许多日常', '也让社区显得温暖可亲']],

  ['学习新词', '学习成长', '轻松', '用轻松的方法积累新的词语。', ['阅读时遇到一个陌生词', '我先结合上下文猜意思', '再用词典核对准确解释', '读音和例句一起记下', '当天试着用它说句话', '几天以后再回头复习', '学习不用一次记住全部', '反复使用就会逐渐熟悉']],
  ['练习书写', '学习成长', '平稳', '通过稳定练习改善书写。', ['我准备一本简单练习册', '每天只写短短一页', '落笔之前先看清结构', '横竖之间留出合适距离', '写错了也不用急着擦掉', '旁边再写一次作为比较', '稳定练习比速度更重要', '一段时间后变化自然出现']],
  ['第一次演讲', '学习成长', '进阶', '为第一次公开表达做好准备。', ['第一次演讲难免有些紧张', '我先把重点写成短句', '开头只需要说清楚主题', '每段之间留一点停顿', '忘词时可以看看提示卡', '台下目光不一定是压力', '讲完以后认真听取建议', '下一次会比这次更从容']],
  ['请教问题', '学习成长', '平稳', '把困惑说清楚并获得帮助。', ['遇到难题不要一直猜测', '先整理自己已经知道的部分', '再标出真正不懂的位置', '请教时把问题说得具体', '对方更容易给出有效建议', '听完以后用自己的话复述', '确认理解没有出现偏差', '一次提问也能训练思考']],
  ['小组合作', '学习成长', '进阶', '在小组任务中清楚分工并互相支持。', ['小组任务需要先明确目标', '大家分别说说擅长的部分', '分工以后约定完成时间', '遇到变化及时互相说明', '不同意见先听完再讨论', '重要决定写进共同记录', '合作不是把任务简单拆开', '而是让每个人都能参与']],
  ['复习计划', '学习成长', '平稳', '制定一份能够坚持的复习安排。', ['复习开始前先列出范围', '熟悉内容可以快速浏览', '薄弱部分安排更多时间', '每次任务不要定得太满', '完成一项就做一个记号', '中间也要留出休息时间', '计划可以根据进度调整', '能够坚持才是真正有效']],
  ['观察记录', '学习成长', '平稳', '用简短记录保存每天的发现。', ['老师让我们观察一棵树', '我每天在同一时间经过', '先看叶片颜色和数量', '再记天气与光线变化', '偶尔画下枝条的大致形状', '连续记录比印象更可靠', '几周以后整理全部内容', '细微变化组成完整过程']],
  ['学会倾听', '学习成长', '进阶', '把倾听作为理解和合作的一部分。', ['倾听不只是保持安静', '还要留意对方真正重点', '不明白时可以礼貌确认', '不要急着替别人说完', '回应之前先停一下', '让对方知道自己被听见', '好的交流需要来回配合', '认真倾听也是一种表达']],
  ['尝试新技能', '学习成长', '平稳', '从小步骤开始掌握陌生技能。', ['学习新技能总有陌生阶段', '先从最基础动作开始', '看懂以后再亲手试一次', '失败时记录具体问题', '下一轮只调整一个地方', '不要同时追求速度和完美', '小小进步也值得看见', '持续练习会带来稳定变化']],
  ['整理笔记', '学习成长', '轻松', '把零散内容整理成清楚的线索。', ['课后笔记有些零散', '我先补上当天日期主题', '相近内容放在同一部分', '重点句用简单符号标出', '不清楚的地方留下问号', '例子写在概念旁边', '整理过程也是再次复习', '清楚笔记方便以后查找']],

  ['第一次乘船', '出行见闻', '平稳', '记录一次平稳而新鲜的乘船经历。', ['码头上吹着清凉的风', '我们提前看好登船时间', '工作人员核对以后放行', '船离岸时水面泛起波纹', '两边景色缓缓向后移动', '偶尔有白鸟贴着水面飞过', '到站提示响起以后准备下船', '第一次乘船新鲜又平稳']],
  ['古镇小巷', '出行见闻', '进阶', '慢慢走过古镇安静的小巷。', ['古镇小巷铺着青色石板', '屋檐下面挂着木制招牌', '老人坐在门前整理竹篮', '水渠沿着街边缓缓流过', '游客经过时自然放慢脚步', '转角常能看见小桥', '旧建筑保留生活的痕迹', '安静行走比匆忙拍照更有趣']],
  ['车站等待', '出行见闻', '平稳', '在车站有序等待一次出发。', ['车站大厅来往的人很多', '电子屏不断更新车次信息', '我提前找到对应检票口', '行李始终放在身边', '广播响起时认真听清内容', '开始检票以后依次前行', '找到座位再把行李放稳', '准备充分让旅途更加轻松']],
  ['城市夜景', '出行见闻', '进阶', '从高处观察城市夜晚的层次。', ['夜幕落下城市亮起灯光', '道路像长长的光带', '高楼窗户明暗各不相同', '远处桥梁勾出清楚轮廓', '车辆沿着街道稳定流动', '河面映出不断变化的颜色', '热闹里面也有安静角落', '城市夜晚展现另一种节奏']],
  ['乡间公交', '出行见闻', '平稳', '乘公交经过开阔安静的乡间。', ['乡间公交经过很多小站', '司机熟悉每一段道路', '窗外从房屋变成田野', '乘客在熟悉路口下车', '老人上车时大家耐心等待', '行李放稳以后车辆再开动', '这条线路连接附近村庄', '也连接许多普通人的日常']],
  ['博物馆一天', '出行见闻', '进阶', '有重点地参观一座博物馆。', ['博物馆大厅宽敞明亮', '入口处可以领取参观地图', '我们先选择感兴趣的展厅', '说明文字帮助理解展品', '遇到重点内容就多停一会', '疲劳时到休息区坐坐', '参观不必一次看完所有', '记住几个故事已经很有收获']],
  ['湖边骑行', '出行见闻', '平稳', '沿湖稳稳骑过一段轻松路线。', ['湖边骑行路线平坦开阔', '出发前先检查车胎刹车', '头盔带子需要调整合适', '经过行人时提前减速', '休息点可以补水看风景', '长坡路段保持稳定节奏', '同伴之间不要相隔太远', '安全到达比追求速度重要']],
  ['迷路以后', '出行见闻', '进阶', '发现走错路后冷静重新确认方向。', ['走出地铁才发现方向不对', '我先停在不挡路的位置', '打开地图确认当前地点', '再寻找明显建筑作为参照', '不确定时请路人帮忙说明', '对方指向前方第二个路口', '多走一段并不算大问题', '冷静确认很快就能回到路线']],
  ['清晨航班', '出行见闻', '进阶', '为一次清晨出发做好从容准备。', ['清晨航班需要提前准备', '证件和行李昨晚已经检查', '出门时街道还没有完全亮', '到达以后先确认办理区域', '随身物品按要求整理好', '通过检查再寻找登机口', '等待期间留意屏幕变化', '从容安排能减少旅途慌乱']],
  ['公园野餐', '出行见闻', '轻松', '带着简单食物到公园度过午后。', ['天气晴朗适合公园野餐', '我们带了简单食物和清水', '树荫下面找到平坦位置', '铺好垫子再摆放物品', '大家边吃边聊最近见闻', '风大时及时收好纸张', '离开前清理全部垃圾', '轻松午后留下愉快记忆']],

  ['一封感谢信', '关系与表达', '平稳', '认真写下对他人的感谢。', ['我想给一位朋友写信', '先回想他曾经给的帮助', '感谢需要说清具体事情', '不必使用太华丽的词语', '真实感受已经足够珍贵', '写完以后再轻声读一遍', '确认没有遗漏重要内容', '一封短信也能传递温暖']],
  ['久别重逢', '关系与表达', '进阶', '与老朋友重逢时分享彼此近况。', ['多年不见的朋友回到这里', '我们约在熟悉的街角见面', '第一眼仍能认出彼此', '过去故事很快打开话题', '大家也分享现在的生活', '时间改变了许多事情', '真诚关系却没有因此变淡', '分别时已经约好下次再见']],
  ['一起解决', '关系与表达', '进阶', '面对分歧时把问题放在共同目标上。', ['两个人难免有不同想法', '先把各自担心说清楚', '不要把问题变成互相责怪', '共同目标仍然放在前面', '可以分别提出解决办法', '再比较每种办法的影响', '愿意调整才能找到平衡', '一起解决比争输赢更重要']],
  ['耐心等待', '关系与表达', '平稳', '在对方需要时间时给予空间。', ['朋友今天显得有些沉默', '我没有马上追问原因', '只是告诉他我愿意听', '需要安静也完全可以', '过了一会他主动开口', '我先听完再慢慢回应', '关心不一定要不断提问', '给人空间也是一种陪伴']],
  ['共同回忆', '关系与表达', '轻松', '从旧照片中分享一段共同记忆。', ['相册里有一张旧照片', '大家站在一棵大树下面', '那天阳光好像特别明亮', '有人记得当时说过的笑话', '也有人补充遗漏的细节', '同一件事有不同记忆', '拼在一起就更加完整', '共同回忆让关系更加亲近']],
  ['认真道歉', '关系与表达', '进阶', '清楚说明错误并承担相应责任。', ['发现做错以后应该及时说明', '道歉先承认具体影响', '不要急着寻找外部理由', '也不要要求对方立刻原谅', '能够补救的事情尽快去做', '以后如何避免也要说清楚', '真诚需要落实在行动里面', '认真修复才能重新建立信任']],
  ['一次鼓励', '关系与表达', '平稳', '用具体而温和的话支持身边的人。', ['同伴正在学习一项新技能', '开始阶段进展并不明显', '我看到他每天都在坚持', '于是说出具体的变化', '鼓励不是空泛地说加油', '而是帮助看见已经做到的事', '小小肯定能够增加信心', '继续前进也会更有力量']],
  ['家庭会议', '关系与表达', '进阶', '一家人平静讨论共同安排。', ['周末大家坐下讨论安排', '每个人先说自己的需要', '老人孩子也有表达机会', '时间冲突就一起调整', '重要事项写在日历上', '谁负责什么当场确认', '家庭会议不必过于正式', '说清楚以后生活更加顺畅']],
  ['分享好消息', '关系与表达', '轻松', '把一件开心的小事告诉朋友。', ['今天发生了一件开心小事', '我想马上告诉好朋友', '先说结果再讲事情经过', '对方听完也替我高兴', '我们聊起为此付出的努力', '快乐在分享以后变得更大', '普通日子也值得认真庆祝', '好消息给生活增添亮色']],
  ['给未来的自己', '关系与表达', '进阶', '写下现在的愿望与对未来的提醒。', ['我给未来的自己写几句话', '记录此刻正在努力的事情', '也写下最近真实的感受', '不要求每个愿望都能实现', '只希望以后记得这段过程', '遇到困难时别轻易否定自己', '保持好奇也照顾身体和心情', '慢慢走也会靠近想去的地方']],
]

export function countChineseCharacters(text: string): number {
  return Array.from(text).filter((character) => /\p{Script=Han}/u.test(character)).length
}

/**
 * 将文章母版切成适合单次朗读的短句。优先使用句号、分号和逗号等自然停顿，
 * 只有在单个停顿单元仍超过 16 字时才按长度切分；标点保留在录音目标中。
 */
export function splitReadingArticleIntoSegments(fullText: string): string[] {
  const normalized = fullText.replace(/\s+/gu, '').trim()
  if (!normalized) return []

  const sentenceUnits = normalized.match(/[^。！？；]+[。！？；]?/gu) ?? []
  const chunks: string[] = []

  for (const sentence of sentenceUnits) {
    const clauses = sentence.match(/[^，、：]+[，、：]?/gu) ?? [sentence]
    let current = ''
    for (const clause of clauses) {
      const candidate = `${current}${clause}`
      if (countChineseCharacters(candidate) <= 16) {
        current = candidate
        continue
      }
      if (current) chunks.push(current)
      current = clause
      if (countChineseCharacters(current) <= 16) continue

      let remainder = current
      while (countChineseCharacters(remainder) > 16) {
        const characters = Array.from(remainder)
        let cutAt = characters.length
        let count = 0
        for (let index = 0; index < characters.length; index += 1) {
          if (/\p{Script=Han}/u.test(characters[index])) count += 1
          if (count === 12) {
            cutAt = index + 1
            break
          }
        }
        chunks.push(characters.slice(0, cutAt).join(''))
        remainder = characters.slice(cutAt).join('')
      }
      current = remainder
    }
    if (current) chunks.push(current)
  }

  // 合并过短的尾部，避免出现只有一两个字的录音目标。
  const merged: string[] = []
  for (const chunk of chunks) {
    const count = countChineseCharacters(chunk)
    if (count < 6 && merged.length > 0) {
      const previous = merged[merged.length - 1]
      if (countChineseCharacters(previous) + count <= 16) {
        merged[merged.length - 1] = `${previous}${chunk}`
        continue
      }
    }
    merged.push(chunk)
  }

  // 从过长的前一段借出汉字，保证每个录音目标至少六字，同时不改变全文顺序。
  for (let index = 1; index < merged.length; index += 1) {
    const currentCount = countChineseCharacters(merged[index])
    if (currentCount >= 6) continue
    const previous = merged[index - 1]
    const previousCharacters = Array.from(previous)
    const movable = Math.min(6 - currentCount, Math.max(0, countChineseCharacters(previous) - 6))
    if (movable === 0) continue
    let moved = 0
    let cutAt = previousCharacters.length
    for (let characterIndex = previousCharacters.length - 1; characterIndex >= 0; characterIndex -= 1) {
      if (/\p{Script=Han}/u.test(previousCharacters[characterIndex])) {
        moved += 1
        if (moved === movable) {
          cutAt = characterIndex
          break
        }
      }
    }
    merged[index - 1] = previousCharacters.slice(0, cutAt).join('')
    merged[index] = `${previousCharacters.slice(cutAt).join('')}${merged[index]}`
  }

  // 极少数情况下最后一段仍过短，优先并入前一段；无法并入时保留并由 validator 报错。
  if (merged.length > 1 && countChineseCharacters(merged[merged.length - 1]) < 6) {
    const last = merged.pop() as string
    const previous = merged[merged.length - 1]
    if (countChineseCharacters(previous) + countChineseCharacters(last) <= 16) {
      merged[merged.length - 1] = `${previous}${last}`
    } else {
      merged.push(last)
    }
  }

  return merged
}

function createArticle(raw: RawReadingArticle, index: number): MandarinReadingArticle {
  const [title, theme, difficulty, summary, seedSegments] = raw
  const id = `reading-${String(index + 1).padStart(3, '0')}`
  const fullText = buildFullText(title, summary, theme, seedSegments)
  const segmentTexts = splitReadingArticleIntoSegments(fullText)
  const segments = segmentTexts.map((text, segmentIndex) => ({
    id: `${id}-v2-segment-${String(segmentIndex + 1).padStart(2, '0')}`,
    index: segmentIndex,
    text,
    chineseCharacterCount: countChineseCharacters(text),
  }))

  return {
    id,
    version: '2.0.0',
    title,
    summary,
    theme,
    difficulty,
    fullText,
    source: {
      kind: 'voxflame_original',
      label: '燃言原创标准现代汉语朗读材料',
      license: 'internal_product_use',
      createdAt: '2026-08-28',
      contentHash: `sha256:${sha256(fullText)}`,
    },
    segments,
  }
}

export const MANDARIN_READING_ARTICLES: readonly MandarinReadingArticle[] =
  RAW_READING_ARTICLES.map(createArticle)

export function getReadingArticle(articleId: string): MandarinReadingArticle | null {
  return MANDARIN_READING_ARTICLES.find((article) => article.id === articleId) ?? null
}

export function getReadingArticleExercises(
  article: MandarinReadingArticle,
): MandarinTrainingExercise[] {
  return article.segments.map((segment) => ({
    id: segment.id,
    text: segment.text,
    category: '现代文章朗读',
    prompt_type: 'short_sentence',
  }))
}

export function validateReadingArticles(
  articles: readonly MandarinReadingArticle[],
): string[] {
  const errors: string[] = []
  const articleIds = new Set<string>()
  const titles = new Set<string>()
  const segmentIds = new Set<string>()

  if (articles.length < 50 || articles.length > 100) {
    errors.push(`材料篇数必须在50到100之间，当前为${articles.length}`)
  }

  for (const article of articles) {
    if (articleIds.has(article.id)) errors.push(`文章ID重复：${article.id}`)
    if (titles.has(article.title)) errors.push(`文章标题重复：${article.title}`)
    articleIds.add(article.id)
    titles.add(article.title)

    const fullTextCount = countChineseCharacters(article.fullText)
    if (fullTextCount < 180) {
      errors.push(`${article.id}全文至少需要180个汉字，当前为${fullTextCount}`)
    }
    if (article.segments.length < 15) {
      errors.push(`${article.id}切分后至少需要15个片段，当前为${article.segments.length}`)
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(article.source.contentHash)) {
      errors.push(`${article.id}内容哈希格式错误`)
    }
    if (article.source.contentHash !== `sha256:${sha256(article.fullText)}`) {
      errors.push(`${article.id}内容哈希与全文不一致`)
    }
    const normalizedFullText = article.fullText.replace(/\s+/gu, '').trim()
    const normalizedSegments = article.segments.map((segment) => segment.text).join('').replace(/\s+/gu, '').trim()
    if (normalizedSegments !== normalizedFullText) {
      errors.push(`${article.id}片段未完整覆盖全文`)
    }

    const articleSegmentTexts = new Set<string>()
    for (const segment of article.segments) {
      if (segmentIds.has(segment.id)) errors.push(`片段ID重复：${segment.id}`)
      if (articleSegmentTexts.has(segment.text)) errors.push(`${article.id}片段文本重复：${segment.text}`)
      segmentIds.add(segment.id)
      articleSegmentTexts.add(segment.text)

      if (segment.index !== article.segments.indexOf(segment)) {
        errors.push(`${segment.id}片段序号不连续`)
      }

      const count = countChineseCharacters(segment.text)
      if (count !== segment.chineseCharacterCount) {
        errors.push(`${segment.id}字符计数不一致`)
      }
      if (count < 6 || count > 16) {
        errors.push(`${segment.id}需为6到16个汉字，当前为${count}`)
      }
    }
  }

  return errors
}
