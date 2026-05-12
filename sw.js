// ============================================================
// Service Worker — バージョン対応 + ネットワーク優先 + 古いキャッシュ削除
//
// 登録時の URL クエリ (例: sw.js?v=51) から VERSION を読み取り、
// バージョンごとに別の cache 名を使う。activate 時に古い cache を
// 全削除することで、ホーム画面追加した PWA でも更新時に古い資産が
// 残らないようにする。
// ============================================================
const VERSION = new URL(self.location.href).searchParams.get('v') || 'unversioned'
const CACHE = 'pocketwiki-' + VERSION

self.addEventListener('install', () => {
  // 新しい SW を即時アクティブ化 (古い SW を置き換える)
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // 現バージョン以外の cache を全削除
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    // 既存タブの control を即時奪取 (リロード不要で新 SW が効く)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request, { cache: 'no-store' })
      // 成功した同一オリジン応答はバージョン別 cache に保存 (オフライン用)
      if (res && res.ok && res.type === 'basic') {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
      }
      return res
    } catch {
      // オフライン時はバージョン別 cache からフォールバック
      const cached = await caches.match(e.request)
      return cached || new Response('Offline', { status: 503, statusText: 'Offline' })
    }
  })())
})

// クライアントから 'SKIP_WAITING' メッセージで強制更新も可能
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})
