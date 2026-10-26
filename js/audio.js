let ctx;
export function playTone(type,enabled,volume=45){
  if(!enabled)return;
  try{
    ctx=ctx||new(window.AudioContext||window.webkitAudioContext)();
    if(ctx.state==='suspended')ctx.resume();
    const start=ctx.currentTime;
    const pitches=type==='win'?[523.25,659.25,783.99]:type==='tick'?[400]:[330,440];
    pitches.forEach((hz,i)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(hz,start+i*.12);
      gain.gain.setValueAtTime(.0001,start+i*.12);gain.gain.exponentialRampToValueAtTime(.11*Math.max(0,Math.min(100,volume))/100,start+i*.12+.01);gain.gain.exponentialRampToValueAtTime(.0001,start+i*.12+.18);
      osc.connect(gain);gain.connect(ctx.destination);osc.start(start+i*.12);osc.stop(start+i*.12+.2);
    });
  }catch{ /* Audio permission errors must never block the game. */ }
}
