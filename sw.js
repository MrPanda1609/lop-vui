const CACHE='lop-vui-static-v6';
const FILES=['./','./index.html','./style.css','./icon.svg','./manifest.webmanifest','./js/app.js','./js/avatar.js','./js/audio.js','./js/config.js','./js/game.js','./js/mini-games.js','./js/parsing.js','./js/random.js','./js/storage.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x!==CACHE).map(x=>caches.delete(x))))));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});
