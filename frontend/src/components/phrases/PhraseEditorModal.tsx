/**
 * PhraseEditorModal 组件
 *
 * 添加/编辑短语的模态框
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { PHRASE_CATEGORIES, type PhraseCategory, type QuickPhrase } from '@/lib/types/phrases'

export interface PhraseEditorModalProps {
  phrase?: QuickPhrase
  open: boolean
  onClose: () => void
  onSave: (text: string, category: PhraseCategory) => Promise<boolean>
}

export function PhraseEditorModal({
  phrase,
  open,
  onClose,
  onSave
}: PhraseEditorModalProps) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<PhraseCategory>('custom')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (phrase) {
      setText(phrase.text)
      setCategory(phrase.category)
    } else {
      setText('')
      setCategory('custom')
    }
  }, [phrase, open])

  const handleSave = async () => {
    if (!text.trim()) return

    setIsSaving(true)
    const success = await onSave(text.trim(), category)
    setIsSaving(false)

    if (success) {
      setText('')
      setCategory('custom')
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{phrase ? '编辑短语' : '添加短语'}</CardTitle>
          <CardDescription>
            {phrase ? '修改短语文本或分类' : '创建一个新的常用短语'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 短语文本输入 */}
          <div className="space-y-2">
            <Label htmlFor="phrase-text">短语文本</Label>
            <Input
              id="phrase-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="例如：我需要帮助"
              maxLength={50}
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-right">
              {text.length}/50
            </p>
          </div>

          {/* 分类选择 */}
          <div className="space-y-2">
            <Label>分类</Label>
            <div className="flex flex-wrap gap-2">
              {Object.values(PHRASE_CATEGORIES).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                    transition-colors
                    ${category === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                    }
                  `}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!text.trim() || isSaving}>
            {isSaving ? '保存中...' : phrase ? '保存修改' : '添加'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default PhraseEditorModal
