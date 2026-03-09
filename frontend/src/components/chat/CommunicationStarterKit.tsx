'use client'

import { useMemo, useState } from 'react'
import {
  STARTER_KIT_QUICK_ACTIONS,
  STARTER_KIT_SCENES,
  STARTER_KIT_SOURCES,
  type StarterKitPhrase,
} from '@/lib/communication/starter-kit'

interface CommunicationStarterKitProps {
  disabled?: boolean
  isConnected: boolean
  isLaunching?: boolean
  onSelectPhrase: (text: string) => void
}

export function CommunicationStarterKit({
  disabled = false,
  isConnected,
  isLaunching = false,
  onSelectPhrase,
}: CommunicationStarterKitProps) {
  const [selectedSceneId, setSelectedSceneId] = useState(STARTER_KIT_SCENES[0].id)

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

  return (
    <section className="rounded-[28px] border border-amber-200 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide text-amber-700">第一句话 Starter Kit</p>
          <h3 className="mt-1 text-2xl font-bold text-gray-900">先帮你把最重要的话说出去</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            这组开口句基于 AAC、医疗沟通和应急沟通资料整理，再按中文场景做了改写。
            目标不是聊天，而是让你在陌生人、就医、照护和紧急场景里先成功开口。
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-medium">{isConnected ? '已连接，可直接代播' : '点击短语会先连上助手，再自动代播'}</div>
          {isLaunching && (
            <div className="mt-1 text-xs text-amber-700">正在建立连接并准备发送这句话...</div>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {STARTER_KIT_SCENES.map((scene) => {
          const isSelected = scene.id === selectedScene.id

          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => setSelectedSceneId(scene.id)}
              className={`rounded-3xl border p-4 text-left transition ${
                isSelected
                  ? 'border-amber-400 bg-amber-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/60'
              }`}
            >
              <div className="text-2xl">{scene.icon}</div>
              <div className="mt-3 text-base font-semibold text-gray-900">{scene.title}</div>
              <div className="mt-1 text-sm text-gray-600">{scene.description}</div>
            </button>
          )
        })}
      </div>

      <div className="mt-5 rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-semibold text-gray-900">{selectedScene.title}</div>
            <p className="mt-1 text-sm text-gray-600">{selectedScene.rationale}</p>
          </div>
          <div className="text-xs text-gray-500">点击任意一句，直接代播</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedScene.phrases.map(renderPhraseButton)}
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-gray-200 bg-gray-50 p-5">
        <div className="text-sm font-semibold text-gray-900">通用兜底</div>
        <p className="mt-1 text-sm text-gray-600">
          如果你来不及组织完整句子，先用这些基础动作把沟通继续下去。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {STARTER_KIT_QUICK_ACTIONS.map(renderPhraseButton)}
        </div>
      </div>

      <div className="mt-5 text-xs leading-6 text-gray-500">
        来源：
        {STARTER_KIT_SOURCES.map((source, index) => (
          <span key={source.id}>
            {index > 0 ? ' · ' : ' '}
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-amber-700 underline-offset-2 hover:underline"
            >
              {source.label}
            </a>
          </span>
        ))}
      </div>
    </section>
  )
}

