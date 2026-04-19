'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  STARTER_KIT_SCENES,
  type StarterKitPhrase,
  type StarterKitPhraseGroup,
  type StarterKitScene,
} from '@/lib/communication/starter-kit'

interface CommunicationStarterKitProps {
  disabled?: boolean
  initialSceneId?: StarterKitScene['id']
  isConnected: boolean
  isLaunching?: boolean
  onSceneChange?: (sceneId: StarterKitScene['id']) => void
  onSelectPhrase: (text: string) => void
}

function resolveSceneId(sceneId?: StarterKitScene['id']): StarterKitScene['id'] {
  return STARTER_KIT_SCENES.find((scene) => scene.id === sceneId)?.id ?? STARTER_KIT_SCENES[0].id
}

export function CommunicationStarterKit({
  disabled = false,
  initialSceneId,
  isConnected,
  isLaunching = false,
  onSceneChange,
  onSelectPhrase,
}: CommunicationStarterKitProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<StarterKitScene['id']>(() => resolveSceneId(initialSceneId))

  useEffect(() => {
    setSelectedSceneId(resolveSceneId(initialSceneId))
  }, [initialSceneId])

  useEffect(() => {
    onSceneChange?.(selectedSceneId)
  }, [onSceneChange, selectedSceneId])

  const selectedScene = useMemo(
    () => STARTER_KIT_SCENES.find((scene) => scene.id === selectedSceneId) ?? STARTER_KIT_SCENES[0],
    [selectedSceneId],
  )

  const renderPhraseButton = (phrase: StarterKitPhrase) => (
    <button
      key={phrase.id}
      type="button"
      onClick={() => onSelectPhrase(phrase.text)}
      disabled={disabled}
      className="rounded-full border border-amber-200 bg-white px-4 py-2 text-left text-sm font-medium text-gray-800 shadow-sm transition hover:border-amber-400 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
      title={phrase.note}
    >
      {phrase.text}
    </button>
  )

  const renderPhraseGroup = (group: StarterKitPhraseGroup) => (
    <section
      key={group.id}
      className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm"
    >
      <div>
        <div className="text-sm font-semibold text-gray-900">{group.title}</div>
        <p className="mt-1 text-sm leading-6 text-gray-600 text-pretty">{group.description}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {group.phrases.map(renderPhraseButton)}
      </div>
    </section>
  )

  return (
    <section className="rounded-[28px] border border-amber-200 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-700">第一句话</p>
          <h3 className="mt-1 text-2xl font-bold text-gray-900 text-balance">现在最想先说哪类话？</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 text-pretty">
            如果这会儿有点紧张，先点一句最接近你处境的话。等对方开始听了，再补第二句。
          </p>
          {initialSceneId ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              已经按你刚才选的场景展开好了。
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-medium">{isConnected ? '已连接，可直接代播' : '点击短语会先连上助手，再自动代播'}</div>
          {isLaunching && (
            <div className="mt-1 text-xs text-amber-700">正在建立连接并准备发送这句话...</div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {STARTER_KIT_SCENES.map((scene) => {
          const isSelected = scene.id === selectedScene.id

          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => setSelectedSceneId(scene.id)}
              className={`rounded-full border px-4 py-2.5 text-left transition ${
                isSelected
                  ? 'border-amber-400 bg-amber-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{scene.icon}</span>
                <span className="text-sm font-semibold text-gray-900">{scene.title}</span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-5 rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-semibold text-gray-900">{selectedScene.title}</div>
            <p className="mt-1 text-sm text-gray-600 text-pretty">{selectedScene.description}</p>
          </div>
          <div className="text-xs text-gray-500">点一句，直接代播</div>
        </div>
        <div className="mt-4">
          <div className="text-sm font-semibold text-gray-900">这个场景先说这三类信息</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedScene.focusPoints.map((point) => (
              <span
                key={point}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm"
              >
                {point}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {selectedScene.sections.map(renderPhraseGroup)}
        </div>
      </div>
    </section>
  )
}
