/**
 * QuickPhrasesPanel 组件
 *
 * 常用短语板主面板
 * 整合分类筛选、短语网格、编辑功能
 */

'use client'

import { useState, useCallback } from 'react'
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
}

export function QuickPhrasesPanel({
  onPhrasePlay,
  className
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

  // 初始化预设短语
  const handleInitializePresets = useCallback(async () => {
    await initializePresets()
  }, [initializePresets])

  // 处理短语点击 - 播放并记录使用
  const handlePhraseClick = useCallback(async (phrase: QuickPhrase) => {
    // 记录使用
    await incrementUsage(phrase.id!)
    // 播放
    onPhrasePlay?.(phrase.text)
  }, [incrementUsage, onPhrasePlay])

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
    if (confirm('确定要删除这个短语吗？')) {
      await deletePhrase(phraseId)
    }
  }, [deletePhrase])

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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">常用短语</h2>
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* 分类筛选 */}
      <CategoryFilter
        selected={selectedCategory}
        onChange={handleFilterChange}
        counts={categoryStats}
        className="mb-4"
      />

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

      {showInitPrompt && (
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

      {/* 短语网格 */}
      {!isLoading && phrases.length > 0 && (
        <QuickPhraseGrid
          phrases={phrases}
          onPhraseClick={handlePhraseClick}
          onPhraseEdit={handleEdit}
          onPhraseDelete={handleDelete}
          editable={true}
        />
      )}

      {/* 编辑对话框 */}
      <PhraseEditorModal
        phrase={editingPhrase}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}

export default QuickPhrasesPanel
