# PWA 实现指南

> 渐进式 Web 应用 (Progressive Web App) - VoxFlame Agent 离线支持与性能优化方案

---

## 一、PWA 核心概念

### 1.1 什么是 PWA？

**Progressive Web App (渐进式 Web 应用)** 是一种使用现代 Web 技术构建的应用程序，具备以下特性：

```
传统 Web 应用                     PWA 应用
===============================================
❌ 必须联网才能访问              ✅ 离线可用
❌ 无法安装到桌面                ✅ 可安装 (添加到主屏幕)
❌ 网络慢时加载缓慢              ✅ 快速加载 (缓存优化)
❌ 没有推送通知                  ✅ 支持推送通知
❌ 无法后台同步                  ✅ 后台同步数据
```

### 1.2 PWA 三大核心技术

```
1. Service Worker (服务工作线程)
   ↓ 拦截网络请求
   ↓ 管理缓存策略
   ↓ 后台同步
   ↓ 推送通知

2. Web App Manifest (应用清单)
   ↓ 应用名称和图标
   ↓ 启动画面
   ↓ 主题颜色
   ↓ 显示模式

3. HTTPS (安全传输)
   ↓ Service Worker 必须在 HTTPS 下运行
   ↓ (localhost 除外)
```

---

## 二、Service Worker 生命周期

### 2.1 生命周期状态

```
页面加载
  ↓
注册 Service Worker (register)
  ↓
安装阶段 (install)
  ├─ 下载 sw.js
  ├─ 预缓存静态资源
  └─ self.skipWaiting() → 强制激活
  ↓
等待激活 (waiting)
  ↓
激活阶段 (activate)
  ├─ 清理旧缓存
  ├─ 接管页面
  └─ self.clients.claim() → 立即控制页面
  ↓
运行阶段 (activated)
  ├─ 拦截 fetch 请求
  ├─ 应用缓存策略
  ├─ 后台同步
  └─ 推送通知
```

### 2.2 生命周期代码示例

**注册 Service Worker (app.js):**
```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered:', registration.scope);
        
        // 监听更新
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 新版本可用
              if (confirm('发现新版本，是否立即更新？')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        });
      })
      .catch(err => console.error('SW registration failed:', err));
  });
}
```

**Service Worker 安装与激活 (sw.js):**
```javascript
const CACHE_NAME = 'voxflame-v1.0.0';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// 安装阶段：预缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precaching static resources');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting()) // 跳过等待，立即激活
  );
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim()) // 立即接管所有页面
  );
});

// 监听客户端消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

---

## 三、Workbox 缓存策略

### 3.1 Workbox 简介

**Workbox** 是 Google 开发的 Service Worker 工具库，提供：
- 🔧 预配置的缓存策略
- 📦 自动化构建工具
- 🚀 性能优化
- 🔄 后台同步
- 📱 推送通知

### 3.2 五大缓存策略

#### 1. Cache First (缓存优先)

**适用场景：** 静态资源 (CSS, JS, 图片, 字体)

```javascript
// Workbox 配置
workbox.routing.registerRoute(
  /\.(?:js|css|png|jpg|jpeg|svg|gif|woff|woff2)$/,
  new workbox.strategies.CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 天
        purgeOnQuotaError: true,
      }),
    ],
  })
);
```

**工作流程：**
```
请求 → 检查缓存
         ↓
      缓存命中? 
      ├─ 是 → 返回缓存 ✅
      └─ 否 → 网络请求 → 缓存响应 → 返回响应
```

---

#### 2. Network First (网络优先)

**适用场景：** 动态内容 (HTML 页面, API 响应)

```javascript
workbox.routing.registerRoute(
  /^https:\/\/api\.example\.com/,
  new workbox.strategies.NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3, // 3秒超时
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 分钟
      }),
    ],
  })
);
```

**工作流程：**
```
请求 → 网络请求 (3秒超时)
         ↓
      成功返回?
      ├─ 是 → 缓存响应 → 返回响应 ✅
      └─ 否 → 检查缓存 → 返回缓存 (降级)
```

---

#### 3. Stale While Revalidate (返回缓存，后台更新)

**适用场景：** 平衡速度与新鲜度 (Google Fonts, CDN 资源)

```javascript
workbox.routing.registerRoute(
  /^https:\/\/fonts\.googleapis\.com/,
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 年
      }),
    ],
  })
);
```

**工作流程：**
```
请求 → 同时触发：
         ├─ 立即返回缓存 ✅
         └─ 后台网络请求 → 更新缓存 (下次使用)
