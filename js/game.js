import {drawAvatar,hashSeed} from './avatar.js';
import {playTone} from './audio.js';

const W=1200,H=620;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const blend=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const easeOut=t=>1-Math.pow(1-clamp(t,0,1),3);
const TAU=Math.PI*2;

function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=fill;ctx.fill();}
function rnd(n){const t=Math.sin(n*127.1+31.8)*43758.5453;return t-Math.floor(t);}
function banner(ctx,x,y,label,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,125,37,14);ctx.fill();ctx.fillStyle='#263731';ctx.textAlign='center';ctx.font='bold 16px system-ui';ctx.fillText(label,x+62,y+24);}

function drawCloud(ctx,x,y,s=1){ellipse(ctx,x,y,42*s,18*s,'#f8fcf7');ellipse(ctx,x+24*s,y-12*s,32*s,24*s,'#f8fcf7');ellipse(ctx,x+54*s,y+1*s,35*s,16*s,'#f8fcf7');}
function drawTree(ctx,x,y,variant=0){
  ctx.fillStyle='#92765f';ctx.fillRect(x-6,y-6,12,58);
  ellipse(ctx,x,y-28,26+variant*3,34,'#508b70');ellipse(ctx,x-10,y-34,18,24,'#619e7c');
}
function drawHay(ctx,x,y){ctx.fillStyle='#c98a4e';ctx.beginPath();ctx.roundRect(x,y-13,27,19,5);ctx.fill();ctx.strokeStyle='#9d713d';ctx.lineWidth=2;ctx.strokeRect(x+4,y-10,19,13);ctx.strokeStyle='#f5d998';ctx.beginPath();ctx.moveTo(x+9,y-13);ctx.lineTo(x+9,y+6);ctx.stroke();}
function laneMetrics(total){
  const lanes=total<=8?total:total<=20?5:7;
  const spacing=lanes<=4?43:lanes<=5?37:31;
  const top=lanes<=4?412:lanes<=5?416:410;
  return {lanes,spacing,top};
}
function runnerSize(total){return total<=10?56:total<=24?49:43;}
function measureLabel(total){
  if(total<=12)return {font:15,pad:22,height:27,maxWidth:168};
  if(total<=24)return {font:13,pad:18,height:25,maxWidth:146};
  return {font:11.5,pad:14,height:22,maxWidth:128};
}
function nameLabel(ctx,text,x,y,highlight,total){
  const metrics=measureLabel(total);
  const maxChars=total<=18?16:total<=30?13:11;
  const name=text.length>maxChars?text.slice(0,maxChars-1)+'…':text;
  ctx.font=`${highlight?'bold ':''}${metrics.font}px system-ui`;
  const wide=Math.min(metrics.maxWidth,ctx.measureText(name).width+metrics.pad);
  ctx.fillStyle=highlight?'#fff1bf':'#ffffffee';
  ctx.strokeStyle=highlight?'#c79348':'#ffffff';
  ctx.lineWidth=1.75;
  ctx.beginPath();ctx.roundRect(x-wide/2,y,wide,metrics.height,10);ctx.fill();ctx.stroke();
  ctx.fillStyle='#293930';ctx.textAlign='center';ctx.fillText(name,x,y+metrics.height-8);
}

