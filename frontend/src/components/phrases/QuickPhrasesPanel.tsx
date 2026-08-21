/**
 * QuickPhrasesPanel 组件
 *
 * 常用短语板主面板
 * 整合分类筛选、短语网格、编辑功能
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { usePhrases } from '@/hooks/usePhrases'
import { QuickPhraseGrid } from './QuickPhraseGrid'
import { CategoryFilter } from './CategoryFilter'
import { PhraseEditorModal } from './PhraseEditorModal'
import type { QuickPhrase, PhraseCategory } from '@/lib/types/phrases'
import { PlusIcon, RefreshCw } from 'lucide-react'

export interface QuickPhrasesPanelProps {
  onPhrasePlay?: (text: string) => void
  className?: string
  mode?: 'use' | 'manage'
}

export function QuickPhrasesPanel({
  onPhrasePlay,
  className,
  mode = 'use',
}: QuickPhrasesPanelProps) {
  const {
    phrases,
    isLoading,
    error,
    requiresAuth,
    selectedCategory,
    loadPhrases,
    createPhrase,
    updatePhrase,
    deletePhrase,
    incrementUsage,
    initializePresets,
    getCategoryStats
  } = usePhrases({ autoLoad: true })

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPhrase, setEditingPhrase] = useState<QuickPhrase | undefined>()
  const [pendingDeletePhrase, setPendingDeletePhrase] = useState<QuickPhrase | null>(null)
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null)
  const isManageMode = mode === 'manage'

  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!dialog) {
      return
    }

    if (pendingDeletePhrase && !dialog.open) {
      dialog.showModal()
    } else if (!pendingDeletePhrase && dialog.open) {
      dialog.close()
    }
  }, [pendingDeletePhrase])

  // 初始化预设短语
  const handleInitializePresets = useCallback(async () => {
    await initializePresets()
  }, [initializePresets])

  // 处理短语点击 - 播放并记录使用
  const handlePhraseClick = useCallback((phrase: QuickPhrase) => {
    if (isManageMode) {
      return
    }

    // 先立即表达，再在后台记录使用次数，避免网络延迟阻塞代播。
    onPhrasePlay?.(phrase.text)
    void incrementUsage(phrase.id!)
  }, [incrementUsage, isManageMode, onPhrasePlay])

  // 打开添加对话框
  const handleAdd = useCallback(() => {
    setEditingPhrase(undefined)
    setEditorOpen(true)
  }, [])

  // 打开编辑对话框
  const handleEdit = useCallback((phrase: QuickPhrase) => {
    setEditingPhrase(phrase)
    setEditorOpen(true)
  }, [])

  // 保存短语
  const handleSave = useCallback(async (text: string, category: PhraseCategory) => {
    if (editingPhrase) {
      // 更新
      const success = await updatePhrase(editingPhrase.id!, { text, category })
      return success !== null
    } else {
      // 创建
      const result = await createPhrase({ text, category })
      return result !== null
    }
  }, [editingPhrase, createPhrase, updatePhrase])

  // 删除短语
  const handleDelete = useCallback(async (phraseId: string) => {
    const phrase = phrases.find((item) => item.id === phraseId) ?? null
    setPendingDeletePhrase(phrase)
  }, [phrases])

  const confirmDelete = useCallback(async () => {
    if (!pendingDeletePhrase) {
      return
    }

    await deletePhrase(pendingDeletePhrase.id)
    setPendingDeletePhrase(null)
  }, [deletePhrase, pendingDeletePhrase])

  // 分类筛选
  const handleFilterChange = useCallback((category: PhraseCategory | 'all') => {
    loadPhrases(category)
  }, [loadPhrases])

  // 获取分类统计数据
  const categoryStats = getCategoryStats()

  // 如果没有短语，显示初始化提示
  const showInitPrompt = phrases.length === 0 && !isLoading && !requiresAuth
  const showAnonymousPrompt = phrases.length === 0 && !isLoading && requiresAuth

  return (
    <div className={className}>
      {/* 头部 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-balance text-xl font-semibold">{isManageMode ? '我的快速短语' : '我的常用短语'}</h2>
          <p className="mt-1 text-pretty text-sm text-stone-600">
            {isManageMode ? '在这里统一增删改，沟通页只负责直接使用。' : '点一句，直接用本机语音说出来。'}
          </p>
        </div>
        {isManageMode ? <div className="flex gap-2">
          {showInitPrompt && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleInitializePresets}
              className="gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              初始化预设
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleAdd}
            className="gap-1"
          >
            <PlusIcon className="h-4 w-4" />
            添加
          </Button>
        </div> : null}
      </div>

      {/* 只有存在可筛选内容或处于维护态时才显示分类，避免匿名使用面出现一排空控件。 */}
      {(isManageMode || phrases.length > 0) ? (
        <CategoryFilter
          selected={selectedCategory}
          onChange={handleFilterChange}
          counts={categoryStats}
          className="mb-4"
        />
      ) : null}

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 初始化提示 */}
      {showAnonymousPrompt && (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
          <p className="mb-2 text-sm font-medium text-foreground">
            当前可以先试用沟通模式
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            登录后即可保存常用短语、同步预设，并让系统逐步学习你的高频表达。
          </p>
        </div>
      )}

      {showInitPrompt && isManageMode && (
        <div className="text-center py-8 px-4 border border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            还没有短语，您可以：
          </p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              onClick={handleInitializePresets}
            >
              初始化预设短语
            </Button>
            <Button onClick={handleAdd}>
              添加自定义短语
            </Button>
          </div>
        </div>
      )}

      {showInitPrompt && !isManageMode ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-7 text-center">
          <p className="text-pretty text-sm text-stone-600">还没有个人短语，可以先使用上方通用短语。</p>
          <Link
            href="/memory#memory-scene-template-selector"
            className="mt-3 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-orange-700 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            去记忆页添加
          </Link>
        </div>
      ) : null}

      {/* 短语网格 */}
      {!isLoading && phrases.length > 0 && (
        <QuickPhraseGrid
          phrases={phrases}
          onPhraseClick={handlePhraseClick}
          onPhraseEdit={isManageMode ? handleEdit : undefined}
          onPhraseDelete={isManageMode ? handleDelete : undefined}
          editable={isManageMode}
        />
      )}

      {/* 编辑对话框 */}
      {isManageMode ? (
        <PhraseEditorModal
          phrase={editingPhrase}
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          onSave={handleSave}
        />
      ) : null}

      <dialog
        ref={deleteDialogRef}
        role="alertdialog"
        aria-labelledby="delete-phrase-title"
        aria-describedby="delete-phrase-description"
        onCancel={() => setPendingDeletePhrase(null)}
        className="w-[min(28rem,calc(100%-2rem))] rounded-3xl border border-stone-200 bg-white p-0 text-stone-950 shadow-xl backdrop:bg-stone-950/40"
      >
        <div className="p-6">
          <h3 id="delete-phrase-title" className="text-balance text-xl font-semibold">删除这条短语？</h3>
          <p id="delete-phrase-description" className="mt-3 text-pretty text-sm leading-6 text-stone-600">
            “{pendingDeletePhrase?.text}”会从个人短语库中移除，这个操作无法撤销。
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setPendingDeletePhrase(null)}
            className="inline-flex min-h-11 items-center rounded-xl border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              className="inline-flex min-h-11 items-center rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
            >
              确认删除
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}

export default QuickPhrasesPanel
