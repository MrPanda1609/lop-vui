/** Two original local Canvas mini-games. Outcome is supplied by the secure selector, never decided by animation. */
import {drawAvatar,hashSeed} from './avatar.js';
import {playTone} from './audio.js';
const MW=1200,MH=620,MTAU=Math.PI*2;
const clip=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clip(t);return t*t*(3-2*t);};
const fract=x=>x-Math.floor(x);
const noise=n=>fract(Math.sin(n*127.1+41.9)*43758.5453);
function oval(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,MTAU);c.fillStyle=color;c.fill();}
function box(c,x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function txt(c,s,x,y,size=20,color='#2d5041',align='center',weight=700){c.textAlign=align;c.fillStyle=color;c.font=`${weight} ${size}px system-ui`;c.fillText(s,x,y);}
function name(c,s,x,y,small=false){const text=(s.displayName||s.fullName);const cut=small?12:18;const label=text.length>cut?text.slice(0,cut-1)+'…':text;const size=small?12:15; c.font=`700 ${size}px system-ui`;const w=Math.min(small?126:185,c.measureText(label).width+19);box(c,x-w/2,y,w,small?24:29,10,'#fffffff0');txt(c,label,x,y+(small?16:20),size,'#315449');}
function confetti(c,t){for(let i=0;i<36;i++){const x=noise(i+3)*MW,y=fract(noise(i+26)+t*(.12+noise(i+60)*.06))*MH;c.save();c.translate(x,y);c.rotate(t*2+i);c.fillStyle=['#f7ba6d','#e68d79','#8dbcb1','#6ca9bc'][i%4];c.fillRect(-3,-6,6,12);c.restore();}}
function labelPill(c,title,detail){box(c,30,28,310,64,19,'#284f48cc');txt(c,title,48,56,20,'#fffdf2','left');txt(c,detail,48,78,14,'#f4f6df','left',600);}

/** Shared game lifecycle: RAF, pause/skip, visibility handled by app, delta clamping. */
class LocalGame {
 constructor(canvas,students,winners,opts={}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');if(!this.ctx)throw Error('Không thể khởi tạo Canvas 2D.');
  this.students=students;this.winners=winners;this.settings=opts;
  this.time=0;this.paused=false;this.finished=false;this.destroyed=false;this.raf=null;
  this.lastTime=0;this.total=1;this.order=[];
 }
 start(){if(this.destroyed||this.finished||this.raf)return;this.settings.onState?.('running');this.lastTime=performance.now();this.raf=requestAnimationFrame(t=>this.tick(t));}
 tick(ts){this.raf=null;if(this.destroyed||this.finished)return;const dt=clip((ts-this.lastTime)/1000,0,.05);this.lastTime=ts;if(!this.paused){this.time+=dt;this.draw(this.time);if(this.time>=this.total){this.complete();return;}}this.raf=requestAnimationFrame(t=>this.tick(t));}
 prepare(){const dpr=Math.min(window.devicePixelRatio||1,2);if(this.canvas.width!==MW*dpr||this.canvas.height!==MH*dpr){this.canvas.width=MW*dpr;this.canvas.height=MH*dpr;}this.ctx.setTransform(dpr,0,0,dpr,0,0);return this.ctx;}
 togglePause(){if(this.finished)return false;this.paused=!this.paused;this.settings.onState?.(this.paused?'paused':'running');return this.paused;}
 skip(){if(this.destroyed||this.finished)return;this.time=this.total;this.draw(this.time);this.complete();}
 complete(){if(this.destroyed||this.finished)return;this.finished=true;if(this.raf)cancelAnimationFrame(this.raf);this.raf=null;this.settings.onState?.('finished');if(this.settings.soundEnabled)playTone('win',true,this.settings.volume);this.settings.onFinish?.();}
 getRanking(){return this.order.slice();}
 destroy(){this.destroyed=true;if(this.raf)cancelAnimationFrame(this.raf);this.raf=null;}
}

/**
 * Mỗi nhân vật chạy vòng vèo độc lập trong vùng an toàn của đảo.
 * Nhân vật bị loại chạy CÓ HƯỚNG ra mép, sau đó rơi xuống mây.
 * Thứ tự loại đã khóa và chỉ dùng để quyết định thời điểm trình diễn.
 */
export function islandTerrainScale(progress){return 1-ease(clip((progress-.22)/.65))*.25;}
function panicPosition(r,p,total){
  const t=p*total,scale=islandTerrainScale(p);
  const angle=r.angle+r.direction*t*r.turnRate+.22*Math.sin(t*1.7+r.phase);
  const radius=clip(r.radius+.065*Math.sin(t*3.2+r.phase)+.029*Math.sin(t*6.6+r.phase*.7),.08,.84);
  return {x:600+495*.83*scale*radius*Math.cos(angle),y:350+94*.82*scale*radius*Math.sin(angle)};
}
export function islandActorPose(r,p,total){
  if(r.fallIndex<0 || p<r.lossStart){
    const here=panicPosition(r,p,total);
    const next=panicPosition(r,clip(p+.001),total);
    return {...here,alpha:1,fall:0,offscreen:false,exiting:false,facing:next.x>=here.x?1:-1};
  }
  const start=panicPosition(r,r.lossStart,total);
  const outward= Math.atan2((start.y-350)/94,(start.x-600)/495)+r.exitBend;
  const reachAt=r.lossStart+r.runDuration;
  const scale=islandTerrainScale(reachAt);
  const edge={x:600+495*.985*scale*Math.cos(outward),y:350+94*.985*scale*Math.sin(outward)};
  const run=clip((p-r.lossStart)/r.runDuration);
  const fall=clip((p-reachAt)/r.fallDuration);
  const offscreen=p>=reachAt+r.fallDuration;
  const bend=Math.sin(run*Math.PI)*15*r.direction;
  const x=lerp(start.x,edge.x,run)+bend+Math.cos(outward)*66*fall;
  const y=lerp(start.y,edge.y,run)+Math.sin(run*Math.PI)*6+210*fall*fall;
  return {x,y,alpha:fall<=.7?1:1-ease((fall-.7)/.3),fall,offscreen,exiting:true,
    facing:edge.x>=start.x?1:-1,warning:run>.35&&run<1};
}

/** Survival: lively panicked motion, edge sprints, and visible falling arcs. */
export class IslandEngine extends LocalGame {
 constructor(canvas,students,winners,opts={}){
  super(canvas,students,winners,opts);
  this.total=opts.reducedMotion?1.1:(opts.duration==='normal'?16:9.5);
  const chosen=new Set(winners.map(s=>s.id));
  const others=students.filter(s=>!chosen.has(s.id)).sort((a,b)=>hashSeed('island:'+a.id+(opts.raceSeed||''))-hashSeed('island:'+b.id+(opts.raceSeed||'')));
  this.order=[...winners,...others.slice().reverse()];
  this.elimination=[...others];
  const N=students.length;
  const golden=2.399963229728653;
  this.sprites=students.map((student,i)=>{
    const seed=hashSeed(student.id+'-island-'+(opts.raceSeed||''));
    const fallIndex=others.findIndex(other=>other.id===student.id);
    const orderRatio=fallIndex/Math.max(1,others.length-1);
    return {student,index:i,angle:i*golden+noise(seed+3)*.17,radius:Math.sqrt((i+.55)/N)*.78,
      phase:noise(seed+4)*MTAU,direction:seed%2===0?1:-1,
      turnRate:1.35+noise(seed+5)*1.25,exitBend:(noise(seed+6)-.5)*.24,
      fallIndex,lossStart:fallIndex<0?2:.16+.62*orderRatio,
      runDuration:.105,fallDuration:.095,selected:chosen.has(student.id)};
  });
  this.draw(0);
 }
 draw(time){
  const c=this.prepare(),p=clip(time/this.total);c.fillStyle='#c7e7ef';c.fillRect(0,0,MW,MH);
  for(let i=0;i<9;i++){const x=fract(noise(i+3)+time*.006*(i%3+1))*1400-100,y=95+(i%4)*75;oval(c,x,y,75,23,'#f6ffff');oval(c,x+36,y-15,46,33,'#f6ffff');}
  oval(c,982,110,78,78,'#ffe5a1');
  for(let i=0;i<8;i++){const x=100+i*156,y=535+(i%3)*40;oval(c,x,y,110,34,'#f5fdff9f');}
  const shake=p>.12&&p<.85?Math.sin(time*7)*1.2:0;
  c.save();c.translate(shake,Math.sin(time*.9)*4);
  const shrink=islandTerrainScale(p);
  c.save();c.translate(600,366);c.scale(shrink,shrink);c.translate(-600,-366);
  oval(c,600,425,520,133,'#618e79');oval(c,600,400,515,124,'#946e54');
  oval(c,600,381,516,112,'#d1a179');oval(c,600,358,517,112,'#8cb883');
  oval(c,600,350,500,95,'#b9d49c');
  for(let i=0;i<9;i++){const angle=i*MTAU/9;oval(c,600+230*Math.cos(angle),355+57*Math.sin(angle),20+(i%3)*10,10,'#9cc792');}
  c.save();c.beginPath();c.ellipse(600,350,499,94,0,0,MTAU);c.clip();
  for(let i=0;i<9;i++){
    const v=clip((p-.16-i*.071)/.13);if(v<=0)continue;
    const angle=-2.3+i*(MTAU/9);
    c.save();c.translate(600,350);c.scale(500,96);
    c.beginPath();c.moveTo(0,0);c.arc(0,0,.93,angle-.32,angle+.32);c.closePath();
    c.fillStyle=v<.55?'#e6c47e88':'#68989a';c.globalAlpha=v<.55?.8:.3+.65*ease((v-.55)/.45);c.fill();c.restore();
  }
  c.restore();
  for(let i=0;i<7;i++){const x=180+i*140,y=326+(i%2)*28;c.fillStyle='#8a6950';c.fillRect(x-4,y-55,8,58);oval(c,x,y-60,23,29,'#629d75');oval(c,x-9,y-66,14,20,'#82b993');}
  for(let i=0;i<9;i++)oval(c,245+i*90,420-(i%3)*15,19,9,'#73987f');
  c.restore();

  const poses=this.sprites.map(sprite=>({sprite,pose:islandActorPose(sprite,p,this.total)}))
    .filter(item=>!item.pose.offscreen).sort((a,b)=>a.pose.y-b.pose.y);
  const remaining=poses.filter(({pose})=>pose.fall===0).length;
  for(const {sprite:r,pose} of poses){
    const {x,y,fall,alpha,exiting,facing}=pose;
    const size=this.students.length>30?38:this.students.length>16?47:56;
    const small=this.students.length>16;
    const winnerCelebrate=r.selected&&p>.93;
    c.save();c.globalAlpha=alpha;
    if(fall>0){
      // A small cloud catches the tumbling animal; no impact or injury.
      oval(c,x,y+5,24*(1+fall),8*(1+fall),'#fffefaad');
      c.translate(x,y);c.rotate(facing*.52*fall);
      drawAvatar(c,0,0,size,r.student.avatarSeed,time*1.7,'surprised',facing);
    }else{
      if(exiting){oval(c,x-facing*15,y,11,5,'#d4aa77a8');}
      drawAvatar(c,x,y,size,r.student.avatarSeed,time*(1.45+r.turnRate*.21),winnerCelebrate?'celebrate':'run',facing);
      if(pose.warning){box(c,x-13,y-size-69,26,28,10,'#ffe4a2');txt(c,'!',x,y-size-48,20,'#9c5a41');}
    }
    if((this.students.length<=16||remaining<=10||r.selected&&p>.80) && fall<.22)
      name(c,r.student,x,y-size-24,small);
    c.restore();
  }
  labelPill(c,'ĐẢO SINH TỒN',`${remaining} nhân vật còn trên đảo`);
  if(p>.94&&!this.settings.reducedMotion)confetti(c,time);
 }
}

/**
 * Physical-looking plush pile. Extra toys are VISUAL CLONES only; their ids are
 * synthetic and NEVER enter the crypto selector, winner list or history.
 */
export function buildClawPile(students,raceSeed=''){
  if(!students.length)return [];
  const count=Math.min(84,Math.max(61,students.length+29));
  const slots=[];
  for(let row=0;row<11&&slots.length<count;row++){
    const cols=Math.max(3,12-row);
    const width=cols*57;
    for(let col=0;col<cols&&slots.length<count;col++){
      const slot=slots.length;
      const seed=hashSeed('pile-slot-'+slot+raceSeed);
      slots.push({
        x:600-width/2+col*57+28+(noise(seed+1)-.5)*15,
        y:451-row*28+(noise(seed+2)-.5)*14,
        layer:row,index:slot
      });
    }
  }
  // Scatter classmates across the pile instead of assigning all to one row.
  const assigned=slots.slice().sort((a,b)=>hashSeed(raceSeed+':'+a.index)-hashSeed(raceSeed+':'+b.index));
  const toySlots=students.map((student,i)=>({student,decorative:false,...assigned[i]}));
  for(let i=students.length;i<count;i++){
    const student=students[hashSeed('clone-'+raceSeed+'-'+i)%students.length];
    toySlots.push({student,decorative:true,...assigned[i]});
  }
  return toySlots.sort((a,b)=>a.y-b.y);
}

/** Arcade claw lifts the preselected person's own toy from a dense plush pile. */
export class ClawEngine extends LocalGame {
 constructor(canvas,students,winners,opts={}){
  super(canvas,students,winners,opts);
  this.total=opts.reducedMotion?1.2:(opts.duration==='normal'?7:5)+winners.length*(opts.duration==='normal'?5:3.5);
  this.order=winners.slice();
  this.toys=buildClawPile(students,opts.raceSeed||'');
  this.draw(0);
 }
 // Per-pick physical phases. All animation comes from local time, so pause/skip
 // never reselects a student and redraws are deterministic.
 grabPose(local,target){
  const topY=148, deepest=target.y-86;
  const scanX=600+Math.sin(local*20)*260;
  const alignStart=600+Math.sin(.16*20)*260;
  let x,y=topY,held=false,fall=0;
  if(local<.16)x=scanX;
  else if(local<.30)x=lerp(alignStart,target.x,ease((local-.16)/.14));
  else if(local<.72)x=target.x;
  else x=lerp(target.x,899,ease((local-.72)/.15));
  if(local>=.30&&local<.51)y=lerp(topY,deepest,ease((local-.30)/.21));
  else if(local>=.51&&local<.72)y=lerp(deepest,topY,ease((local-.51)/.21));
  if(local>=.51&&local<.88)held=true;
  if(local>=.88)fall=clip((local-.88)/.105);
  return {x,y,held,fall,closed:local>=.51&&local<.88};
 }
 draw(time){
  const c=this.prepare(),p=clip(time/this.total);
  c.fillStyle='#e8dfcb';c.fillRect(0,0,MW,MH);
  // Arcade cabinet, glass and large inner basin.
  box(c,112,18,969,575,40,'#b76a57');box(c,135,40,926,518,28,'#edb887');
  box(c,162,60,873,440,19,'#456c69');box(c,179,78,837,400,12,'#b7dce0');
  c.fillStyle='#e8f5ed';c.fillRect(194,103,802,314);
  for(let j=0;j<13;j++){c.fillStyle=j%2?'#f1d4ad':'#b8d6c3';c.fillRect(200+j*61,107,56,20);}
  // Pile basin shadow, rounded side walls and cloth bed.
  box(c,214,269,761,197,30,'#bb9c77');box(c,226,280,737,171,25,'#d9b486');
  oval(c,595,450,377,37,'#93745d65');

  const each=1/Math.max(1,this.winners.length);
  const activeIndex=Math.min(this.winners.length-1,Math.floor(p/each));
  const local=p>=1?1:clip((p-activeIndex*each)/each);
  const targetStudent=this.winners[activeIndex];
  const target=this.toys.find(t=>!t.decorative&&t.student.id===targetStudent.id);
  const pose=this.grabPose(local,target);
  const completed=new Set(this.winners.slice(0,activeIndex).map(w=>w.id));
  // All classmates appear at least once. Additional plushies purely decorate.
  for(const toy of this.toys){
    if(!toy.decorative && (completed.has(toy.student.id)||toy.student.id===targetStudent.id&&local>=.51))continue;
    const size=53+(toy.layer%3)*3;
    c.save();
    const shaking=!toy.decorative&&toy.student.id===targetStudent.id&&local>=.40&&local<.51;
    const shake=shaking?Math.sin(time*27)*5:Math.sin(time*1.7+toy.index)*1.5;
    c.translate(toy.x+shake,toy.y);
    c.rotate(((toy.index%5)-2)*.085+ (shaking?Math.sin(time*22)*.11:0));
    drawAvatar(c,0,0,size,toy.student.avatarSeed,time*.4,shaking?'surprised':'idle');
    c.restore();
  }

  // The claw passes in front of the heap and closes around the chosen plush.
  const clawX=pose.x,clawY=pose.y;
  c.strokeStyle='#5d6361';c.lineWidth=11;c.beginPath();c.moveTo(clawX,94);c.lineTo(clawX,clawY);c.stroke();
  box(c,clawX-31,clawY-16,62,32,12,'#f4cf77');
  c.strokeStyle='#596b62';c.lineWidth=9;c.lineCap='round';c.beginPath();
  const tipX=pose.closed?10:32;
  c.moveTo(clawX-20,clawY+11);c.lineTo(clawX-tipX-9,clawY+49);c.lineTo(clawX-tipX,clawY+67);
  c.moveTo(clawX+20,clawY+11);c.lineTo(clawX+tipX+9,clawY+49);c.lineTo(clawX+tipX,clawY+67);c.stroke();

  if(pose.held){
    // Fear/struggle: wobbling body and flailing limbs while tightly gripped.
    const wobble=Math.sin(time*30)*.20;
    c.save();c.translate(clawX+Math.sin(time*27)*4,clawY+88);c.rotate(wobble);
    drawAvatar(c,0,0,72,targetStudent.avatarSeed,time*1.5,'struggle');
    c.restore();
    if(local>.64)name(c,targetStudent,clawX,clawY-31,false);
  }
  // Release: the claw opens, plush tumbles visibly DOWN into the prize chute.
  if(pose.fall>0){
    const landingY=516;
    const fall=pose.fall;
    const toyY=lerp(236,landingY,fall*fall);
    c.save();c.translate(899+Math.sin(fall*MTAU*1.2)*12,toyY);c.rotate(.55*(1-fall)*Math.sin(fall*MTAU));
    drawAvatar(c,0,0,70,targetStudent.avatarSeed,time,fall<.92?'surprised':'celebrate');
    c.restore();
    if(fall>.85)name(c,targetStudent,899,409,false);
  }

  // Foreground glass / shell and destination for caught toys.
  c.save();c.globalAlpha=.19;c.fillStyle='#ffffff';c.beginPath();c.moveTo(214,93);c.lineTo(308,93);c.lineTo(226,391);c.lineTo(198,391);c.closePath();c.fill();c.restore();
  box(c,205,448,787,20,8,'#e5af76');
  box(c,806,468,193,79,14,'#9a4c41');box(c,820,484,163,49,9,'#633e38');
  // Keep the caught toy above the front rim at impact / result.
  if(local>=.985){drawAvatar(c,899,516,68,targetStudent.avatarSeed,time,'celebrate');name(c,targetStudent,899,410,false);}
  for(let i=0;i<6;i++)oval(c,244+i*140,545,14,14,i%2?'#72a5a0':'#e4cf96');
  box(c,302,6,595,57,16,'#fff2ce');txt(c,'MÁY GẮP MAY MẮN',600,45,29,'#355a50');
  box(c,16,25,270,60,17,'#284f48ee');txt(c,'ĐANG GẮP THÚ',31,50,18,'#fffdf2','left');txt(c,`${Math.min(this.winners.length,activeIndex+1)} / ${this.winners.length} lượt gắp`,31,70,14,'#f4f6df','left',600);
  if(p>.95&&!this.settings.reducedMotion)confetti(c,time);
 }
}

/** Distinct, static preview art built from the same game renderer; not placeholder thumbnails. */
export function previewMini(canvas,type,students=[]){
 if(!canvas)return;
 const first=students.slice(0,Math.max(1,Math.min(10,students.length)));
 if(!first.length){return;}
 const engine=type==='survival'?new IslandEngine(canvas,first,first.slice(0,1),{reducedMotion:true}):new ClawEngine(canvas,first,first.slice(0,1),{reducedMotion:true});
 engine.draw(engine.total*.15);engine.destroy();
}
