'use client'

import Link from 'next/link'
import { ArrowLeft, Check, Download, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  AudioTextAlignmentStatus,
  SpokenTextReviewItem,
  SpokenTextReviewStatus,
  SpokenTextReviewWorkspace,
} from '@/lib/corpus-review/types'

interface SpokenTextReviewWorkbenchProps {
  reviewer: string
  workspace: SpokenTextReviewWorkspace
}

type QueueFilter = 'all' | 'pending' | 'approved' | 'uncertain' | 'unusable'

const STATUS_LABELS: Record<SpokenTextReviewStatus, string> = {
  pending: '待复核',
  approved: '转写通过',
  uncertain: '无法确定',
  unusable: '不可用',
}

const ALIGNMENT_LABELS: Record<AudioTextAlignmentStatus, string> = {
  pending: '未确认',
  confirmed: '音频对应',
  mismatch: '不对应',
  unusable: '音频不可用',
}

function draftKey(workspace: SpokenTextReviewWorkspace, recordingId: string): string {
  return `${workspace.generated_at}:${recordingId}`
}

function isEligible(item: SpokenTextReviewItem): boolean {
  return item.spoken_text_status === 'approved'
    && item.audio_text_alignment === 'confirmed'
    && Boolean(item.spoken_text?.trim())
}

function displayDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return '时长未知'
  return `${(durationMs / 1000).toFixed(1)} 秒`
}

