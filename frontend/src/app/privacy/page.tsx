import Link from 'next/link'

const PRIVACY_ITEMS = [
  {
    title: '账号与身份',
    body: '燃言会保存你的登录账号、基础身份标识和必要的会话信息，用来确保训练数据、沟通档案和个人设置只归你自己所有。',
  },
  {
    title: '训练与沟通数据',
    body: '训练录音进入 dataset，沟通摘要和画像进入 memory。原始录音、原始 transcript 和长期画像不会混成一层来存。语音、转写、方言及病种属于敏感信息，仅在明确授权的功能范围内处理。',
  },
  {
    title: '商业用途与禁止用途',
    body: '在你单独勾选同意后，授权数据可用于模型训练、评测、产品改进和服务运营等商业用途。我们不会出售个人身份信息，不会把数据用于违法用途，也不会把商业授权默认为无限期或无限范围授权。',
  },
  {
    title: '撤回、删除与保留',
    body: '你可以停止录音、撤回尚未进入训练流程的样本，并通过账号支持渠道申请删除或导出。已完成匿名化、聚合或用于模型版本的部分可能无法逐条逆向删除；我们会在处理前说明保留期限和影响。',
  },
  {
    title: '最小必要原则',
    body: '默认只保存完成训练链路和个体化建议所需的数据。任何后续高风险动作都应该有明确边界，而不是被隐式打开。',
  },
  {
    title: '你的控制权',
    body: '你可以停止使用、重新登录、清理本地数据，或者在后续产品里进一步要求关闭上传与删除云端资产。产品不能把你的表达主导权拿走。',
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fffdf8_0%,_#fff9f1_56%,_#f6f5f0_100%)] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_80px_rgba(120,53,15,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-amber-700">VoxFlame / 用户隐私</p>
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">你的账号、训练数据和沟通档案怎么分开保存</h1>
          </div>
          <Link href="/login" className="rounded-full border border-stone-300 px-4 py-2 text-sm text-gray-700 transition hover:border-stone-400 hover:bg-stone-50">
            返回登录
          </Link>
        </div>

        <p className="mt-6 text-base leading-7 text-gray-600">
          燃言的默认原则不是多拿数据，而是只拿完成当前功能真正需要的最小信息。注册时会分别征得隐私、敏感信息处理、数据采集和商业用途授权；不同意商业用途不会影响你查看基础功能，但不能进入需要该授权的训练采集链路。
        </p>

        <div className="mt-8 space-y-4">
          {PRIVACY_ITEMS.map((item) => (
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
