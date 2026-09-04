import Link from 'next/link'
import { getSiteBrand } from '@/lib/site-branding'

const siteBrand = getSiteBrand()

const DATA_COLLECTION_ITEMS = [
  {
    title: '登录同意后怎么保存',
    body: '只要你在登录页确认了《用户隐私》和《数据采集说明》，训练页在录完后就会自动把目标句和录音音频送入监督样本链路，不再把“手动保存样本”做成主操作。',
  },
  {
    title: '录音样本会记录什么',
    body: '训练录音会带上 recording_id、session_id、分类、采样率、时长和录音格式等结构化字段，方便后续上传、补传和 dataset manifest 追踪。',
  },
  {
    title: '目标句和识别句怎么分',
    body: '监督训练样本真正保存的标签是当前目标句；前端识别出来的句子只用于即时反馈、样本诊断和质检，不会直接拿来替代监督标签，也不会因为“识别和目标差很多”就把这条完整录音挡在上传链路外。',
  },
  {
    title: '同一句会不会被去重',
    body: '不会按“同一句目标句”直接去重。同一句允许保留多次练习样本；系统只会对同一条录音的重复上传或补传做安全去重，避免 manifest 被重复写入。',
  },
  {
    title: '系统现在主要校验什么',
    body: '服务端会先检查时长、有效语音、静音、电平和削波等基础质量。明显异常的样本进入待复核状态，并保留人工质检接口和审计记录；识别文字与目标句不一致不会单独成为拒收依据。自动或人工质检都不会直接授权训练导入。',
  },
  {
    title: '进入哪里',
    body: '录音样本会进入 dataset 对象存储与 manifest；它不是沟通档案，也不会直接被当成长时记忆。长期画像需要经过摘要和聚合后才进入 memory。',
  },
  {
    title: '沟通页会不会默认上传',
    body: '不会。当前只有训练页录音会进入上传链；沟通页默认只做实时理解、纠错，并在会话结束后小幅更新用户个人画像，不默认上传原始沟通音频。以后如果要采集沟通样本，也必须走单独授权和单独数据路径。',
  },
  {
    title: '断网时怎么办',
    body: '如果上传登记链短暂波动，系统会先把这条录音转成后台自动补登任务，等链路恢复后继续完成 manifest 与回执，不再让训练页主路径出现手动同步。',
  },
  {
    title: '后续用途',
    body: '在你明确同意商业用途后，这些训练样本可用于模型训练、评测、产品改进和服务运营。我们不会出售个人身份信息，不会用于违法用途；身份资料、电话和证件号不会进入训练样本。',
  },
  {
    title: '授权、撤回与删除',
    body: '注册页会分别确认隐私、语音及健康相关敏感信息处理、数据采集和商业用途。你可以停止采集并申请撤回或删除；撤回不影响已经依法完成的匿名化、聚合统计或模型版本，但后续新样本会停止进入对应用途。',
  },
]

export default function DataCollectionPage() {
  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-amber-700">{siteBrand.name} / 数据采集说明</p>
            <h1 className="mt-2 text-balance text-3xl font-semibold text-gray-900">训练录音如何进入 dataset，而不是变成页面里的旧历史</h1>
          </div>
          <Link href="/login" className="rounded-full border border-stone-300 px-4 py-2 text-sm text-gray-700 transition hover:border-stone-400 hover:bg-stone-50">
            返回登录
          </Link>
        </div>

        <p className="mt-6 text-base leading-7 text-gray-600">
          {siteBrand.name}的训练数据链路默认围绕{' '}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[0.95em] text-stone-700">
            recording envelope -&gt; recorder queue -&gt; upload receipt -&gt; manifest
          </code>{' '}
          组织。重点是把训练样本沉淀成可追踪资产，而不是让训练页继续背“提交历史”叙事；登录授权一旦确认，训练页会优先按自动保存主路径工作。
        </p>

        <div className="mt-8 space-y-4">
          {DATA_COLLECTION_ITEMS.map((item) => (
            <section key={item.title} className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-5">
              <h2 className="text-lg font-semibold text-gray-900">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-700">{item.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
