/**
 * QuickPhraseGrid 组件
 *
 * 显示常用短语网格，点击即可播放
 */

'use client'

import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PHRASE_CATEGORIES, type PhraseCategory, type QuickPhrase } from '@/lib/types/phrases'
import { cn } from '@/lib/utils'

export interface QuickPhraseGridProps {
  phrases: QuickPhrase[]
  onPhraseClick?: (phrase: QuickPhrase) => void
  onPhraseEdit?: (phrase: QuickPhrase) => void
  onPhraseDelete?: (phraseId: string) => void
  editable?: boolean
  className?: string
}

export function QuickPhraseGrid({
  phrases,
  onPhraseClick,
  onPhraseEdit,
  onPhraseDelete,
  editable = false,
  className
}: QuickPhraseGridProps) {
  const handlePhraseClick = useCallback((phrase: QuickPhrase) => {
    onPhraseClick?.(phrase)
  }, [onPhraseClick])

  const handleEdit = useCallback((e: React.MouseEvent, phrase: QuickPhrase) => {
    e.stopPropagation()
    onPhraseEdit?.(phrase)
  }, [onPhraseEdit])

  const handleDelete = useCallback((e: React.MouseEvent, phraseId: string) => {
    e.stopPropagation()
    onPhraseDelete?.(phraseId)
  }, [onPhraseDelete])

  if (phrases.length === 0) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center p-12 text-center",
        "text-muted-foreground"
      )}>
        <p className="text-lg mb-2">还没有添加短语</p>
        <p className="text-sm">点击下方按钮添加您的第一个短语</p>
      </div>
    )
  }

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3", className)}>
      {phrases.map((phrase) => {
        const categoryInfo = PHRASE_CATEGORIES[phrase.category]
        const phraseContent = (
          <>
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mb-2",
              categoryInfo.color
            )}>
              <span>{categoryInfo.icon}</span>
              <span className="font-medium">{categoryInfo.name}</span>
            </div>

            <p className="text-lg font-medium leading-tight min-h-[3rem] flex items-center">
              {phrase.text}
            </p>

            {phrase.usage_count > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                使用 {phrase.usage_count} 次
              </div>
            )}
          </>
        )

        return (
          <Card key={phrase.id} className="group relative overflow-hidden shadow-sm">
            {editable ? (
              <div className="p-4">
                {phraseContent}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handlePhraseClick(phrase)}
                className="w-full p-4 text-left hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500"
              >
                {phraseContent}
              </button>
            )}

            {editable ? (
              <div className="absolute right-1 top-1 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`编辑短语：${phrase.text}`}
                    className="size-11 sm:size-9"
                    onClick={(e) => handleEdit(e, phrase)}
                  >
                    <span className="text-xs">✏️</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`删除短语：${phrase.text}`}
                    className="size-11 text-destructive hover:text-destructive sm:size-9"
                    onClick={(e) => handleDelete(e, phrase.id!)}
                  >
                    <span className="text-xs">🗑️</span>
                  </Button>
              </div>
            ) : null}
          </Card>
        )
      })}
    </div>
  )
}

export default QuickPhraseGrid
