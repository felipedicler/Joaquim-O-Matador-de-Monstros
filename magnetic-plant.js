"use strict";

// Episódio 5. As coordenadas de cada setor são locais à sala.
const PLANT_GEMS = {
  amber: { name:'ÂMBAR', color:'#ffc05c', note:'amber' },
  blue: { name:'AZUL', color:'#64bfff', note:'blue' },
  green: { name:'VERDE', color:'#77e99e', note:'green' },
};
const PLANT_ROOMS = {
  hall: { title:'SAGUÃO DAS BOBINAS', width:812, decks:[[218,304,150,192],[630,734,142,192]],
    doors:[[73,192,'arsenal','ARSENAL','amber'],[355,192,'gallery','GALERIA','low'],
      [460,192,'cooling','BOMBAS','blue'],[564,192,'tower','TORRE','high'],
      [683,142,'power','DISTRIBUIÇÃO','green'],[765,192,'core','NÚCLEO','both']],
    targets:[[392,185,'low'],[593,139,'high']], weights:[[166,0]], loot:[260,150,'amber'] },
  arsenal: { title:'ARSENAL', width:288, doors:[[24,192,'hall','VOLTAR'],[259,192,'hall','ATALHO','practice']],
    targets:[[235,178,'practice']], grid:202, loot:[110,192,'gun'] },
  gallery: { title:'GALERIA DOS CONTRAPESOS', width:530, doors:[[24,192,'hall','VOLTAR'],[505,192,'hall','ELEVADOR','blue']],
    weights:[[121,0],[243,54],[320,106]], enemies:[['sentry',408,192,372,450]], loot:[473,192,'blue'] },
  tower: { title:'TORRE DE SINTONIA', width:378, decks:[[55,320,140,192],[132,298,88,140]],
    doors:[[25,192,'hall','VOLTAR'],[270,88,'hall','ELEVADOR','green']],
    targets:[[265,126,'mid'],[196,74,'upper']], enemies:[['sentry',218,140,165,253]], loot:[242,88,'green'] },
  cooling: { title:'ESTAÇÃO DE REFRIGERAÇÃO', width:326, doors:[[27,192,'hall','VOLTAR']],
    weights:[[145,70]], enemies:[['sentry',210,192,190,235]], lever:[280,192,'blue'] },
  power: { title:'SALA DE DISTRIBUIÇÃO', width:326, doors:[[27,192,'hall','VOLTAR']],
    enemies:[['beetle',193,192,118,263]], lever:[282,192,'green'] },
  core: { title:'CÂMARA DO NÚCLEO', width:256, weights:[[123,0]] },
};
const PLANT_GUN_ROWS=['...kkkkkkkkk','..kllmmmmmtk','..kmmdkkkkkk','...kddk.....','...kkk......'];
let pulseGun;
function plantStart() {
  pulseGun ||= makeSprite(PLANT_GUN_ROWS,{k:'#111423',l:'#dfddc6',m:'#8294a0',d:'#464154',t:'#70e9dc'});
  G.plant={room:'',visited:{},gems:{},switches:{},circuits:{},opened:{},gun:false,weapon:'sword',
    pending:false,shots:[],cool:0,clock:0,tip:'',tipT:0};
  plantEnter('hall',36,192);
}
function plantEnter(id,x,y) {
  const f=G.plant;
  if(f.room) f.visited[f.room]={enemies:G.enemies,items:G.items};
  const room=PLANT_ROOMS[id], saved=f.visited[id];
  f.room=id; f.shots=[]; f.clock=0; f.cool=0; f.tipT=0; f.pending=false;
  G.arena=[0,room.width]; G.cam=clamp(x-128,0,room.width-W);
  G.decks=(room.decks||[]).map(([left,right,y,bottom])=>({left,right,y,bottom}));
  G.rails=G.decks.flatMap(d=>[d.left+PLATFORM_LIP,d.right-PLATFORM_LIP].map(x=>({x,top:d.y,bottom:d.bottom})));
  G.enemies=saved?saved.enemies:(room.enemies||[]).map(([kind,x,y,min,max])=>({
    kind,x,y,min,max,face:-1,hp:kind==='beetle'?4:3,t:0,flash:0,gone:false,lastHit:-1,
  }));
  G.items=saved?saved.items:[];
  G.booms=[];G.parts=[];G.popups=[];G.hitStop=0;G.shake=0;
  G.player=makePlayer(x,G.player.hp);G.player.y=y;G.player.fromPlatform=y<GROUND?y:false;
  if(id==='core'){
    G.checkpoint={hp:G.player.hp,score:G.score,pacocas:G.pacocas,weapon:f.weapon};
    resetDynamo();
  }
}
function resetDynamo(){
  const f=G.plant, cp=G.checkpoint;
  G.state='play';G.endT=0;G.hitStop=0;G.shake=0;G.score=cp.score;G.pacocas=cp.pacocas;
  G.player=makePlayer(30,cp.hp);G.boss={hp:10,gone:false,t:0,flash:0,lastHit:-1,open:false};
  G.items=[];G.parts=[];G.popups=[];G.booms=[];f.clock=0;f.shots=[];f.cool=0;f.pending=false;f.weapon=cp.weapon;
  sound('arena');
}
function plantTip(msg,time=95){ G.plant.tip=msg;G.plant.tipT=time; }
function plantReady(lock){
  const f=G.plant;
  if(!lock)return true;
  if(lock==='both')return f.circuits.blue&&f.circuits.green;
  return f.gems[lock]||f.switches[lock];
}
function plantDoor(){
  const p=G.player,room=PLANT_ROOMS[G.plant.room];
  return (room.doors||[]).find(([x,y])=>Math.abs(p.x-x)<=15 && Math.abs(p.y-y)<=3);
}
function plantUse(){
  const f=G.plant,room=PLANT_ROOMS[f.room],p=G.player;
  if(!pressed.x||!p.onGround||p.hurtT||p.dead)return false;
  if(room.lever && Math.abs(p.x-room.lever[0])<=16){
    const key=room.lever[2];
    if(G.enemies.some(e=>!e.gone)){plantTip('ELIMINE A GUARDA');return false;}
    if(f.circuits[key]){plantTip('CIRCUITO JÁ LIGADO');return false;}
    f.circuits[key]=true;sound(PLANT_GEMS[key].note);plantTip('CIRCUITO LIGADO');return false;
  }
  const door=plantDoor();if(!door)return false;
  const [x,,dest,,lock]=door;
  if(!plantReady(lock)){
    plantTip(PLANT_GEMS[lock]?'FALTA O CRISTAL '+PLANT_GEMS[lock].name:
      lock==='both'?'LIGUE OS DOIS CIRCUITOS':'ACERTE O RECEPTOR');sound('warn');return false;
  }
  const doorKey=f.room+'/'+x;
  if(!f.opened[doorKey]&&PLANT_GEMS[lock]) sound(PLANT_GEMS[lock].note); else sound('retry');
  f.opened[doorKey]=true;
  if(dest==='hall'){
    let target=f.room;
    if(x>200 && f.room==='gallery')target='cooling';
    if(x>200 && f.room==='tower')target='power';
    if(x>200 && f.room==='arsenal')target='gallery';
    const [px,py]=PLANT_ROOMS.hall.doors.find(d=>d[2]===target);
    plantEnter(dest,px,py);
  }else plantEnter(dest,30,192);
  return true;
}
function weightPose(x,offset){
  // Cada ciclo começa no alto. O aviso antecede a descida, que é a parte perigosa.
  const core=G.plant.room==='core';
  let phase, high, low, rise;
  if(core){
    phase=G.plant.clock%220;
    high=60; low=105; rise=20;
    if(G.boss.hp<=5 && phase>=74 && phase<105){
      // Segundo golpe: recolhe rapidamente, pisca e torna a cair.
      const dt=phase-74;
      const lift=dt<8?dt/8:dt<18?1:Math.max(0,1-(dt-18)/12);
      return weightBox(x,lift,dt>=18 && dt<30,dt>=8 && dt<18);
    }
  }else{
    phase=(G.plant.clock+offset+114)%192;
    high=73; low=172; rise=20;
  }
  const fall=phase>=high && phase<high+13;
  let lift=0;
  if(phase<high)lift=1;
  else if(fall)lift=1-(phase-high)/13;
  else if(phase>=low)lift=Math.min(1,(phase-low)/rise);
  return weightBox(x,lift,fall,phase>=high-18 && phase<high);
}
function weightBox(x,lift,fall,warn){
  return {x:x-11,y:GROUND-42-Math.round(48*lift),w:22,h:42,open:lift===1,fall,warn};
}
function plantWeights(){
  const f=G.plant,room=PLANT_ROOMS[f.room];
  return (room.weights||[]).map(([x,t])=>weightPose(x,t));
}
function blockWeights(oldX){
  const p=G.player;if(p.dead)return;
  for(const w of plantWeights()){
    if(p.x+5<=w.x||p.x-5>=w.x+w.w)continue;
    if(w.open){
      if(oldX+5<=w.x || oldX-5>=w.x+w.w) p.lastWeightSide=oldX<w.x?-1:1;
      continue;
    }
    const side=oldX<=w.x?-1:oldX>=w.x+w.w?1:(p.lastWeightSide||-1);
    if(w.fall)hurtPlayer(w.x+w.w/2);
    p.x=side<0?w.x-5:w.x+w.w+5;p.vx=0;
  }
}
function addPulse(x,y,dir,hostile){
  G.plant.shots.push({x,y,vx:dir*(hostile?1.55:4.3),hostile});
  sound(hostile?'warn':'pulse');
}
function plantDamage(e,n){
  if(e.gone)return;
  e.hp=Math.max(0,e.hp-n);e.flash=9;sound('hit');
  if(!e.hp){
    e.gone=true;boom(e.x,e.y-12);awardPoints(200,e.x,e.y-24);dropPacoca(e.x,e.y-10,e.y);
  }
}
function hitCore(n){
  const b=G.boss;if(!b||!b.open||b.gone||G.player.dead)return;
  b.hp=Math.max(0,b.hp-n);b.flash=8;sound('hit');
  if(!b.hp){
    b.gone=true;G.plant.shots=[];boom(192,156,true);awardPoints(1000,191,144);
    dropPacoca(176,165);dropPacoca(202,165);sound('win');G.state='win';G.endT=0;
  }
}
function plantMobs(){
  const p=G.player,sb=swordBox(p);
  for(const e of G.enemies){
    if(e.gone)continue;
    e.t++;if(e.flash)e.flash--;if(e.guard)e.guard--;
    const near=Math.abs(p.x-e.x)<148;
    if(e.kind==='sentry'){
      if(near)e.face=p.x<e.x?-1:1;
      else if(e.x<e.min+1||e.x>e.max-1)e.face*=-1;
      if(e.t%120<85)e.x=clamp(e.x+e.face*.25,e.min,e.max);
      if(near&&e.t%120===119)addPulse(e.x+e.face*11,e.y-18,e.face,true);
    }else{
      const cycle=e.t%132;
      if(cycle<65)e.face=p.x<e.x?-1:1;
      if(cycle>=65 && cycle<90)e.x=clamp(e.x+e.face*1.25,e.min,e.max);
      e.exposed=cycle>=90;
    }
    const box=enemyBox(e);
    if(sb&&e.lastHit!==G.attackId&&overlap(sb,box)){
      e.lastHit=G.attackId;plantDamage(e,2);
    }else if(!e.gone&&overlap(playerBox(p),box))hurtPlayer(e.x);
  }
}
const DYNAMO_CORE={x:166,y:158,w:21,h:33};
function plantBoss(){
  const b=G.boss;if(!b||b.gone)return;
  b.t++;if(b.flash)b.flash--;
  const phase=b.t%220;
  b.open=phase>=115 && phase<205;
  if(phase===25 || (b.hp<=5 && phase===135))addPulse(155,GROUND-18,-1,true);
  const sb=swordBox(G.player);
  if(b.open && sb && b.lastHit!==G.attackId && overlap(sb,DYNAMO_CORE)){
    b.lastHit=G.attackId;hitCore(2);
  }
  if(!b.gone && G.player.x>=195){G.player.x=195;hurtPlayer(210);}
}
function plantShots(){
  const f=G.plant,room=PLANT_ROOMS[f.room],p=G.player,sb=swordBox(p);
  const survivors=[],weights=plantWeights();
  for(const q of f.shots){
    q.x+=q.vx;
    const box={x:q.x-2,y:q.y-1,w:4,h:3};
    if(q.x<2||q.x>room.width-2||weights.some(w=>overlap(w,box))||
       G.decks.some(d=>overlap(box,{x:d.left,y:d.y,w:d.right-d.left,h:5})))continue;
    if(q.hostile){
      if(sb&&overlap(sb,box)){q.hostile=false;q.vx=p.face*4.3;sound('parry');}
      else if(overlap(playerBox(p),box)){hurtPlayer(q.x);continue;}
    }else{
      const target=(room.targets||[]).find(([x,y,id])=>!f.switches[id]&&Math.abs(x-q.x)<=6&&Math.abs(y-q.y)<=3);
      if(target){f.switches[target[2]]=true;sound('seal');plantTip('RECEPTOR LIGADO');continue;}
      const enemy=G.enemies.find(e=>!e.gone&&overlap(box,enemyBox(e)));
      if(enemy){
        if(enemy.kind==='beetle'&&!enemy.exposed&&Math.sign(q.vx)===-enemy.face){enemy.guard=12;sound('parry');}
        else plantDamage(enemy,1);
        continue;
      }
      if(G.boss&&overlap(box,DYNAMO_CORE)){hitCore(1);continue;}
    }
    survivors.push(q);
  }
  f.shots=G.boss?.gone?[]:survivors;
}
function updatePlant(){
  const f=G.plant,p=G.player,room=PLANT_ROOMS[f.room],oldX=p.x;
  f.clock++;if(f.tipT)f.tipT--;if(f.cool)f.cool--;
  if(f.gun&&pressed.c&&!p.dead)f.pending=!f.pending;
  if(f.pending&&p.attackT<0){f.weapon=f.weapon==='gun'?'sword':'gun';f.pending=false;sound('rung');}
  updatePlayer();
  if(p.dead){if(p.deadT>70){G.state='over';G.endT=0;sound('over');}return;}
  blockWeights(oldX);
  if(room.grid&&!f.switches.practice)p.x=Math.min(p.x,room.grid-7);
  G.cam=clamp(Math.round(p.x-128),0,room.width-W);
  if(plantUse())return;
  if(room.loot){
    const [x,y,id]=room.loot;
    if(!(id==='gun'?f.gun:f.gems[id])&&Math.abs(p.x-x)<11&&Math.abs(p.y-y)<20){
      if(id==='green'&&!(f.switches.mid&&f.switches.upper))plantTip('LIGUE OS DOIS RECEPTORES',30);
      else if(id==='gun'){f.gun=true;f.weapon='gun';p.attackT=-1;sound('life');plantTip('Z: DISPARAR   C: TROCAR',190);}
      else{f.gems[id]=true;sound(id);plantTip('CRISTAL '+PLANT_GEMS[id].name);}
    }
  }
  if(f.weapon==='gun'&&keys.z&&!p.hurtT&&!p.climbing&&!f.cool){
    addPulse(p.x+p.face*10,p.y-(p.crouch?7:14),p.face,false);f.cool=15;
  }
  plantMobs();plantBoss();plantShots();updateItems();
}


