import {DB_NAME,SCHEMA_VERSION,DEFAULT_SETTINGS,now} from './config.js';
const STORES=['classes','students','sessions','history','meta'];
let dbPromise;
export function openDatabase(){
  if(!dbPromise) dbPromise=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB) {reject(Error('Trình duyệt không hỗ trợ IndexedDB.'));return;}
    const request=indexedDB.open(DB_NAME,SCHEMA_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const name of STORES) if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});
    };
    request.onerror=()=>reject(request.error||Error('Không thể mở kho dữ liệu.'));
    request.onblocked=()=>reject(Error('Hãy đóng các tab khác đang mở ứng dụng rồi thử lại.'));
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
  }).catch(e=>{dbPromise=null;throw e;});
  return dbPromise;
}
const req=(r)=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function all(store){const db=await openDatabase();return req(db.transaction(store,'readonly').objectStore(store).getAll());}
export async function get(store,id){const db=await openDatabase();return req(db.transaction(store,'readonly').objectStore(store).get(id));}
export async function put(store,obj){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(obj);tx.oncomplete=()=>resolve(obj);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
export async function remove(store,id){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
export async function transact(stores,callback){
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(stores,'readwrite');
    let result;
    try {result=callback(Object.fromEntries(stores.map(s=>[s,tx.objectStore(s)])));}
    catch(e){tx.abort();reject(e);return;}
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||Error('Không thể lưu dữ liệu.'));
    tx.onabort=()=>reject(tx.error||Error('Giao dịch đã được hủy.'));
  });
}
export async function loadAll(){
  const [classes,students,sessions,history,metadata]=await Promise.all([all('classes'),all('students'),all('sessions'),all('history'),all('meta')]);
  const settings={...DEFAULT_SETTINGS,...(metadata.find(m=>m.id==='settings')?.value||{})};
  return {classes,students,sessions,history,settings,activeClassId:metadata.find(m=>m.id==='activeClass')?.value||null};
}
export async function exportBackup(){
  const state=await loadAll();return {app:'lop-vui',schemaVersion:SCHEMA_VERSION,exportedAt:now(),...state};
}
function array(value){return Array.isArray(value)?value:null;}
export function validateBackup(data){
  if(!data||data.app!=='lop-vui'||data.schemaVersion!==SCHEMA_VERSION)throw Error('Tệp sao lưu không đúng định dạng hoặc phiên bản chưa được hỗ trợ.');
  const classes=array(data.classes),students=array(data.students),sessions=array(data.sessions),history=array(data.history);
  if(!classes||!students||!sessions||!history)throw Error('Bản sao lưu thiếu dữ liệu cần thiết.');
  if(classes.length>300||students.length>15000||history.length>100000||sessions.length>10000)throw Error('Bản sao lưu quá lớn.');
  const classIds=new Set(), studentIds=new Set();
  for(const c of classes){if(!c||typeof c.id!=='string'||typeof c.name!=='string'||!c.name.trim()||c.name.length>120||classIds.has(c.id))throw Error('Danh sách lớp trong bản sao lưu không hợp lệ.');classIds.add(c.id);}
  for(const s of students){if(!s||typeof s.id!=='string'||studentIds.has(s.id)||!classIds.has(s.classId)||typeof s.fullName!=='string'||!s.fullName.trim()||s.fullName.length>120||typeof s.isActive!=='boolean'||typeof s.avatarSeed!=='string')throw Error('Danh sách học sinh trong bản sao lưu không hợp lệ.');studentIds.add(s.id);}
  for(const r of history){if(!r||typeof r.id!=='string'||!classIds.has(r.classId)||typeof r.studentNameSnapshot!=='string'||typeof r.selectedAt!=='string')throw Error('Lịch sử trong bản sao lưu không hợp lệ.');}
  for(const s of sessions){if(!s||typeof s.id!=='string'||!classIds.has(s.classId)||!Array.isArray(s.calledIds))throw Error('Phiên học trong bản sao lưu không hợp lệ.');}
  return {classes,students,sessions,history,settings:{...DEFAULT_SETTINGS,...(data.settings||{})},activeClassId:classIds.has(data.activeClassId)?data.activeClassId:classes[0]?.id||null};
}
export async function importBackup(data){
  const b=validateBackup(data);
  await transact(STORES,s=>{
    for(const name of STORES)s[name].clear();
    for(const c of b.classes)s.classes.put(c);
    for(const st of b.students)s.students.put(st);
    for(const se of b.sessions)s.sessions.put(se);
    for(const h of b.history)s.history.put(h);
    s.meta.put({id:'settings',value:b.settings});
    s.meta.put({id:'activeClass',value:b.activeClassId});
  });
  return b;
}
