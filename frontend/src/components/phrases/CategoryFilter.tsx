/**
 * CategoryFilter 组件
 *
 * 短语分类筛选器
 */

'use client'

import { Button } from '@/components/ui/button'
import { PHRASE_CATEGORIES, type PhraseCategory } from '@/lib/types/phrases'
import { cn } from '@/lib/utils'

export interface CategoryFilterProps {
  selected: PhraseCategory | 'all'
  onChange: (category: PhraseCategory | 'all') => void
  counts?: Record<string, number>
  className?: string
}

export function CategoryFilter({
  selected,
  onChange,
  counts,
  className
}: CategoryFilterProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {/* 全部 */}
      <Button
        variant={selected === 'all' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('all')}
        className="gap-1.5"
      >
        <span>📋</span>
        <span>全部</span>
        {counts && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-xs">
            {Object.values(counts).reduce((a, b) => a + b, 0)}
          </span>
        )}
      </Button>

      {/* 各分类 */}
      {Object.values(PHRASE_CATEGORIES).map((category) => {
        const count = counts?.[category.id] || 0
        return (
          <Button
            key={category.id}
            variant={selected === category.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(category.id)}
            className="gap-1.5"
          >
            <span>{category.icon}</span>
            <span>{category.name}</span>
            {count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-xs">
                {count}
              </span>
            )}
          </Button>
        )
      })}
    </div>
  )
}

export default CategoryFilter