function plate(x,y,w,h,c='#46516d'){
  R(ctx,x,y,w,h,'#161928');R(ctx,x+1,y+1,w-2,h-2,c);
  R(ctx,x+1,y+1,w-2,1,'#8792a4');R(ctx,x+1,y+h-2,w-2,1,'#303448');
}
function crystal(x,y,id,on=true){
  const c=on?PLANT_GEMS[id].color:'#575667',k='#191728';
  const pts=id==='amber'?[[0,-6],[5,0],[0,6],[-5,0]]:id==='blue'?[[0,-7],[4,-1],[5,2],[2,5],[-2,5],[-5,2],[-4,-1]]:
    [[-3,-5],[3,-5],[6,0],[3,5],[-3,5],[-6,0]];
  pixelShape(ctx,k,pts.map(([dx,dy])=>[x+dx*1.22,y+dy*1.22]));
  pixelShape(ctx,c,pts.map(([dx,dy])=>[x+dx,y+dy]));
  if(on)line(ctx,x-2,y+1,x,y-3,'#fff1c5');
}
function turbine(x,y,t){
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4+t*.008, cs=Math.cos(a),sn=Math.sin(a);
    pixelShape(ctx,'#343f56',[[5,-3],[24,-6],[32,1],[26,5],[10,5]].map(([u,v])=>[x+cs*u-sn*v,y+sn*u+cs*v]));
  }
  plate(x-5,y-5,11,11);
}
function drawPlantBackground(){
  const f=G.plant, id=f?.room||'hall', cam=G.cam||0,t=G.t;
  R(ctx,0,0,W,H,'#171e32');
  if(id==='hall'||id==='gallery'){
    R(ctx,0,59,W,48,'#242e49');R(ctx,0,107,W,32,'#3d465c');
    R(ctx,0,139,W,42,'#394659');
    const moon=174-Math.floor(cam*.09);
    ctx.drawImage(PLANET,moon-14,62,59,42);
    // Torres de captação na margem distante, refletidas no mar de metal.
    for(let i=-1;i<4;i++){
      const x=i*109+63-Math.floor(cam*.17)%109, h=17+(i+3)%3*6;
      pixelShape(ctx,'#323b53',[[x-13,140],[x-8,137],[x-4,137-h],[x,130-h],[x+4,137-h],[x+7,137],[x+15,140]]);
      R(ctx,x-1,129-h,2,4,'#af826b');R(ctx,x-8,141,17,1,'#627081');
      R(ctx,x-4,144,8,1,'#526277');
    }
    for(let i=0;i<33;i++){
      const x=((i*47+(t>>4)-Math.floor(cam*.18))%272+272)%272-8;
      R(ctx,x,141+(i*7)%38,3+i%8,1,i%4?'#48566b':'#7b8592');
    }
    for(let x=45-(Math.floor(cam*.5)%144);x<W;x+=144){
      R(ctx,x,29,5,154,'#293047');line(ctx,x+1,66,x+30,32,'#354058',2);
    }
  }else{
    for(let x=-(Math.floor(cam*.4)%80);x<W;x+=80){
      R(ctx,x,36,78,129,'#212a40');R(ctx,x+2,38,1,124,'#344058');
    }
    if(id==='cooling'||id==='core'){
      turbine(85-Math.floor(cam*.3),99,t);turbine(175-Math.floor(cam*.3),99,-t);
    }else if(id==='tower'){
      for(let y=49;y<150;y+=24){R(ctx,108-Math.floor(cam*.4),y,46,9,'#3e4558');R(ctx,108-Math.floor(cam*.4),y,46,2,'#846552');}
    }else if(id==='power'){
      // Bobinas com isoladores de cerâmica na sala de distribuição.
      for(let i=0;i<3;i++){
        const x=42+i*91-Math.floor(cam*.4);
        plate(x,132,32,8,'#4b4350');R(ctx,x+12,85,8,47,'#61515a');
        for(let j=0;j<5;j++)plate(x+3,92+j*8,26,5,'#82675a');
        plate(x+10,79,12,8,'#817678');
      }
    }else{
      for(let i=0;i<4;i++){
        const x=52+i*49-Math.floor(cam*.3);
        plate(x,84,22,39,'#303a50');
        for(let j=0;j<3;j++)R(ctx,x+4,90+j*5,11,1,j===1?'#97775c':'#536378');
      }
    }
  }
  R(ctx,0,27,W,4,'#313b52'); R(ctx,0,31,W,1,'#637087');
  R(ctx,0,181,W,11,'#292e43');R(ctx,0,GROUND,W,32,'#394258');R(ctx,0,GROUND,W,2,'#c6c9bc');
  for(let x=-(cam%32);x<W;x+=32){
    R(ctx,x,195,1,27,'#131526');R(ctx,x+3,197,2,2,'#8191a6');
    R(ctx,x+5,209,21,1,'#47526a');R(ctx,x+12,184,9,2,'#765c4e');
  }
}
function drawPlantObjects(){
  const f=G.plant,room=PLANT_ROOMS[f.room],cam=G.cam;
  for(const [wx,y,dest,label,lock] of room.doors||[]){
    const x=wx-cam;if(x<-32||x>W+32)continue;
    const ready=plantReady(lock), open=!lock || f.opened[f.room+'/'+wx];
    plate(x-14,y-33,28,33,'#594c48');
    R(ctx,x-10,y-29,20,29,open?'#172834':'#384154');
    if(!open){R(ctx,x,y-27,1,27,'#171b29');R(ctx,x-8,y-16,16,2,'#8a694f');}
    R(ctx,x+6,y-22,2,3,ready?'#76f0d3':'#d28a53');
    if(PLANT_GEMS[lock])crystal(x,y-39,lock);
    else if(dest==='core'){
      for(const [i,key] of ['blue','green'].entries())crystal(x-7+i*14,y-41,key,!!f.circuits[key]);
    }else R(ctx,x-6,y-31,12,2,ready?'#75caca':'#ba8252');
    text(label,x-textW(label)/2,y-(PLANT_GEMS[lock]||dest==='core'?54:43),'#cdd3db');
  }
  if(room.grid){
    const x=room.grid-cam;
    for(let y=117;y<(f.switches.practice?138:GROUND);y+=5)R(ctx,x-2,y,5,3,'#8393a2');
  }
  for(const [wx,y,id] of room.targets||[]){
    const x=wx-cam;plate(x-5,y-5,11,11,'#34364b');
    R(ctx,x-3,y-3,7,7,f.switches[id]?'#57d5bf':'#e5a458');
    R(ctx,x-1,y-1,3,3,'#f1eed5');
  }
  const weights=G.boss?.gone?[]:plantWeights();
  for(const w of weights){
    const x=w.x-cam;
    plate(x-3,34,w.w+6,10);R(ctx,x+8,44,5,w.y-44,'#495466');
    plate(x,w.y,w.w,w.h,'#756156');
    for(let i=0;i<3;i++)line(ctx,x+2+i*6,w.y+31,x+6+i*6,w.y+27,'#deb073',2);
    R(ctx,x+3,w.y+5,w.w-6,3,w.warn&&(f.clock&4)?'#ff8355':w.open?'#6bdfd5':'#db954d');
    R(ctx,x-2,GROUND-1,w.w+4,2,'#201e2b');
  }
  if(room.lever){
    const [wx,y,key]=room.lever,x=wx-cam,on=f.circuits[key];
    plate(x-8,y-16,16,16);line(ctx,x,y-13,x+(on?5:-5),y-25,'#dfbea0',3);
    crystal(x,y-7,key,!!on);
  }
  if(room.loot){
    const [wx,y,id]=room.loot,x=wx-cam;
    if(id==='gun'?!f.gun:!f.gems[id]){
      plate(x-10,y-4,20,4);
      if(id==='gun')spr(pulseGun,x-6,y-15,false);
      else crystal(x,y-13+Math.round(Math.sin(G.t*.09)*2),id);
      if(id==='green'&&!(f.switches.mid&&f.switches.upper)){
        for(let i=-8;i<=8;i+=4)R(ctx,x+i,y-22,1,18,'#96a5af');
      }
    }
  }
  for(const e of G.enemies){
    if(e.gone)continue;
    const x=Math.round(e.x-cam),y=e.y,lit=e.flash?'#fff4d6':'#939ca6';
    if(e.kind==='sentry'){
      plate(x-9,y-13,18,10,'#384157');R(ctx,x-8,y-3,16,3,'#242634');
      plate(x-6,y-23,12,12,'#595c69');R(ctx,x+e.face*3-2,y-19,5,3,e.t%120>90?'#ffd25b':'#68dcd2');
      for(let i=0;i<3;i++)R(ctx,x-6+i*5+(e.t>>3)%2,y-5,2,2,'#8d7464');
      R(ctx,x-3,y-12,6,2,'#ac7955');R(ctx,e.face>0?x+4:x-13,y-17,10,3,lit);
      R(ctx,x+e.face*12-1,y-18,3,4,'#51536a');
    }else{
      for(let i=-1;i<=1;i++)line(ctx,x+i*5,y-7,x+i*6-2,y-1,lit,2);
      pixelShape(ctx,e.guard?'#dcf4f0':e.exposed?'#e6ac66':lit,[[x-11,y-6],[x-8,y-15],[x-2,y-21],[x+5,y-20],[x+11,y-12],[x+12,y-6]]);
      line(ctx,x-6,y-13,x+5,y-17,'#43506b',2);
      const head=x+e.face*9;
      line(ctx,head,y-13,head+e.face*4,y-17,'#ac8a6e',2);
      R(ctx,head-1,y-11,3,2,'#ffb970');R(ctx,x-2,y-16,3,6,e.exposed?'#ffd284':'#627185');
    }
  }
  for(const q of f.shots){
    R(ctx,q.x-cam-4,q.y-1,8,3,q.hostile?'#d37541':'#329eac');
    R(ctx,q.x-cam-2,q.y,5,1,q.hostile?'#ffe28d':'#dcfff4');
  }
}
function drawDynamo(){
  const b=G.boss;if(!b||b.gone)return;
  const shell=b.flash?'#ead8b8':'#626e86', rim='#a3a8ae', dark='#2c344a';
  pixelShape(ctx,'#151c30',[[173,167],[172,122],[184,105],[201,99],[226,101],[246,116],[248,154],[238,174],[203,183]]);
  pixelShape(ctx,shell,[[175,163],[175,123],[186,108],[201,103],[225,104],[242,117],[244,153],[235,169],[205,178]]);
  line(ctx,177,122,188,108,rim,2);line(ctx,189,108,202,104,rim,2);
  for(const [x,y] of [[184,101],[231,96]]){
    plate(x,y,8,17,'#6e534f');plate(x-2,y-2,12,5,'#aa896c');
  }
  pixelShape(ctx,dark,[[201,115],[219,115],[232,126],[232,144],[220,157],[201,157],[189,145],[189,128]]);
  line(ctx,190,126,201,115,'#a99784',2);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3+b.t*.045, c=Math.cos(a),s=Math.sin(a);
    pixelShape(ctx,i%2?'#917357':'#bd8d61',[[4,-3],[14,-5],[18,0],[14,4],[6,3]].map(([dx,dy])=>[211+c*dx-s*dy,136+s*dx+c*dy]));
  }
  plate(207,132,9,9,'#567074');
  for(let i=0;i<3;i++)R(ctx,225,159+i*3,9-i*2,1,dark);
  for(const x of [194,225]){
    plate(x,169,10,16,'#8b827a');R(ctx,x+2,172,2,9,'#c1b09a');
  }
  const phase=b.t%220, charging=phase<25 || (b.hp<=5 && phase>=110 && phase<135);
  pixelShape(ctx,dark,[[121,88],[143,88],[166,102],[187,105],[192,118],[166,114],[141,98],[121,98]]);
  line(ctx,124,90,142,90,rim,2);line(ctx,142,91,166,105,'#8c776b',3);
  for(const [x,y] of [[123,93],[145,96],[169,108]])plate(x-3,y-3,7,7,'#987d6b');
  plate(156,170,13,9,'#796554');R(ctx,153,172,6,4,charging?'#ffd48c':'#768594');
  plate(157,150,23,9);
  plate(166,158,20,31,b.open?'#203a48':'#5b6574');
  if(b.open){R(ctx,169,165,14,18,'#4acac6');R(ctx,173,169,6,10,'#d9fff1');}
  else for(let y=163;y<185;y+=5)R(ctx,168,y,16,2,'#333c50');
  plate(188,179,20,13);plate(219,179,20,13);
}
function drawPlantHints(){
  const f=G.plant,p=G.player,room=PLANT_ROOMS[f.room],door=plantDoor();
  let msg=f.tipT?f.tip:'';
  if(!msg&&door)msg='X: '+door[3];
  if(!msg&&room.lever&&Math.abs(p.x-room.lever[0])<18)msg=f.circuits[room.lever[2]]?'CIRCUITO LIGADO':'X: LIGAR CIRCUITO';
  if(!msg&&f.clock<145)msg=f.room==='core'?'GUARDIÃO DO DÍNAMO':room.title;
  let hint='';
  if(f.room==='hall' && !f.gems.amber && f.clock<360)hint='BUSQUE O CRISTAL ÂMBAR';
  if(f.room==='hall' && !f.gems.amber && p.x>115 && p.x<205)hint='PASSE QUANDO O PESO SUBIR';
  if(f.room==='hall' && f.gems.amber && !f.gun)hint='VOLTE AO ARSENAL COM O CRISTAL';
  if(f.room==='hall' && f.gun && p.x>295 && p.x<620){
    if(p.x<440 && !f.switches.low)hint='ABAIXE E ATIRE NO RECEPTOR';
    if(p.x>495 && !f.switches.high)hint='PULE E ATIRE NO RECEPTOR';
  }
  if(f.room==='arsenal' && f.gun && !f.switches.practice)hint='ATIRE NA LUZ ALÉM DA GRADE';
  if(f.room==='tower' && (!f.switches.mid||!f.switches.upper))hint='ATIVE AS LUZES DOS DOIS ANDARES';
  if(f.room==='core' && !G.boss?.gone)hint=G.boss.open?'NÚCLEO EXPOSTO!':'ESPERE O NÚCLEO ABRIR';
  if(hint)textC(hint,55,'#a4e7dd');
  if(msg){
    const w=textW(msg)+12;R(ctx,(W-w)/2,35,w,14,'#161d31');textC(msg,40,'#ffe1a5');
  }
}
