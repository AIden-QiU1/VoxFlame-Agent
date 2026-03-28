import Link from 'next/link'

const DATA_COLLECTION_ITEMS = [
  {
    title: '录音样本会记录什么',
    body: '训练录音会带上 recording_id、session_id、分类、采样率、时长和录音格式等结构化字段，方便后续上传、补传和 dataset manifest 追踪。',
  },
  {
    title: '进入哪里',
    body: '录音样本会进入 dataset 对象存储与 manifest；它不是沟通档案，也不会直接被当成长时记忆。长期画像需要经过摘要和聚合后才进入 memory。',
  },
  {
    title: '断网时怎么办',
    body: '如果网络或对象存储异常，录音会先保存在本地待同步队列。这样做的目的是避免样本直接丢失，而不是偷偷上传。',
  },
  {
    title: '后续用途',
    body: '这些训练样本会用于训练工作台、语料整理、上传回执和后续个体化建议所依赖的数据骨架，而不是在页面里反复做历史展示。',
  },
]

export default function DataCollectionPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fffdf8_0%,_#fff8ef_58%,_#f6f4ee_100%)] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_80px_rgba(120,53,15,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-amber-700">VoxFlame / 数据采集说明</p>
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">训练录音如何进入 dataset，而不是变成页面里的旧历史</h1>
          </div>
          <Link href="/login" className="rounded-full border border-stone-300 px-4 py-2 text-sm text-gray-700 transition hover:border-stone-400 hover:bg-stone-50">
            返回登录
          </Link>
        </div>

        <p className="mt-6 text-base leading-7 text-gray-600">
          燃言的训练数据链路默认围绕 `recording envelope -> recorder queue -> upload receipt -> manifest`
          组织。重点是把训练样本沉淀成可追踪资产，而不是让训练页继续背“提交历史”叙事。
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
