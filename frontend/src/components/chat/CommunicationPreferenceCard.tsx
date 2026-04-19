'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CommunicationPreferences } from '@/lib/communication/communication-preferences'
import { saveWorkspaceCommunicationPreferences } from '@/lib/memory/workspace-client'
export type { CommunicationPreferences } from '@/lib/communication/communication-preferences'

interface CommunicationPreferenceCardProps {
  userId: string
  initialPreferences?: CommunicationPreferences
  onSaved?: (preferences: CommunicationPreferences) => void
  eyebrow?: string
  title?: string
  description?: string
  saveLabel?: string
  clearLabel?: string
}

const FIELD_PRESETS = {
  opening_phrase: [
    '我现在说话不太清楚，请给我一点时间。',
    '请直接和我说，我可以慢一点回答。',
  ],
  pace_hint: [
    '请听我说完，如果没听清可以再问我一次。',
    '请慢一点，我会更容易回应你。',
  ],
  repair_phrase: [
    '如果你没听清，请告诉我，我可以换一种方式表达。',
    '如果你没听清，请写给我看。',
  ],
} as const

export function CommunicationPreferenceCard({
  userId,
  initialPreferences,
  onSaved,
  eyebrow = '我的沟通偏好',
  title = '把最重要的三句话固定下来',
  description = '这样你不用每次都重新组织。首屏会优先把这些表达放到最容易点击的位置，减轻开口前的负担。',
  saveLabel = '保存偏好',
  clearLabel = '清空',
}: CommunicationPreferenceCardProps) {
  const [openingPhrase, setOpeningPhrase] = useState(initialPreferences?.opening_phrase ?? '')
  const [paceHint, setPaceHint] = useState(initialPreferences?.pace_hint ?? '')
  const [repairPhrase, setRepairPhrase] = useState(initialPreferences?.repair_phrase ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    setOpeningPhrase(initialPreferences?.opening_phrase ?? '')
    setPaceHint(initialPreferences?.pace_hint ?? '')
    setRepairPhrase(initialPreferences?.repair_phrase ?? '')
  }, [initialPreferences])

  useEffect(() => {
    if (!status) {
      return
    }

    const timer = window.setTimeout(() => {
      setStatus(null)
    }, 3200)

    return () => window.clearTimeout(timer)
  }, [status])

  async function handleSave() {
    setIsSaving(true)
    setStatus(null)

    try {
      const preferences: CommunicationPreferences = {
        opening_phrase: openingPhrase.trim() || undefined,
        pace_hint: paceHint.trim() || undefined,
        repair_phrase: repairPhrase.trim() || undefined,
      }

      const savedPreferences = await saveWorkspaceCommunicationPreferences(userId, preferences)
      if (!savedPreferences) {
        setStatus('请先登录后再保存沟通偏好。')
        return
      }

      onSaved?.(savedPreferences)
      setStatus('已保存，首屏表达建议会优先使用这三句话。')
    } catch (error) {
      console.error('[CommunicationPreferenceCard] Failed to save preferences:', error)
      setStatus('保存失败了，请稍后再试。')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleClear() {
    setOpeningPhrase('')
    setPaceHint('')
    setRepairPhrase('')
    setIsSaving(true)
    setStatus(null)

    try {
      const savedPreferences = await saveWorkspaceCommunicationPreferences(userId, {})
      if (!savedPreferences) {
        setStatus('请先登录后再清空沟通偏好。')
        return
      }

      onSaved?.(savedPreferences)
      setStatus('这三句已经清空，你后面可以重新写。')
    } catch (error) {
      console.error('[CommunicationPreferenceCard] Failed to clear preferences:', error)
      setStatus('清空失败了，请稍后再试。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-medium text-stone-700">{eyebrow}</div>
          <h3 className="mt-1 text-xl font-semibold text-stone-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600 text-pretty">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void handleClear()}
            disabled={isSaving}
            variant="outline"
            className="rounded-full border-stone-200 bg-white px-5 text-stone-700 hover:bg-stone-50"
          >
            {clearLabel}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-full bg-amber-500 px-5 text-white hover:bg-amber-600"
          >
            {isSaving ? '保存中...' : saveLabel}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <PreferenceField
          fieldId="opening_phrase"
          label="陌生人先听到"
          placeholder="例如：我现在说话不太清楚，请给我一点时间。"
          value={openingPhrase}
          onChange={setOpeningPhrase}
          presets={FIELD_PRESETS.opening_phrase}
        />
        <PreferenceField
          fieldId="pace_hint"
          label="我希望别人这样配合"
          placeholder="例如：请听我说完，如果没听清可以再问我一次。"
          value={paceHint}
          onChange={setPaceHint}
          presets={FIELD_PRESETS.pace_hint}
        />
        <PreferenceField
          fieldId="repair_phrase"
          label="没听清时怎么办"
          placeholder="例如：如果你没听清，请写给我看。"
          value={repairPhrase}
          onChange={setRepairPhrase}
          presets={FIELD_PRESETS.repair_phrase}
        />
      </div>

      {status ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {status}
        </div>
      ) : null}
    </section>
  )
}

interface PreferenceFieldProps {
  fieldId: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  presets: readonly string[]
}

function PreferenceField({
  fieldId,
  label,
  placeholder,
  value,
  onChange,
  presets,
}: PreferenceFieldProps) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
      <Label htmlFor={fieldId} className="text-sm font-medium text-stone-800">
        {label}
      </Label>
      <Input
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-3 h-11 rounded-2xl border-stone-200 bg-white"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-left text-xs text-stone-700 transition hover:border-amber-300 hover:bg-amber-50"
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  )
}
