// Crypto rejection sampling removes modulo bias. Animation never controls the selected student.
export function secureInt(upperBound, source = globalThis.crypto){
  if(!Number.isSafeInteger(upperBound)||upperBound<1||upperBound>0x100000000) throw Error('Giới hạn ngẫu nhiên không hợp lệ.');
  if(!source?.getRandomValues) throw Error('Trình duyệt không hỗ trợ chọn ngẫu nhiên an toàn.');
  const range=0x100000000, limit=Math.floor(range/upperBound)*upperBound;
  const buffer=new Uint32Array(1);
  let value;
  do {source.getRandomValues(buffer); value=buffer[0];} while(value>=limit);
  return value%upperBound;
}
export function drawWinners(students, count, calledIds=[], avoidRepeats=true, random=secureInt){
  if(!Number.isInteger(count)||count<1||count>5) throw Error('Chỉ được chọn từ 1 đến 5 học sinh.');
  const called=new Set(calledIds);
  const eligible=students.filter(s=>s.isActive && (!avoidRepeats||!called.has(s.id)));
  if(eligible.length<count) throw Error(eligible.length===0?'Không còn học sinh đủ điều kiện.':`Chỉ còn ${eligible.length} học sinh đủ điều kiện.`);
  const pool=eligible.slice();const winners=[];
  for(let i=0;i<count;i++){
    const j=i+random(pool.length-i);
    [pool[i],pool[j]]=[pool[j],pool[i]];
    winners.push(pool[i]);
  }
  return winners;
}
