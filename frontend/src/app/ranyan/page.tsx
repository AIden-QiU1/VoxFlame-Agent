'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { InstallPrompt, OfflineNotice, UpdatePrompt } from '@/components/pwa'

/**
 * 燃言项目主页
 * 
 * 设计风格：温暖、包容、有力量
 * 无障碍友好：
 * - 语义化HTML
 * - ARIA标签
 * - 高对比度颜色
 * - 键盘可导航
 */

const GITHUB_URL = 'https://github.com/AIden-QiU1/dysarthria-voice-assistant'

export default function RanyanPage() {
  const [stats, setStats] = useState({
    contributors: 0,
    recordings: 0,
    hours: 0,
  })
  
  // 获取统计数据（从 localStorage 或 API）
  useEffect(() => {
    // 从本地存储获取贡献数据作为初始值
    try {
      const localRecordings = JSON.parse(localStorage.getItem('ranyan_local_recordings') || '[]')
      const uniqueContributors = new Set(localRecordings.map((r: {contributorId: string}) => r.contributorId))
      const totalDuration = localRecordings.reduce((sum: number, r: {duration: number}) => sum + (r.duration || 0), 0)
      
      setStats({
        contributors: Math.max(uniqueContributors.size, 1),
        recordings: localRecordings.length,
        hours: Math.round(totalDuration / 360) / 10, // 保留1位小数
      })
    } catch {
      // 默认值
      setStats({ contributors: 1, recordings: 0, hours: 0 })
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50">
      {/* 导航栏 */}
      <nav 
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-amber-100"
        role="navigation"
        aria-label="主导航"
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="燃言首页">
            <span className="text-2xl" aria-hidden="true"></span>
            <span className="text-xl font-bold text-amber-600 hover:text-amber-700 transition-colors">燃言</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link 
              href="#mission" 
              className="text-gray-600 hover:text-amber-600 transition-colors focus:outline-none focus:underline"
            >
              使命
            </Link>
            <Link 
              href="#how-to-help" 
              className="text-gray-600 hover:text-amber-600 transition-colors focus:outline-none focus:underline"
            >
              参与方式
            </Link>
            <Link 
              href="/contribute" 
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-medium transition-all shadow-lg shadow-amber-200 hover:shadow-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300"
            >
              贡献声音
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="pt-32 pb-20 px-6" aria-labelledby="hero-title">
        <div className="max-w-4xl mx-auto text-center">
          <h1 id="hero-title" className="text-4xl sm:text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            每个声音
            <span className="text-amber-500">都值得</span>
            <br />
            被听见
          </h1>
          
          <p className="text-lg md:text-xl lg:text-2xl text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto">
            我们正在构建一个让<strong>构音障碍患者</strong>能够被 AI 理解的开源项目。
            <br />
            这不只是技术，这是<span className="text-amber-600 font-medium">尊严</span>。
          </p>

          {/* CTA 按钮 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link 
              href="/contribute" 
              className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white text-lg rounded-full font-bold transition-all shadow-xl shadow-amber-200 hover:shadow-amber-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-amber-300"
            >
               贡献我的声音
            </Link>
            <a 
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white text-lg rounded-full font-bold transition-all shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-500"
            >
              ⭐ GitHub 支持
            </a>
          </div>

          {/* 社区统计 */}
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto" role="region" aria-label="项目统计">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-amber-600 mb-1">
                {stats.contributors}
              </div>
              <div className="text-gray-500 text-sm">贡献者</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-amber-600 mb-1">
                {stats.recordings.toLocaleString()}
              </div>
              <div className="text-gray-500 text-sm">录音数</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-amber-600 mb-1">
                {stats.hours}h
              </div>
              <div className="text-gray-500 text-sm">语音时长</div>
            </div>
          </div>
        </div>
      </section>

      {/* 使命区域 */}
      <section id="mission" className="py-20 px-6 bg-white" aria-labelledby="mission-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="mission-title" className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-4 text-gray-900">
            为什么我们要做这件事？
          </h2>
          <p className="text-gray-500 text-center mb-12">
            因为沟通是人的基本权利
          </p>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            <article className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 md:p-8 rounded-2xl">
              <div className="text-4xl mb-4" aria-hidden="true"></div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">被误解的痛苦</h3>
              <p className="text-gray-600 leading-relaxed">
                &ldquo;每次说话，别人都皱眉头、摇头，或者直接忽略我。
                我不是不想说，是说了也没人懂。&rdquo;
              </p>
              <p className="text-amber-600 mt-4 font-medium">—— 构音障碍患者</p>
            </article>

            <article className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 md:p-8 rounded-2xl">
              <div className="text-4xl mb-4" aria-hidden="true"></div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">AI 也听不懂</h3>
              <p className="text-gray-600 leading-relaxed">
                现有的语音识别系统几乎都是为&ldquo;标准发音&rdquo;训练的。
                对于构音障碍患者，识别率可能低于 20%。
              </p>
              <p className="text-blue-600 mt-4 font-medium">—— 我们要改变这一点</p>
            </article>

            <article className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 md:p-8 rounded-2xl">
              <div className="text-4xl mb-4" aria-hidden="true"></div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">1% 的人口</h3>
              <p className="text-gray-600 leading-relaxed">
                全球约 7500 万人患有构音障碍。
                在中国，这个数字超过 <strong>1000 万</strong>。
                他们都在等待被听见。
              </p>
              <p className="text-green-600 mt-4 font-medium">—— 来源：WHO</p>
            </article>

            <article className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 md:p-8 rounded-2xl">
              <div className="text-4xl mb-4" aria-hidden="true"></div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">燃言的解决方案</h3>
              <p className="text-gray-600 leading-relaxed">
                收集构音障碍语音数据 → 训练专属 AI 模型 → 
                让每个人都能与 AI 自然交流，甚至生成&ldquo;正常&rdquo;语音与他人沟通。
              </p>
              <p className="text-purple-600 mt-4 font-medium">—— 我们正在建设</p>
            </article>
          </div>
        </div>
      </section>

      {/* 参与方式 */}
      <section id="how-to-help" className="py-20 px-6 bg-gradient-to-b from-amber-50 to-white" aria-labelledby="help-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="help-title" className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-4 text-gray-900">
            如何参与建设？
          </h2>
          <p className="text-gray-500 text-center mb-12">
            每一份贡献都是通往理解的桥梁
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <article className="bg-white p-6 md:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-amber-100">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-3xl mb-6" aria-hidden="true">
                
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">贡献声音</h3>
              <p className="text-gray-600 mb-4">
                如果你是构音障碍患者，或者你身边有这样的朋友/家人，
                每录制一段语音，就是在帮助 AI 更好地理解。
              </p>
              <Link 
                href="/contribute" 
                className="inline-block text-amber-600 font-medium hover:text-amber-700 focus:outline-none focus:underline"
              >
                开始录音 →
              </Link>
            </article>

            <article className="bg-white p-6 md:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-blue-100">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-3xl mb-6" aria-hidden="true">
                
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">贡献代码</h3>
              <p className="text-gray-600 mb-4">
                前端、后端、AI 模型、App 开发...
                我们欢迎所有技术背景的开发者加入这个开源项目。
              </p>
              <a 
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-blue-600 font-medium hover:text-blue-700 focus:outline-none focus:underline"
              >
                查看 GitHub →
              </a>
            </article>

            <article className="bg-white p-6 md:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-green-100">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mb-6" aria-hidden="true">
                
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">传播分享</h3>
              <p className="text-gray-600 mb-4">
                把这个项目分享给可能需要的人，或者在社交媒体上为我们发声。
                让更多人知道这件事正在发生。
              </p>
              <button 
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: '燃言 - 让每个声音都被听见',
                      text: '一个帮助构音障碍患者被AI理解的开源项目',
                      url: window.location.href,
                    })
                  } else {
                    navigator.clipboard.writeText(window.location.href)
                    alert('链接已复制到剪贴板')
                  }
                }}
                className="inline-block text-green-600 font-medium hover:text-green-700 focus:outline-none focus:underline"
              >
                分享项目 →
              </button>
            </article>
          </div>
        </div>
      </section>

      {/* 团队/关于 */}
      <section className="py-20 px-6 bg-white" aria-labelledby="about-title">
        <div className="max-w-4xl mx-auto text-center">
          <h2 id="about-title" className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
            关于我们
          </h2>
          <p className="text-gray-500 mb-8 max-w-2xl mx-auto">
            燃言项目由构音障碍患者发起，联合开发者、研究者、康复治疗师共同建设。
            我们相信技术可以成为理解的桥梁。
          </p>
          
          <blockquote className="bg-gradient-to-r from-amber-100 to-orange-100 p-6 md:p-8 rounded-2xl inline-block max-w-2xl">
            <p className="text-lg md:text-xl text-gray-700 italic mb-4">
              &ldquo;我自己就是构音障碍患者。我知道不被理解是什么感觉。
              <br />
              所以我想做一个让每个人都能被听见的工具。&rdquo;
            </p>
            <footer className="text-amber-700 font-medium">—— 项目发起人</footer>
          </blockquote>
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="py-20 px-6 bg-gradient-to-r from-amber-500 to-orange-500" aria-labelledby="cta-title">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 id="cta-title" className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
            一起建设
          </h2>
          <p className="text-lg md:text-xl opacity-90 mb-8">
            你的一段录音，可能就是另一个人获得理解的开始
          </p>
          <Link 
            href="/contribute" 
            className="inline-block px-10 py-5 bg-white text-amber-600 text-lg md:text-xl rounded-full font-bold transition-all shadow-2xl hover:shadow-3xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white/50"
          >
            �� 开始贡献
          </Link>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="py-8 px-6 bg-gray-900 text-gray-400 text-center" role="contentinfo">
        <p>© 2025 燃言项目 | 开源 · 包容 · 共建</p>
        <nav className="flex justify-center gap-6 mt-4" aria-label="页脚导航">
          <Link href="/" className="hover:text-white transition-colors focus:outline-none focus:underline">
            首页
          </Link>
          <Link href="/contribute" className="hover:text-white transition-colors focus:outline-none focus:underline">
            贡献声音
          </Link>
          <a 
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer" 
            className="hover:text-white transition-colors focus:outline-none focus:underline"
          >
            GitHub
          </a>
        </nav>
      </footer>
      {/* PWA 组件 */}
      <OfflineNotice />
      <InstallPrompt />
      <UpdatePrompt />
    </div>
  )
}