function drawWorld(ctx,cameraX,time,{trackLength,finishX,lanes}){
  ctx.fillStyle='#dcedde';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#c7e3e3';ctx.fillRect(0,0,W,295);

  const sunX=960-cameraX*0.05;
  ellipse(ctx,sunX,104,59,59,'#f8d78b');
  for(let i=0;i<7;i++){
    const x=((i*270+30-cameraX*0.16)%1700+1700)%1700-180;
    const y=52+(i%3)*52;
    drawCloud(ctx,x,y,1+(i%2)*0.08);
  }

  ctx.fillStyle='#a6ceaf';ctx.beginPath();ctx.moveTo(0,310);
  for(let x=0;x<=W+40;x+=25){ctx.lineTo(x,268+Math.sin((x+cameraX*0.18)*0.008)*34+Math.sin((x+cameraX*0.18)*0.018)*13);}ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
  ctx.fillStyle='#84b494';ctx.beginPath();ctx.moveTo(0,340);
  for(let x=0;x<=W+40;x+=25){ctx.lineTo(x,328+Math.sin((x+cameraX*0.28)*0.009)*21);}ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();

  const treeStart=Math.floor((cameraX-240)/145);
  for(let i=treeStart;i<treeStart+16;i++){
    const worldX=i*145+45+(i%3)*13;
    const screenX=worldX-cameraX;
    const y=301+(i%3)*15;
    if(screenX>-90&&screenX<W+90)drawTree(ctx,screenX,y,i%3);
  }

  ctx.fillStyle='#60896d';ctx.fillRect(0,355,W,7);
  const fenceOffset=(-(cameraX*0.9)%44+44)%44;
  for(let x=-44+fenceOffset;x<W+60;x+=44){ctx.fillStyle='#e4e0b9';ctx.fillRect(x,351,6,41);}  
  ctx.fillStyle='#93b38a';ctx.fillRect(0,390,W,230);

  ctx.fillStyle='#e9cf99';ctx.beginPath();ctx.moveTo(0,389);ctx.lineTo(W,376);ctx.lineTo(W,603);ctx.lineTo(0,616);ctx.fill();
  ctx.strokeStyle='#fff4d7';ctx.lineWidth=5;ctx.setLineDash([32,37]);
  for(let i=0;i<5;i++){
    const y=418+i*37;
    ctx.beginPath();ctx.moveTo(-80-((cameraX*0.9)%69),y+7);ctx.lineTo(W+70,y-4);ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle='#c68d57';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,392);ctx.lineTo(W,378);ctx.moveTo(0,607);ctx.lineTo(W,596);ctx.stroke();

  const flagStart=Math.floor((cameraX-120)/180);
  for(let i=flagStart;i<flagStart+9;i++){
    const x=i*180+95-cameraX;
    if(x<-50||x>W+50)continue;
    ctx.fillStyle='#8c795e';ctx.fillRect(x,364,5,35);
    ctx.fillStyle=i%2?'#de9279':'#e8b967';ctx.beginPath();ctx.moveTo(x+4,365);ctx.lineTo(x+38,375);ctx.lineTo(x+4,386);ctx.closePath();ctx.fill();
  }

  const hayPositions=[0.28,0.43,0.62,0.79].map((f,i)=>finishX*f+90*i);
  for(let i=0;i<hayPositions.length;i++){
    const x=hayPositions[i]-cameraX;
    const y=424+(i%5)*34;
    if(x>-40&&x<W+40)drawHay(ctx,x,y);
  }

  const finishScreenX=finishX-cameraX;
  // A long run-out after the finish line gives every racer room to cross.
  if(finishScreenX<W+40&&finishScreenX+355>0){
    ctx.fillStyle='#f8e6bd5a';ctx.fillRect(finishScreenX+13,391,325,208);
    ctx.fillStyle='#f8f1d2';
    for(let y=401;y<598;y+=23)for(let col=0;col<2;col++){
      ctx.fillStyle=(Math.floor(y/23)+col)%2?'#506d5f':'#fffaf0';
      ctx.fillRect(finishScreenX+col*15,y,15,23);
    }
  }
  if(finishScreenX>-120&&finishScreenX<W+140){
    ctx.fillStyle='#3d7866';ctx.fillRect(finishScreenX-10,347,16,263);ctx.fillRect(finishScreenX+96,346,15,264);
    ctx.fillStyle='#f8efe0';ctx.fillRect(finishScreenX-10,328,121,32);
    ctx.fillStyle='#335a50';ctx.font='bold 20px system-ui';ctx.textAlign='center';ctx.fillText('ĐÍCH',finishScreenX+50,351);
    for(let i=0;i<8;i++)for(let j=0;j<2;j++){ctx.fillStyle=(i+j)%2?'#fff':'#323e38';ctx.fillRect(finishScreenX-4+j*8,399+i*25,8,25);}  
  }

  ctx.fillStyle='#74a876';ctx.fillRect(0,607,W,13);
  for(let i=0;i<47;i++){
    const x=(i*37-cameraX*0.8)%1230;
    ctx.strokeStyle='#4d8862';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,613);ctx.lineTo(x-3,606);ctx.moveTo(x,613);ctx.lineTo(x+4,605);ctx.stroke();
  }

  if(time===-1)banner(ctx,38,40,'SÂN CỎ XANH','#fff5df');
}

