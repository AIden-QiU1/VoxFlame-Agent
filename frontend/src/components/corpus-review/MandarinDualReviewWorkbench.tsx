'use client'

import Link from 'next/link'
import { ArrowLeft, Download, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DualAnnotationStatus, DualAnnotatorRole, MandarinDualReviewItem, MandarinDualReviewWorkspace } from '@/lib/corpus-review/types'

interface Props { reviewer: string; role: DualAnnotatorRole; workspace: MandarinDualReviewWorkspace }

const STATUS_LABELS: Record<DualAnnotationStatus, string> = { pending: '待复核', completed: '已完成', unavailable: '音频不可用' }

function duration(ms: number): string { return ms > 0 ? `${(ms / 1000).toFixed(1)} 秒` : '时长未知' }

export function MandarinDualReviewWorkbench({ reviewer, role, workspace }: Props) {
  const [items, setItems] = useState<MandarinDualReviewItem[]>(workspace.items)
  const [selectedId, setSelectedId] = useState(workspace.items[0]?.review_item_id ?? '')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [draftLoaded, setDraftLoaded] = useState(false)
  const draftKey = `voxflame:mandarin-dual-review:${workspace.generated_at}:${role}`

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey)
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, Partial<MandarinDualReviewItem[typeof role]>>
        setItems((current) => current.map((item) => saved[item.review_item_id] ? { ...item, [role]: { ...item[role], ...saved[item.review_item_id] } } : item))
        setMessage('已恢复本机草稿')
      }
    } catch { setMessage('本机草稿读取失败，请及时导出决定') }
    setDraftLoaded(true)
  }, [draftKey, role])

  useEffect(() => {
    if (!draftLoaded) return
    const draft = Object.fromEntries(items
      .filter((item) => item[role].status !== 'pending')
      .map((item) => [item.review_item_id, item[role]]))
    try { window.localStorage.setItem(draftKey, JSON.stringify(draft)) } catch { setMessage('本机草稿保存失败，请及时导出决定') }
  }, [draftKey, draftLoaded, items, role])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => !q || [item.prompt_text, item.category, item.recording_id].some((value) => value.toLowerCase().includes(q)))
  }, [items, query])
  const selected = visible.find((item) => item.review_item_id === selectedId) ?? visible[0] ?? null
  const completed = items.filter((item) => item[role].status !== 'pending').length

  const updateSelected = (patch: Partial<MandarinDualReviewItem[typeof role]>) => {
    if (!selected) return
    const now = new Date().toISOString()
    setItems((current) => current.map((item) => item.review_item_id === selected.review_item_id
      ? { ...item, [role]: { ...item[role], ...patch, reviewed_by: reviewer, reviewed_at: now } }
      : item))
    setMessage('本机草稿已更新')
  }

  const exportDecisions = () => {
    const decisions = items.filter((item) => item[role].status !== 'pending').map((item) => ({ review_item_id: item.review_item_id, ...item[role], reviewed_by: reviewer, reviewed_at: item[role].reviewed_at ?? new Date().toISOString() }))
    const invalid = decisions.find((item) => (item.status === 'completed' && !item.spoken_text?.trim()) || (item.status === 'unavailable' && !item.note?.trim()))
    if (invalid) {
      setMessage('“已完成”必须填写实际转写；“音频不可用”必须说明原因。')
      return
    }
    const payload = {
      kind: 'voxflame_mandarin_dual_spoken_text_annotation_decisions',
      source_generated_at: workspace.generated_at,
      reviewer,
      annotator_role: role,
      exported_at: new Date().toISOString(),
      policy: { independent_annotator_only: true, browser_does_not_write_production: true },
      items: decisions,
    }
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `mandarin-dual-${role}-decisions-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url)
    setMessage(`已导出 ${decisions.length} 条 ${role === 'annotator_a' ? 'A' : 'B'} 标注；仍需离线合并与一致性判断`)
  }

  return <main className="min-h-dvh bg-[#f3efe6] text-stone-950">
    <header className="border-b border-stone-300 bg-white"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <div><Link className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700" href="/corpus-review"><ArrowLeft className="size-4" aria-hidden="true" />返回审稿台</Link><p className="mt-3 text-sm font-semibold text-amber-800">双人独立复核 · {role === 'annotator_a' ? 'A 标注员' : 'B 标注员'}</p><h1 className="mt-1 text-2xl font-semibold sm:text-3xl">只填写你负责的那一份转写</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">不要参考另一位标注员或 ASR。双方结果由离线工具统一计算一致性，浏览器不会修改生产语料。</p></div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600"><span className="rounded-full bg-stone-100 px-3 py-1.5">{reviewer}</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">已处理 {completed}/{items.length}</span><Button className="min-h-11 rounded-xl bg-stone-950 px-4 text-white" onClick={exportDecisions} type="button"><Download className="size-4" aria-hidden="true" />导出我的标注</Button></div>
    </div></header>
    <section className="mx-auto max-w-[1500px] px-4 pt-4 sm:px-6"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p>当前身份只允许提交 {role === 'annotator_a' ? 'annotator_a' : 'annotator_b'}。请先听音频，再填写实际说出内容；无法可靠听清时选择“音频不可用”。</p></div></div><p className="mt-3 text-sm text-stone-600">{message}</p></section>
    <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 sm:px-6 sm:py-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-stone-300 bg-white p-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-500" aria-hidden="true" /><Input className="h-11 rounded-xl pl-10" aria-label="搜索双人复核项" onChange={(event) => setQuery(event.target.value)} placeholder="搜索目标句、类别或录音" value={query} /></div><div className="mt-4 max-h-[65vh] space-y-1 overflow-y-auto">{visible.map((item) => <button className={`w-full rounded-xl border p-3 text-left ${selected?.review_item_id === item.review_item_id ? 'border-amber-700 bg-amber-50' : 'border-transparent hover:border-stone-300'}`} key={item.review_item_id} onClick={() => setSelectedId(item.review_item_id)} type="button"><span className="block truncate text-sm font-semibold">{item.prompt_text}</span><span className="mt-1 block truncate text-xs text-stone-500">{item.category} · {STATUS_LABELS[item[role].status]}</span></button>)}</div></aside>
      <section className="rounded-2xl border border-stone-300 bg-white p-5 shadow-sm sm:p-7">{selected ? <><p className="text-xs font-semibold text-amber-800">{selected.category}</p><h2 className="mt-2 text-3xl font-semibold">{selected.prompt_text}</h2><p className="mt-2 text-xs text-stone-500">{selected.recording_id} · {duration(selected.duration_ms)} · 质量：{selected.quality_disposition}</p><div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4"><p className="text-xs font-semibold text-stone-600">先听原始音频</p><audio className="mt-3 w-full" controls preload="none" src={`/api/corpus-review/spoken-text/audio/${encodeURIComponent(selected.recording_id)}`} /></div><label className="mt-5 block text-sm font-semibold" htmlFor="dual-spoken-text">实际说出的内容<textarea className="mt-2 min-h-28 w-full rounded-xl border border-stone-300 p-3 text-lg leading-7" id="dual-spoken-text" onChange={(event) => updateSelected({ spoken_text: event.target.value })} placeholder="听完后手工填写" value={selected[role].spoken_text ?? ''} /></label><div className="mt-5 flex flex-wrap gap-2">{(Object.keys(STATUS_LABELS) as DualAnnotationStatus[]).map((status) => <button className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${selected[role].status === status ? 'border-stone-900 bg-stone-950 text-white' : 'border-stone-300 bg-white text-stone-700'}`} key={status} onClick={() => updateSelected({ status })} type="button">{STATUS_LABELS[status]}</button>)}</div><label className="mt-5 block text-sm font-semibold" htmlFor="dual-note">备注<textarea className="mt-2 min-h-20 w-full rounded-xl border border-stone-300 p-3 text-sm" id="dual-note" onChange={(event) => updateSelected({ note: event.target.value })} placeholder="例如：尾音不清、音频缺失" value={selected[role].note ?? ''} /></label></> : <p>没有匹配项。</p>}</section>
    </div>
  </main>
}
