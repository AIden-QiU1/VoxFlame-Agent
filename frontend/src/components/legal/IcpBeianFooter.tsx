const DEFAULT_ICP_BEIAN_NUMBER = '沪ICP备2026020229号'
const DEFAULT_ICP_BEIAN_URL = 'https://beian.miit.gov.cn/'
const DEFAULT_ICP_BEIAN_COMPANY = '上海生声不息科技有限公司'

const icpBeianNumber =
  process.env.NEXT_PUBLIC_ICP_BEIAN_NUMBER?.trim() || DEFAULT_ICP_BEIAN_NUMBER
const icpBeianUrl =
  process.env.NEXT_PUBLIC_ICP_BEIAN_URL?.trim() || DEFAULT_ICP_BEIAN_URL
const icpBeianCompany =
  process.env.NEXT_PUBLIC_ICP_BEIAN_COMPANY_NAME?.trim() || DEFAULT_ICP_BEIAN_COMPANY

export function IcpBeianFooter() {
  return (
    <footer className="border-t border-stone-200 bg-[#f4efe6] px-5 py-5 text-xs text-stone-500 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{icpBeianCompany}</span>
        <a
          href={icpBeianUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit underline-offset-4 hover:text-stone-800 hover:underline"
        >
          {icpBeianNumber}
        </a>
      </div>
    </footer>
  )
}