function drawRunner(ctx,runner,time,distance,cameraX,total,showNames){
  const screenX=distance-cameraX;
  const {spacing,top}=runner.laneInfo;
  const y=top+runner.lane*spacing+Math.sin(time*2.4+runner.i)*2;
  if(screenX<-70||screenX>W+90)return;
  const size=runnerSize(total);
  // The winner is chosen beforehand for fairness, but must not be visually
  // disclosed until the race has actually finished.
  const rankHighlight=runner.winnerRank===0 && runner.progress>=1 && runner.onPodium===true;
  const mode=rankHighlight?'celebrate':runner.hop?'jump':'run';
  if(runner.progress>0.01&&runner.progress<0.98){ellipse(ctx,screenX-29,y-4,11,3,'#ad915b5c');ellipse(ctx,screenX-42,y-9,5,3,'#b5a27762');}
  if(rankHighlight){ellipse(ctx,screenX,y-38,40,54,'#ffedab63');}
  drawAvatar(ctx,screenX,y,size,runner.student.avatarSeed,time*runner.animRate,mode);
  if(showNames){nameLabel(ctx,runner.student.displayName||runner.student.fullName,screenX,y-(size+24),rankHighlight,total);}
}

function drawConfetti(ctx,t){
  for(let i=0;i<45;i++){
    const x=480+rnd(i)*560;const y=((rnd(i+13)*H+t*(42+rnd(i+5)*68))%H)-30;
    ctx.fillStyle=['#e6ad5e','#dd8266','#6aa58d','#7599bb','#fff3d5'][i%5];
    ctx.save();ctx.translate(x,y);ctx.rotate(t*3+i);ctx.fillRect(-3,-6,6,12);ctx.restore();
  }
}

/**
 * Tốc độ phải liên tục tại từng checkpoint. Trong v0.3, smoothstep ở MỖI
 * đoạn làm đạo hàm bằng 0 ở cả hai đầu, nên mọi thú cứ chạy rồi khựng.
 * Monotone cubic Hermite giữ vận tốc dương ở các mốc, không vượt quá mốc
 * tiếp theo, và vẫn cho các thú vượt nhau theo kế hoạch mô phỏng đã khóa.
 */
export function continuousRaceCurve(points){
  if(points.length<2)throw Error('Đường đua phải có ít nhất hai mốc.');
  const spans=[];
  for(let i=0;i<points.length-1;i++){
    const dt=points[i+1].t-points[i].t;
    const dx=points[i+1].d-points[i].d;
    if(!(dt>0&&dx>0))throw Error('Các mốc đường đua phải tiến lên liên tục.');
    spans.push(dx/dt);
  }
  const tangent=points.map((point,i)=>{
    if(i===0)return spans[0]*.88;
    if(i===points.length-1)return spans.at(-1)*.88;
    const h0=points[i].t-points[i-1].t;
    const h1=points[i+1].t-points[i].t;
    const w0=2*h1+h0,w1=h1+2*h0;
    return (w0+w1)/(w0/spans[i-1]+w1/spans[i]);
  });
  return {points,tangent};
}
export function sampleRaceCurve(curve,p){
  const {points,tangent}=curve;
  if(p<=points[0].t)return points[0].d;
  if(p>=points.at(-1).t)return points.at(-1).d;
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    if(p>b.t)continue;
    const h=b.t-a.t,u=(p-a.t)/h,u2=u*u,u3=u2*u;
    return (2*u3-3*u2+1)*a.d + (u3-2*u2+u)*h*tangent[i]
      + (-2*u3+3*u2)*b.d + (u3-u2)*h*tangent[i+1];
  }
  return points.at(-1).d;
}

