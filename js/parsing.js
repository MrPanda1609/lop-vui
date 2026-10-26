export function cleanName(value){
  return String(value ?? '').normalize('NFC').replace(/[\t\u00a0 ]+/g,' ').trim();
}
export function parseNames(text){
  return String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).map(cleanName).filter(Boolean).filter(name => name.length <= 120);
}
export function findDuplicates(names){
  const counts = new Map();
  for (const name of names) counts.set(name.toLocaleLowerCase('vi'), (counts.get(name.toLocaleLowerCase('vi'))||0)+1);
  return [...counts].filter(([,count])=>count>1).length;
}
function splitCSVLine(line, separator){
  const fields=[]; let field=''; let quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(quoted && line[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===separator && !quoted){fields.push(field);field='';}
    else field+=c;
  }
  fields.push(field);
  return fields;
}
export function parseSheet(text){
  const src=String(text??'').replace(/^\uFEFF/,'').trim();
  if(!src) return {columns:[],rows:[]};
  const lines=src.split(/\r?\n/).filter(x=>x.trim());
  const tab=lines.some(x=>x.includes('\t'));
  const separator=tab?'\t':';';
  let columns;
  if(tab || lines.some(x=>x.includes(';'))) columns=lines.map(x=>splitCSVLine(x,separator));
  else if(lines.some(x=>x.includes(','))) columns=lines.map(x=>splitCSVLine(x,','));
  else columns=lines.map(x=>[x]);
  return {columns: columns[0]||[],rows:columns};
}
export function namesFromColumn(rows,index=0){return rows.map(row=>cleanName(row[index])).filter(Boolean).filter(name=>name.length<=120);}
export function csvField(value){return '"'+String(value??'').replace(/"/g,'""')+'"';}