```

---

#### 4. Network Only (仅网络)

**适用场景：** 必须实时的请求 (支付接口, 实名认证)

```javascript
workbox.routing.registerRoute(
  /^https:\/\/api\.example\.com\/payment/,
  new workbox.strategies.NetworkOnly()
);
```

---

#### 5. Cache Only (仅缓存)

**适用场景：** 离线回退页面, 预缓存资源

```javascript
workbox.routing.registerRoute(
  '/offline.html',
  new workbox.strategies.CacheOnly()
);
```

---

### 3.3 Workbox Recipes (预设方案)

```javascript
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// 1. 缓存 Google Fonts
workbox.recipes.googleFontsCache();

// 2. 缓存图片 (60张，30天过期)
workbox.recipes.imageCache({
  cacheName: 'image-cache',
  maxEntries: 60,
  maxAgeSeconds: 30 * 24 * 60 * 60,
});

// 3. 缓存页面 (Network-First, 3秒超时)
workbox.recipes.pageCache({
  cacheName: 'page-cache',
  networkTimeoutSeconds: 3,
});

// 4. 缓存静态资源 (Cache-First)
workbox.recipes.staticResourceCache({
  cacheName: 'static-resources',
});

// 5. 离线回退
workbox.recipes.offlineFallback({
  pageFallback: '/offline.html',
  imageFallback: '/images/offline.svg',
});

// 6. 预热缓存 (安装时缓存关键资源)
workbox.recipes.warmStrategyCache({
  urls: ['/index.html', '/app.js', '/styles.css'],
  strategy: new workbox.strategies.CacheFirst(),
});

// 立即激活
workbox.core.skipWaiting();
workbox.core.clientsClaim();
```

---

## 四、Next.js PWA 实现

### 4.1 安装 next-pwa

```bash
npm install next-pwa
```

### 4.2 配置 next.config.js

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  
  // 运行时缓存策略
  runtimeCaching: [
    // 1. Google Fonts
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets',
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 年
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    
    // 2. API 请求 (Network-First)
    {
      urlPattern: /^https:\/\/api\.example\.com/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 300, // 5 分钟
        },
        backgroundSync: {
          name: 'api-queue',
          options: {
            maxRetentionTime: 24 * 60, // 24 小时
          },
        },
      },
    },
    
    // 3. 图片 (Cache-First)
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 天
        },
      },
    },
    
    // 4. 静态资源 (Cache-First)
    {
      urlPattern: /\.(?:js|css)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-resources',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 天
        },
      },
    },
  ],
  
  // 排除不缓存的文件
  publicExcludes: ['!noprecache/**/*'],
  buildExcludes: [/chunks\/images\/.*$/],
  
  // 缓存起始 URL
  cacheStartUrl: true,
  dynamicStartUrl: false,
  
  // 离线回退
  fallbacks: {
    document: '/_offline',
    image: '/images/fallback.png',
    // audio: '/audio/silence.mp3',
    // video: '/video/placeholder.mp4',
  },
});

module.exports = withPWA({
  reactStrictMode: true,
  // 其他 Next.js 配置
});
```

---

### 4.3 创建 Web App Manifest