export function buildRacePlan(students,winners,trackLength,raceSeed=''){
  const winnerIds=winners.map(w=>w.id);
  const winnerMap=new Map(winnerIds.map((id,index)=>[id,index]));
  const laneInfo=laneMetrics(students.length);
  const finishX=trackLength-400;
  const finishDistance=finishX-135;
  const startBase=112;
  const lanes=laneInfo.lanes;
  const columns=Math.ceil(students.length/lanes);

  const others=students.filter(s=>!winnerMap.has(s.id)).slice().sort((a,b)=>(hashSeed(a.id+raceSeed)%1000)-(hashSeed(b.id+raceSeed)%1000));
  const finalOrder=[...winners,...others];
  const orderIndex=new Map(finalOrder.map((student,index)=>[student.id,index]));

  return students.map((student,i)=>{
    const lane=i%lanes;
    const slot=Math.floor(i/lanes);
    const seed=hashSeed(student.id+student.avatarSeed+raceSeed);
    const startX=startBase-slot*22-lane*5;
    const winnerRank=winnerMap.has(student.id)?winnerMap.get(student.id):-1;
    const finalRank=orderIndex.get(student.id)??(winnerIds.length+i);
    // Crossing slots, not a slow-down near the finish: everyone crosses before
    // the ceremony and remains running until the final racing frame.
    const totalRank=finalOrder.length;
    const crossingAt=.74+.205*(totalRank<=1?0:finalRank/(totalRank-1));
    const finalX=finishX+245-154*(totalRank<=1?0:finalRank/(totalRank-1));
    const style=rnd(seed+10);
    const cp1=blend(startX,finishX,(.14+style*.10));
    const cp2=blend(startX,finishX,(.35+rnd(seed+2)*.13));
    const cp3=blend(startX,finishX,(.63+rnd(seed+3)*.12));
    const points=[
      {t:0,d:startX},
      {t:.15,d:cp1},
      {t:.36,d:cp2},
      {t:.58,d:cp3},
      {t:crossingAt,d:finishX+2},
      {t:1,d:finalX}
    ];
    const target=finalX;
    return {
      student,i,lane,winnerRank,finalRank,startX,target,points,
      laneInfo,curve:continuousRaceCurve(points),animRate:1.1+rnd(seed+9)*0.5,hopSeed:rnd(seed+8),progress:0,hop:false
    };
  });
}

