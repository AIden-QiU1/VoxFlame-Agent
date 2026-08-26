import Link from 'next/link'

export default function OfflinePage() {
  return (
    <main className="min-h-dvh bg-stone-50 px-6 py-10 text-gray-900">
      <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0L15.536 15.536m2.828 2.828L21 21M9.88 9.88a3 3 0 014.243 4.243M3 3l18 18" />
            </svg>
          </div>

          <div className="mt-6 max-w-2xl">
            <p className="text-sm font-semibold text-amber-700">
              离线状态
            </p>
            <h1 className="mt-3 text-balance text-3xl font-semibold text-gray-950 sm:text-4xl">
              当前网络不可用，但燃言不会丢掉你的本地进度
            </h1>
            <p className="mt-4 text-pretty text-base leading-7 text-gray-600">
              已缓存的页面仍可打开。本地记忆、训练结果和待同步操作会在网络恢复后继续处理。
              实时沟通与上传依赖联网，因此离线时会暂时降级。
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Link
              href="/"
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-medium text-amber-900 transition hover:border-amber-300 hover:bg-amber-100"
            >
              返回首页
            </Link>
            <Link
              href="/practice"
              className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm font-medium text-stone-900 transition hover:border-stone-300 hover:bg-stone-100"
            >
              查看训练页
            </Link>
            <Link
              href="/memory"
              className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm font-medium text-stone-900 transition hover:border-stone-300 hover:bg-stone-100"
            >
              查看记忆页
            </Link>
          </div>

          <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-gray-600">
            建议在网络恢复后重新进入沟通模式，或把燃言安装到主屏幕，以获得更稳定的缓存和恢复体验。
          </div>
        </div>
      </div>
    </main>
  )
}