export function SpokenTextReviewWorkbench({ reviewer, workspace }: SpokenTextReviewWorkbenchProps) {
  const [items, setItems] = useState<SpokenTextReviewItem[]>(workspace.items)
  const [selectedId, setSelectedId] = useState(workspace.items[0]?.recording_id ?? '')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [saveMessage, setSaveMessage] = useState('正在读取本机草稿…')
  const [exportMessage, setExportMessage] = useState('')
  const [draftLoaded, setDraftLoaded] = useState(false)

  useEffect(() => {
    setDraftLoaded(false)
    try {
      const saved = window.localStorage.getItem(`voxflame:spoken-text-review:${workspace.generated_at}`)
      if (saved) {
        const savedItems = JSON.parse(saved) as Record<string, Partial<SpokenTextReviewItem>>
        setItems((current) => current.map((item) => ({ ...item, ...(savedItems[item.recording_id] ?? {}) })))
        setSaveMessage('已恢复本机草稿')
      } else {
        setSaveMessage('尚未产生本机草稿')
      }
    } catch {
      setSaveMessage('本机草稿读取失败，请先导出决定')
    } finally {
      setDraftLoaded(true)
    }
  }, [workspace.generated_at])

  useEffect(() => {
    if (!draftLoaded) return
    const draft = Object.fromEntries(items
      .filter((item) => item.spoken_text_status !== 'pending' || item.audio_text_alignment !== 'pending' || item.spoken_text || item.reviewer_note)
      .map((item) => [item.recording_id, {
        spoken_text: item.spoken_text,
        spoken_text_status: item.spoken_text_status,
        audio_text_alignment: item.audio_text_alignment,
        reviewer_note: item.reviewer_note,
      }]))
    try {
      window.localStorage.setItem(`voxflame:spoken-text-review:${workspace.generated_at}`, JSON.stringify(draft))
      setSaveMessage(Object.keys(draft).length > 0 ? '本机草稿已自动保存' : '尚未产生本机草稿')
    } catch {
      setSaveMessage('本机草稿保存失败，请立即导出决定')
    }
  }, [draftLoaded, items, workspace.generated_at])

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== 'all' && item.spoken_text_status !== filter) return false
      if (!normalized) return true
      return [item.recording_id, item.prompt_text, item.category, item.asr_hint ?? '']
        .some((value) => value.toLowerCase().includes(normalized))
    })
  }, [filter, items, query])

  const selected = visibleItems.find((item) => item.recording_id === selectedId) ?? visibleItems[0] ?? null
  const eligibleCount = items.filter(isEligible).length
  const reviewedCount = items.filter((item) => item.spoken_text_status !== 'pending').length

  const updateSelected = (patch: Partial<SpokenTextReviewItem>) => {
    if (!selected) return
    setItems((current) => current.map((item) => item.recording_id === selected.recording_id
      ? { ...item, ...patch, reviewed_by: reviewer, reviewed_at: new Date().toISOString() }
      : item))
    setExportMessage('')
  }

  const exportDecisions = () => {
    const decisions = items
      .filter((item) => item.spoken_text_status !== 'pending' || item.audio_text_alignment !== 'pending' || item.spoken_text || item.reviewer_note)
      .map((item) => ({
        recording_id: item.recording_id,
        spoken_text: item.spoken_text,
        spoken_text_status: item.spoken_text_status,
        audio_text_alignment: item.audio_text_alignment,
        reviewed_by: reviewer,
        reviewed_at: item.reviewed_at ?? new Date().toISOString(),
        reviewer_note: item.reviewer_note,
      }))
    const invalid = decisions.find((item) => (
      (item.spoken_text_status === 'approved' && (!item.spoken_text?.trim() || item.audio_text_alignment !== 'confirmed'))
      || (item.audio_text_alignment === 'confirmed' && item.spoken_text_status !== 'approved')
    ))
    if (invalid) {
      setExportMessage('“转写通过”必须填写实际说出内容并确认音频对应；已确认音频也必须同时标记为转写通过。')
      return
    }
    const payload = {
      kind: 'voxflame_mandarin_spoken_text_review_decisions',
      source_generated_at: workspace.generated_at,
      reviewer,
      exported_at: new Date().toISOString(),
      policy: { asr_is_not_authoritative: true, browser_does_not_write_production: true },
      items: decisions,
    }
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `mandarin-spoken-text-decisions-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setExportMessage(`已导出 ${decisions.length} 条审核决定；仍需离线校验后才可计入覆盖。`)
  }

  return (
    <main className="min-h-dvh bg-[#f3efe6] text-stone-950">
      <header className="border-b border-stone-300 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700 hover:text-stone-950" href="/corpus-review">
              <ArrowLeft className="size-4" aria-hidden="true" /> 返回候选句审稿台
            </Link>
            <p className="mt-3 text-sm font-semibold text-amber-800">普通话全音系列 · 真实录音复核</p>
            <h1 className="mt-1 text-balance text-2xl font-semibold sm:text-3xl">人工转写与音频对应确认</h1>
            <p className="mt-2 max-w-3xl text-pretty text-sm leading-6 text-stone-600">ASR 只作提示。请先听音频，再填写实际说出的内容；未完成人工转写和音频对应确认的条目不会计入语言学覆盖，也不会直接进入训练。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
            <span className="rounded-full bg-stone-100 px-3 py-1.5">审核者：{reviewer}</span>
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">{eligibleCount} 条具备覆盖资格</span>
            <Button className="min-h-11 rounded-xl bg-stone-950 px-4 text-white hover:bg-stone-800" onClick={exportDecisions} type="button">
              <Download className="size-4" aria-hidden="true" /> 导出审核决定
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p>这是去标识化内部复核入口。原始 manifest、原始音频和生产语料不会被浏览器修改；导出的 JSON 还必须经过 CLI 校验与合并。</p></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-stone-700">
          <span>已处理 {reviewedCount}/{items.length}</span>
          <span>·</span>
          <span>{saveMessage}</span>
          {exportMessage ? <span className="text-amber-900">· {exportMessage}</span> : null}
        </div>
      </section>

      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 sm:px-6 sm:py-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-stone-300 bg-white p-4 shadow-sm">
          <Label className="sr-only" htmlFor="spoken-review-search">搜索复核录音</Label>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-500" aria-hidden="true" /><Input className="h-11 rounded-xl border-stone-300 pl-10" id="spoken-review-search" onChange={(event) => setQuery(event.target.value)} placeholder="搜索目标句、类别或 ASR 提示" value={query} /></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['all', 'pending', 'approved', 'uncertain', 'unusable'] as QueueFilter[]).map((value) => (
              <button className={`min-h-10 rounded-lg border px-2 text-xs font-semibold ${filter === value ? 'border-stone-900 bg-stone-950 text-white' : 'border-stone-300 bg-white text-stone-700'}`} key={value} onClick={() => setFilter(value)} type="button">
                {value === 'all' ? '全部' : STATUS_LABELS[value]}
              </button>
            ))}
          </div>
          <div className="mt-4 max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {visibleItems.map((item) => (
              <button className={`w-full rounded-xl border p-3 text-left ${selected?.recording_id === item.recording_id ? 'border-amber-700 bg-amber-50' : 'border-transparent hover:border-stone-300 hover:bg-stone-50'}`} key={item.recording_id} onClick={() => setSelectedId(item.recording_id)} type="button">
                <span className="block truncate text-sm font-semibold">{item.prompt_text}</span>
                <span className="mt-1 block truncate text-xs text-stone-500">{item.category} · {STATUS_LABELS[item.spoken_text_status]}</span>
              </button>
            ))}
            {visibleItems.length === 0 ? <p className="p-4 text-center text-sm text-stone-600">没有匹配项</p> : null}
          </div>
        </aside>

        <section className="rounded-2xl border border-stone-300 bg-white p-5 shadow-sm sm:p-7">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">{selected.category}</p><h2 className="mt-2 text-balance text-3xl font-semibold">{selected.prompt_text}</h2><p className="mt-2 text-xs text-stone-500">{selected.recording_id} · {displayDuration(selected.duration_ms)} · 音频质量：{selected.quality_disposition}</p></div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isEligible(selected) ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-100 text-stone-700'}`}>{isEligible(selected) ? '可计入覆盖' : '尚不具备覆盖资格'}</span>
              </div>
              <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4"><p className="text-xs font-semibold text-stone-600">先听原始音频</p><audio className="mt-3 w-full" controls preload="none" src={`/api/corpus-review/spoken-text/audio/${encodeURIComponent(selected.recording_id)}`} /><p className="mt-2 text-xs leading-5 text-stone-500">若显示无法播放，记录为音频不可用；不要根据 ASR 猜测实际说出内容。</p></div>
              <div className="mt-5 rounded-2xl border border-stone-200 p-4"><p className="text-xs font-semibold text-stone-600">ASR 提示（不可作为最终转写）</p><p className="mt-2 min-h-12 text-lg text-stone-800">{selected.asr_hint || '无 ASR 提示'}</p></div>
              <div className="mt-5"><Label htmlFor="spoken-text">实际说出的内容</Label><textarea className="mt-2 min-h-28 w-full rounded-xl border border-stone-300 bg-white p-3 text-lg leading-7 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200" id="spoken-text" onChange={(event) => updateSelected({ spoken_text: event.target.value })} placeholder="听完音频后手工填写；不确定时可留空" value={selected.spoken_text ?? ''} /></div>
              <div className="mt-5 grid gap-5 lg:grid-cols-2"><div><p className="text-sm font-semibold">转写判断</p><div className="mt-2 flex flex-wrap gap-2">{(Object.keys(STATUS_LABELS) as SpokenTextReviewStatus[]).map((status) => <button className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${selected.spoken_text_status === status ? 'border-stone-900 bg-stone-950 text-white' : 'border-stone-300 bg-white text-stone-700'}`} key={status} onClick={() => updateSelected({ spoken_text_status: status })} type="button">{STATUS_LABELS[status]}</button>)}</div></div><div><p className="text-sm font-semibold">音频与文字是否对应</p><div className="mt-2 flex flex-wrap gap-2">{(Object.keys(ALIGNMENT_LABELS) as AudioTextAlignmentStatus[]).map((status) => <button className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${selected.audio_text_alignment === status ? 'border-stone-900 bg-stone-950 text-white' : 'border-stone-300 bg-white text-stone-700'}`} key={status} onClick={() => updateSelected({ audio_text_alignment: status })} type="button">{ALIGNMENT_LABELS[status]}</button>)}</div></div></div>
              <div className="mt-5"><Label htmlFor="reviewer-note">复核备注（可选）</Label><textarea className="mt-2 min-h-20 w-full rounded-xl border border-stone-300 p-3 text-sm leading-6 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200" id="reviewer-note" onChange={(event) => updateSelected({ reviewer_note: event.target.value })} placeholder="例如：尾音听不清、音频缺失、需要仲裁" value={selected.reviewer_note ?? ''} /></div>
              <div className="mt-6 flex items-center gap-2 rounded-xl bg-stone-50 p-3 text-sm text-stone-700"><Check className="size-4 text-emerald-700" aria-hidden="true" /> 只有“转写通过 + 音频对应”才会进入覆盖审计；当前决定由 {reviewer} 记录。</div>
            </>
          ) : <p className="p-8 text-center text-stone-600">没有可显示的复核项。</p>}
        </section>
      </div>
    </main>
  )
}