export function drawPreview(canvas,students=[]){
  if(!canvas)return;
  const dpr=Math.min(devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.scale(dpr,dpr);
  drawWorld(ctx,0,-1,{trackLength:W,finishX:W-170,lanes:5});
  const pool=students.slice(0,8);
  const total=Math.max(pool.length,6);
  const laneInfo=laneMetrics(total);
  const size=runnerSize(total)+6;
  const people=pool.length?pool:Array.from({length:6},(_,i)=>({avatarSeed:'preview-'+i,displayName:`Bạn ${i+1}`}));
  people.forEach((student,i)=>{
    // Keep preview labels away from cropped outer edges on narrow home panels.
    const x=280+(i%4)*207;
    const y=485+Math.floor(i/4)*71;
    drawAvatar(ctx,x,y,size,student.avatarSeed,i*.45,'idle');
    nameLabel(ctx,student.displayName||student.fullName||`Bạn ${i+1}`,x,y-(size+20),false,people.length);
  });
}

export class RaceEngine {
  constructor(canvas,students,winners,{duration='quick',reducedMotion=false,soundEnabled=false,volume=45,showNames=true,raceSeed='',onFinish=()=>{},onState=()=>{}}={}){
    this.canvas=canvas;this.students=students;this.winners=winners;this.settings={duration,reducedMotion,soundEnabled,volume,showNames};
    this.onFinish=onFinish;this.onState=onState;
    this.ctx=canvas.getContext('2d');if(!this.ctx)throw Error('Trình duyệt không hỗ trợ Canvas 2D.');
    this.finished=false;this.paused=false;this.destroyed=false;this.time=0;this.lastTime=0;this.raf=null;
    this.intro=reducedMotion?0:1.15;
    this.raceDuration=reducedMotion?.85:(duration==='quick'?8.2:13.8);
    this.ceremonyDuration=reducedMotion?.24:3.2;
    this.raceEnd=this.intro+this.raceDuration;
    this.total=this.raceEnd+this.ceremonyDuration;
    this.trackLength=students.length<=10?2450:students.length<=24?2850:3300;
    this.finishX=this.trackLength-400;
    this.runners=buildRacePlan(students,winners,this.trackLength,raceSeed);
    this.draw(0);
  }
  start(){if(this.destroyed||this.finished||this.raf)return;this.onState('running');this.lastTime=performance.now();this.raf=requestAnimationFrame(t=>this.tick(t));}
  tick(timestamp){
    this.raf=null;if(this.destroyed||this.finished)return;
    const dt=Math.min((timestamp-this.lastTime)/1000,.05);this.lastTime=timestamp;
    if(!this.paused){this.time+=dt;this.draw(this.time);if(this.time>=this.total){this.complete();return;}}
    this.raf=requestAnimationFrame(t=>this.tick(t));
  }
  progressAt(time){
    return clamp((time-this.intro)/this.raceDuration,0,1);
  }
  ceremonyProgress(time){return clamp((time-this.raceEnd)/this.ceremonyDuration,0,1);}
  getFinishCrossing(){return this.runners.map(r=>({id:r.student.id,crossingAt:r.points.at(-2).t})).sort((a,b)=>a.crossingAt-b.crossingAt);}
  drawPodium(ctx,time){
    const p=this.ceremonyProgress(time);
    if(p<=0)return;
    const appear=easeOut(p/.18);
    ctx.save();ctx.globalAlpha=appear;
    // Podium sits on the long run-out to the right of the finish post.
    ctx.fillStyle='#fdf4dd';ctx.beginPath();ctx.roundRect(746,251,448,353,26);ctx.fill();
    ctx.strokeStyle='#cca76d';ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle='#355e50';ctx.font='bold 26px system-ui';ctx.textAlign='center';ctx.fillText('TẤT CẢ ĐÃ VỀ ĐÍCH',970,296);
    const podium=[{x:808,y:486,w:117,h:104,rank:2,color:'#b5c8c6'},
      {x:923,y:447,w:117,h:143,rank:1,color:'#f0c878'},
      {x:1038,y:510,w:117,h:80,rank:3,color:'#d89b7d'}];
    for(const step of podium){
      ctx.fillStyle=step.color;ctx.beginPath();ctx.roundRect(step.x,step.y,step.w,step.h,[12,12,5,5]);ctx.fill();
      ctx.fillStyle='#315047';ctx.font='bold 35px system-ui';ctx.fillText(String(step.rank),step.x+step.w/2,step.y+step.h/2+11);
    }
    const ranking=this.getRanking().slice(0,3);
    for(let i=0;i<ranking.length;i++){
      const spot=podium.find(item=>item.rank===i+1);
      const stage=clamp((p-(i*.15+.10))/.32,0,1);
      if(stage<=0)continue;
      const landing=spot.y-5;
      const fromX=570+(i*36), toX=spot.x+spot.w/2;
      const fromY=575;
      const x=blend(fromX,toX,easeOut(stage));
      const y=blend(fromY,landing,stage)-Math.sin(Math.PI*stage)*95;
      drawAvatar(ctx,x,y,73,ranking[i].avatarSeed,time*(1+i*.2),stage>=1?'celebrate':'jump');
      if(stage>.75)nameLabel(ctx,ranking[i].displayName||ranking[i].fullName,x,y-96,false,3);
    }
    ctx.restore();
    if(p>.72&&!this.settings.reducedMotion)drawConfetti(ctx,time);
  }
  draw(time){
    const dpr=Math.min(devicePixelRatio||1,2);
    if(this.canvas.width!==W*dpr||this.canvas.height!==H*dpr){this.canvas.width=W*dpr;this.canvas.height=H*dpr;}
    const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);
    const progress=this.progressAt(time);

    let leaderDistance=0;
    for(const runner of this.runners){
      const distance=sampleRaceCurve(runner.curve,progress);
      runner.currentDistance=distance;
      runner.progress=progress;
      runner.hop=progress>0.03&&progress<0.95&&((time*1.8+runner.hopSeed*7)%4.2)<0.18;
      if(distance>leaderDistance)leaderDistance=distance;
    }
    const cameraTarget=progress<=0?0:clamp(leaderDistance-W*0.60,0,this.finishX-520);
    const cameraX=progress<=0.02?cameraTarget*progress*8:cameraTarget;

    drawWorld(ctx,cameraX,time,{trackLength:this.trackLength,finishX:this.finishX,lanes:laneMetrics(this.students.length).lanes});

    const racers=this.runners.slice().sort((a,b)=>a.lane-b.lane || a.finalRank-b.finalRank);
    // Once the very last runner crosses, clear the track labels so the three
    // podium jumps become the single visual focus.
    if(time<this.raceEnd){for(const runner of racers){drawRunner(ctx,runner,time,runner.currentDistance,cameraX,this.students.length,this.settings.showNames!==false);}}

    if(time<this.intro && !this.settings.reducedMotion){
      ctx.fillStyle='#f9f3ddf5';ctx.beginPath();ctx.roundRect(505,88,190,115,24);ctx.fill();
      ctx.fillStyle='#315a4d';ctx.textAlign='center';ctx.font='bold 68px system-ui';
      ctx.fillText(String(Math.max(1,Math.ceil(3*(1-time/this.intro)))),600,171);
    }
    if(!this.settings.reducedMotion && progress>0 && progress<.985){
      ctx.fillStyle='#2d493eac';ctx.beginPath();ctx.roundRect(35,38,205,38,19);ctx.fill();
      ctx.fillStyle='white';ctx.font='bold 17px system-ui';ctx.textAlign='center';ctx.fillText(this.runners.some(r=>r.currentDistance>=this.finishX)?`ĐÃ VỀ ĐÍCH ${this.runners.filter(r=>r.currentDistance>=this.finishX).length}/${this.runners.length}`:'CUỘC ĐUA ĐANG DIỄN RA',138,63);
    }
    if(time>=this.raceEnd){this.drawPodium(ctx,time);}
  }
  getRanking(){return this.runners.slice().sort((a,b)=>a.finalRank-b.finalRank).map(r=>r.student);}
  togglePause(){if(this.finished)return;this.paused=!this.paused;this.onState(this.paused?'paused':'running');return this.paused;}
  skip(){if(this.destroyed||this.finished)return;this.time=this.total;this.draw(this.time);this.complete();}
  complete(){if(this.finished||this.destroyed)return;this.finished=true;this.onState('finished');if(this.raf){cancelAnimationFrame(this.raf);this.raf=null;}if(this.settings.soundEnabled)playTone('win',true,this.settings.volume);this.onFinish();}
  destroy(){this.destroyed=true;if(this.raf)cancelAnimationFrame(this.raf);this.raf=null;}
}
