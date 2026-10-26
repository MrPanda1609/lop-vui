import {AVATAR_COLORS} from './config.js';

export const AVATAR_PRESETS = Object.freeze([
  {seed:'preset-4', name:'Thỏ cam san hô'},
  {seed:'preset-10', name:'Thỏ xanh ngọc'},
  {seed:'preset-1', name:'Thỏ xanh lá'},
  {seed:'preset-15', name:'Thỏ tím hoa cà'},
  {seed:'preset-5', name:'Mèo hồng đào'},
  {seed:'preset-14', name:'Mèo vàng mật'},
  {seed:'preset-20', name:'Mèo cam san hô'},
  {seed:'preset-13', name:'Gấu cam san hô'},
  {seed:'preset-2', name:'Gấu tím hoa cà'},
  {seed:'preset-3', name:'Cún xanh ngọc'},
  {seed:'preset-9', name:'Cún vàng mật'},
  {seed:'preset-7', name:'Kỳ lân xanh lam'}
]);

export function hashSeed(s){let h=2166136261;for(const c of String(s)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function color(seed){return AVATAR_COLORS[seed%AVATAR_COLORS.length];}
function ellipse(ctx,x,y,rx,ry,fill,stroke=null,lw=3){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.lineWidth=lw;ctx.strokeStyle=stroke;ctx.stroke();}}
function roundRect(ctx,x,y,w,h,r,fill,stroke=null,lw=3){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.lineWidth=lw;ctx.strokeStyle=stroke;ctx.stroke();}}
/** Procedural, stable, original 2D animal mascots. Canvas local units ~100x116. */
export function drawAvatar(ctx,x,y,size,seedText,phase=0,state='idle',facing=1){
  const n=hashSeed(seedText), type=n%5, main=color(n>>>3), trim=color(n>>>7), outline='#3b4540';
  const move=state==='run'?Math.sin(phase*15)*5:state==='struggle'?Math.sin(phase*29)*12:0;
  const bounce=state==='run'?Math.abs(Math.sin(phase*15))*4:state==='celebrate'?Math.abs(Math.sin(phase*10))*8:state==='jump'?13:state==='struggle'?Math.abs(Math.sin(phase*22))*5:Math.sin(phase*2)*1.7;
  ctx.save();ctx.translate(x,y);ctx.scale((size/110)*facing,size/110);ctx.translate(0,-bounce);
  // ground shadow
  ctx.save();ctx.translate(0,bounce);ellipse(ctx,0,1,34,6,'#2c3a3324');ctx.restore();
  // ears, fins, tuft
  if(type===0){
    roundRect(ctx,-33,-110,22,57,12,main,outline,3);roundRect(ctx,11,-110,22,57,12,main,outline,3);
    roundRect(ctx,-27,-104,10,41,6,'#f5b2aa');roundRect(ctx,17,-104,10,41,6,'#f5b2aa');
  }else if(type===1){
    ctx.beginPath();ctx.moveTo(-39,-74);ctx.lineTo(-40,-116);ctx.lineTo(-10,-90);ctx.closePath();ctx.fillStyle=main;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=outline;ctx.stroke();
    ctx.beginPath();ctx.moveTo(39,-74);ctx.lineTo(40,-116);ctx.lineTo(10,-90);ctx.closePath();ctx.fillStyle=main;ctx.fill();ctx.stroke();
  }else if(type===2){
    ellipse(ctx,-35,-78,19,21,main,outline);ellipse(ctx,35,-78,19,21,main,outline);
    ellipse(ctx,-35,-78,9,11,'#f7d7b0');ellipse(ctx,35,-78,9,11,'#f7d7b0');
  }else if(type===3){
    ellipse(ctx,-37,-76,14,24,main,outline);ellipse(ctx,37,-76,14,24,main,outline);
  }else{
    ctx.beginPath();ctx.moveTo(-12,-92);ctx.lineTo(0,-119);ctx.lineTo(14,-92);ctx.closePath();ctx.fillStyle=trim;ctx.fill();ctx.strokeStyle=outline;ctx.lineWidth=3;ctx.stroke();
  }
  // legs with stepping phase
  ctx.lineCap='round';ctx.strokeStyle=outline;ctx.lineWidth=13;
  ctx.beginPath();ctx.moveTo(-15,-27);ctx.lineTo(-17+move,-6);ctx.moveTo(15,-27);ctx.lineTo(17-move,-6);ctx.stroke();
  ctx.strokeStyle=main;ctx.lineWidth=9;
  ctx.beginPath();ctx.moveTo(-15,-27);ctx.lineTo(-17+move,-6);ctx.moveTo(15,-27);ctx.lineTo(17-move,-6);ctx.stroke();
  // body
  ellipse(ctx,0,-43,32,33,main,outline,3.5);ellipse(ctx,0,-36,19,20,'#ffead2');
  // arms
  ctx.strokeStyle=outline;ctx.lineWidth=12;
  ctx.beginPath();ctx.moveTo(-27,-48);ctx.lineTo(-38-move*.65,-42+(state==='celebrate'?-25:state==='struggle'?-22+move:move));ctx.moveTo(27,-48);ctx.lineTo(38+move*.65,-42+(state==='celebrate'?-25:state==='struggle'?-22-move:-move));ctx.stroke();
  ctx.strokeStyle=main;ctx.lineWidth=8;ctx.stroke();
  // big head
  ellipse(ctx,0,-79,43,35,main,outline,3.5);
  // hair tuft or spot
  if(n%3===0){ellipse(ctx,-13,-98,10,5,trim);ellipse(ctx,2,-101,7,5,trim);}
  // cheeks
  ellipse(ctx,-26,-74,8,5,'#ee9b91a6');ellipse(ctx,26,-74,8,5,'#ee9b91a6');
  // eyes
  const eyeY=['surprised','struggle'].includes(state)?-84:-83;
  ellipse(ctx,-15,eyeY,4.5,['surprised','struggle'].includes(state)?7:5,'#25332c');ellipse(ctx,15,eyeY,4.5,['surprised','struggle'].includes(state)?7:5,'#25332c');
  ellipse(ctx,-16,eyeY-2,1.5,1.5,'white');ellipse(ctx,14,eyeY-2,1.5,1.5,'white');
  // nose / snout
  ellipse(ctx,0,-69,8,6,'#fbe9d3');ellipse(ctx,0,-70,3.4,2.7,'#493e3b');
  ctx.beginPath();ctx.strokeStyle='#493e3b';ctx.lineWidth=2.5;
  if(state==='struggle'){ellipse(ctx,0,-64,5,7,'#493e3b');}else if(state==='celebrate'){ctx.arc(0,-65,7,0,Math.PI);ctx.stroke();}else{ctx.arc(0,-65,5,0.1,Math.PI-.1);ctx.stroke();}
  // tiny outfit stripe
  if(n%2===0)roundRect(ctx,-16,-45,32,6,3,trim);
  ctx.restore();
}
export function avatarSvg(seedText, size=80){
  const c=document.createElement('canvas');c.width=size*2;c.height=size*2;
  const ctx=c.getContext('2d');ctx.scale(2,2);drawAvatar(ctx,size/2,size*.99,size*.76,seedText,0,'idle');
  return c.toDataURL('image/png');
}