**public/manifest.json:**
```json
{
  "name": "VoxFlame Agent - 燃言语音助手",
  "short_name": "VoxFlame",
  "description": "为构音障碍患者打造的AI语音助手",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

---

### 4.4 更新 HTML Head

**pages/_document.tsx:**
```tsx
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="zh-CN">
      <Head>
        {/* PWA 配置 */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="VoxFlame" />
        
        {/* iOS 图标 */}
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        
        {/* 启动画面 */}
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

---

### 4.5 Service Worker 通信

**客户端代码 (pages/_app.tsx):**
```tsx
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && window.workbox) {
      const wb = window.workbox;
      
      // 注册 Service Worker
      wb.register('/sw.js').then(registration => {
        console.log('SW registered:', registration);
        
        // 监听更新
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 新版本可用
              console.log('New content is available!');
              
              // 显示更新提示
              if (confirm('发现新版本，是否立即更新？')) {
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        });
      });
      
      // 向 Service Worker 发送消息
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          command: 'syncData',
          message: 'User initiated sync'
        });
      }
    }
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
```

**Service Worker 接收消息 (public/sw.js):**
```javascript
self.addEventListener('message', (event) => {
  const { command, message } = event.data;
  
  switch (command) {
    case 'syncData':
      console.log('Received syncData command:', message);
      // 执行同步操作
      break;
      
    case 'clearCache':
      console.log('Clearing all caches');
      caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      });
      break;
  }
});
```

---

## 五、离线页面实现

### 5.1 创建离线页面

**pages/_offline.tsx:**
```tsx
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <svg className="mx-auto h-24 w-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
        </svg>
        
        <h1 className="mt-6 text-3xl font-bold text-gray-900">
          离线状态
        </h1>
        
        <p className="mt-4 text-lg text-gray-600">
          您当前没有网络连接，请检查网络后重试
        </p>
        
        <button
          onClick={() => window.location.reload()}
          className="mt-8 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          重新加载
        </button>
      </div>
    </div>
  );
}
```

---

## 六、音频缓存策略

### 6.1 音频文件缓存

**问题：** 音频文件通常较大 (500KB - 5MB)，如何高效缓存？

**方案：** 使用 Range Requests (范围请求) + Cache API

```javascript
// Service Worker: 处理音频请求
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 匹配音频文件
  if (url.pathname.match(/\.(mp3|wav|ogg|aac)$/)) {
    event.respondWith(
      handleAudioRequest(event.request)
    );
  }
});

async function handleAudioRequest(request) {
  const cache = await caches.open('audio-cache');
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // 网络请求
  const response = await fetch(request);
  
  // 只缓存成功的完整响应 (200)
  if (response.status === 200) {
    cache.put(request, response.clone());
  }
  
  return response;
}
```

---

### 6.2 实时音频流处理

**问题：** WebSocket 音频流无法被 Service Worker 缓存

**方案：** 使用 IndexedDB 缓存音频数据

```javascript
// 打开 IndexedDB
const dbPromise = idb.openDB('audio-store', 1, {
  upgrade(db) {
    db.createObjectStore('audio-chunks', { keyPath: 'id', autoIncrement: true });
  },
});

// 存储音频数据
async function saveAudioChunk(data) {
  const db = await dbPromise;
  await db.add('audio-chunks', {
    timestamp: Date.now(),
    data: data, // ArrayBuffer
  });
}

// 读取音频数据
async function getAudioChunks() {
  const db = await dbPromise;
  return await db.getAll('audio-chunks');
}

// 清理旧数据 (保留最近1小时)
async function cleanupOldChunks() {
  const db = await dbPromise;
  const cutoffTime = Date.now() - 60 * 60 * 1000; // 1小时前
  
  const tx = db.transaction('audio-chunks', 'readwrite');
  const store = tx.objectStore('audio-chunks');
  
  let cursor = await store.openCursor();
  while (cursor) {
    if (cursor.value.timestamp < cutoffTime) {
      cursor.delete();
    }
    cursor = await cursor.continue();
  }
  
  await tx.done;
}
```

---

## 七、性能优化

### 7.1 预加载关键资源

```javascript
// 安装时预缓存
const CRITICAL_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/fonts/main.woff2',
  '/icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('critical-v1')
      .then(cache => cache.addAll(CRITICAL_URLS))
      .then(() => self.skipWaiting())
  );
});
```

---

### 7.2 缓存大小限制

```javascript
// Workbox 配置
new workbox.expiration.ExpirationPlugin({
  maxEntries: 100, // 最多缓存100个条目
  maxAgeSeconds: 7 * 24 * 60 * 60, // 7天过期
  purgeOnQuotaError: true, // 配额不足时自动清理
})
```

---

### 7.3 缓存命中率监控

```javascript
// Service Worker: 监控缓存命中
self.addEventListener('fetch', (event) => {
  const startTime = performance.now();
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        const duration = performance.now() - startTime;
        
        if (response) {
          console.log('[Cache Hit]', event.request.url, `${duration}ms`);
          return response;
        }
        
        console.log('[Cache Miss]', event.request.url);
        return fetch(event.request);
      })
  );
});
```

---

## 八、调试与测试

### 8.1 Chrome DevTools 调试

**查看 Service Worker 状态：**
1. 打开 Chrome DevTools (F12)
2. Application -> Service Workers
3. 查看状态：Activated / Waiting / Installing

**查看缓存内容：**
1. Application -> Cache Storage
2. 展开缓存名称
3. 查看缓存的资源列表

**模拟离线：**
1. Network -> Throttling -> Offline
2. 刷新页面，测试离线功能

---

### 8.2 Lighthouse PWA 审计

```bash
# 运行 Lighthouse 审计
npx lighthouse https://your-app.com --view

# 检查项目：
# - PWA 清单配置
# - Service Worker 注册
# - 离线功能
# - HTTPS 部署
# - 性能指标
```

**Lighthouse PWA 检查清单：**
- ✅ 有效的 Web App Manifest
- ✅ Service Worker 已注册
- ✅ 离线时可访问
- ✅ HTTPS 部署
- ✅ 快速加载 (First Contentful Paint < 2s)
- ✅ 可安装 (Add to Home Screen)

---

### 8.3 测试清单

```markdown
## PWA 功能测试清单

### 安装测试
- [ ] Chrome: 地址栏显示"安装"图标
- [ ] iOS Safari: "添加到主屏幕"可用
- [ ] Android Chrome: "添加到主屏幕"可用

### 离线测试
- [ ] 断网后，应用仍可访问
- [ ] 离线页面正常显示
- [ ] 缓存的资源正常加载

### 更新测试
- [ ] 修改 Service Worker 后，检测到更新
- [ ] 更新提示正常显示
- [ ] 刷新后应用新版本

### 性能测试
- [ ] Lighthouse PWA 分数 > 90
- [ ] 首屏加载 < 2s
- [ ] 缓存命中率 > 80%
```

---

## 九、VoxFlame Agent PWA 实现计划

### 9.1 当前状态

```
✅ 已实现：
- manifest.json 配置
- 基础 Service Worker (public/sw.js)
- 图标资源 (72x72 ~ 512x512)

⏳ 待实现：
- Workbox 缓存策略
- 离线页面
- 音频数据缓存 (IndexedDB)
- 更新提示
```

---

### 9.2 实施步骤

**Step 1: 安装依赖**
```bash
cd /root/VoxFlame-Agent/frontend
npm install next-pwa workbox-window idb
```

**Step 2: 配置 next.config.js**
```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    // API 缓存 (Network-First)
    {
      urlPattern: /^https?:\/\/.*\/api\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 300,
        },
      },
    },
    // 静态资源 (Cache-First)
    {
      urlPattern: /\.(?:js|css|png|jpg|jpeg|svg|gif)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-resources',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
      },
    },
  ],
  fallbacks: {
    document: '/_offline',
  },
});

module.exports = withPWA({
  reactStrictMode: true,
});
```

**Step 3: 创建离线页面**
```tsx
// pages/_offline.tsx
export default function OfflinePage() {
  return (
    <div className="offline-page">
      <h1>离线状态</h1>
      <p>您当前没有网络连接</p>
      <button onClick={() => window.location.reload()}>
        重新加载
      </button>
    </div>
  );
}
```

**Step 4: 添加更新提示**
```tsx
// pages/_app.tsx
useEffect(() => {
  if ('serviceWorker' in navigator && window.workbox) {
    window.workbox.register('/sw.js').then(registration => {
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (confirm('发现新版本，是否立即更新？')) {
              installingWorker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }
          }
        });
      });
    });
  }
}, []);
```

**Step 5: 音频数据缓存**
```typescript
// lib/audio-cache.ts
import { openDB } from 'idb';

const DB_NAME = 'voxflame-audio';
const STORE_NAME = 'audio-chunks';

export async function initAudioCache() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    },
  });
}

export async function saveAudioChunk(data: ArrayBuffer) {
  const db = await initAudioCache();
  await db.add(STORE_NAME, {
    timestamp: Date.now(),
    data,
  });
}

export async function getAudioChunks() {
  const db = await initAudioCache();
  return await db.getAll(STORE_NAME);
}

export async function clearOldChunks() {
  const db = await initAudioCache();
  const cutoffTime = Date.now() - 60 * 60 * 1000; // 1小时
  
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  let cursor = await store.openCursor();
  while (cursor) {
    if (cursor.value.timestamp < cutoffTime) {
      cursor.delete();
    }
    cursor = await cursor.continue();
  }
  
  await tx.done;
}
```

---

## 十、参考资源

### 官方文档
- PWA 官方指南: https://web.dev/learn/pwa/
- Workbox 文档: https://developer.chrome.com/docs/workbox/
- next-pwa: https://github.com/shadowwalker/next-pwa
- Service Worker API: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

### 工具
- Lighthouse: https://developers.google.com/web/tools/lighthouse
- PWA Builder: https://www.pwabuilder.com/
- Workbox Wizard: https://developer.chrome.com/docs/workbox/the-ways-of-workbox/

### 示例项目
- PWA Examples: https://github.com/gokulkrishh/awesome-pwa
- Next.js PWA: https://github.com/shadowwalker/next-pwa/tree/master/examples

---

**让 VoxFlame Agent 离线可用，随时随地为用户服务！**
