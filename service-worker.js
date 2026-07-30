const CACHE_NAME = "anescare-cache-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icons/icon-48.png",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-192.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/**
 * กลยุทธ์แบบ "Network-first": พยายามโหลดจากอินเทอร์เน็ตก่อนเสมอเมื่อมีสัญญาณ
 * เพื่อให้ผู้ใช้เห็นเนื้อหาล่าสุดทันทีที่พี่พูอัปเดตไฟล์ขึ้น GitHub
 * ถ้าออฟไลน์ (โหลดจากเน็ตไม่สำเร็จ) จึงค่อยดึงจากแคชที่เก็บไว้แทน
 * ต่างจากเดิมที่เป็น "cache-first" ซึ่งเป็นสาเหตุที่แอปไม่เคยอัปเดตให้ผู้ใช้เห็นเอง
 */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
