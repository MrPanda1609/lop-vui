export const APP_NAME = 'Lớp Vui';
export const DB_NAME = 'lop-vui-v1';
export const SCHEMA_VERSION = 1;
export const DEFAULT_SETTINGS = Object.freeze({duration:'quick', selectedCount:1, avoidRepeats:true, soundEnabled:false, volume:45, showNames:true, reducedMotion:false});
export const AVATAR_COLORS = ['#dd8266','#66a59a','#e6ad5e','#7197c4','#b18ac3','#8da95b','#d581a1','#5daab0'];
export const GAMES = [
 {id:'racing',name:'Đua Thú Cưng',tagline:'Đường đua dài',description:'Những thú cưng tăng tốc, vượt nhau trên đường đua. Bảng xếp hạng được công bố khi về đích.',minPlayers:1,maxPlayers:50},
 {id:'survival',name:'Đảo Sinh Tồn',tagline:'Đảo nổi',description:'Đảo nổi thu hẹp, các nhân vật lần lượt rời sân chơi. Những người trụ lại được gọi tên.',minPlayers:1,maxPlayers:50},
 {id:'claw',name:'Máy Gắp May Mắn',tagline:'Máy gắp thú',description:'Cần gắp tìm đúng nhân vật trong khoang và đưa tới cửa nhận thưởng.',minPlayers:1,maxPlayers:50}
];
export const makeId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  // Secure random UUID fallback for browser contexts without randomUUID().
  if (!globalThis.crypto?.getRandomValues) throw Error('Thiết bị không hỗ trợ tạo mã định danh an toàn.');
  const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
export const now = () => new Date().toISOString();
