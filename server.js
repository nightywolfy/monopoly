import express from 'express';
import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import {Server} from 'socket.io';
import IRC from 'irc-framework';
import {readFileSync,writeFileSync,existsSync,renameSync} from 'fs';
import crypto from 'crypto';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const app=express();
const server=http.createServer(app);
const io=new Server(server,{maxHttpBufferSize:1e6});
app.set('trust proxy',true);
app.use(express.urlencoded({extended:true}));
app.use(express.json({limit:'100kb'}));

const moneyFile=path.join(__dirname,'money.json');
const buildingsFile=path.join(__dirname,'building.json');
const piecesFile=path.join(__dirname,'pieces.json');
const display1File=path.join(__dirname,'display1.json');
const display2File=path.join(__dirname,'display2.json');
const dotsFile=path.join(__dirname,'dots.json');
const labelsFile=path.join(__dirname,'labels.json');

function safeReadJSON(file,fallback={}){
  try{if(!existsSync(file))return fallback;return JSON.parse(readFileSync(file,'utf-8'))}
  catch(err){console.error(`Error reading ${file}:`,err);return fallback}
}

function safeWriteJSON(file,data){
  const tmpFile=`${file}.tmp`;const json=JSON.stringify(data,null,2);
  try{writeFileSync(tmpFile,json,'utf-8');renameSync(tmpFile,file)}
  catch(err){console.error(`Error writing ${file}:`,err)}
}

let money=safeReadJSON(moneyFile,{p1:10,p2:10,p3:10,p4:10,p5:10,p6:10});
let pieces=safeReadJSON(piecesFile,{red:{x:825,y:755},blue:{x:825,y:755},orange:{x:825,y:755},green:{x:825,y:755},purple:{x:825,y:755},white:{x:825,y:755}});
let display1=safeReadJSON(display1File,{text:""});
let display2=safeReadJSON(display2File,{text:""});
let activeDots=safeReadJSON(dotsFile,{});
let buildings=safeReadJSON(buildingsFile,{});
let labels=safeReadJSON(labelsFile,{p1:'player1',p2:'player2',p3:'player3',p4:'player4',p5:'player5',p6:'player6'});

const saveMoney=()=>safeWriteJSON(moneyFile,money);
const saveBuildings=()=>safeWriteJSON(buildingsFile,buildings);
const savePieces=()=>safeWriteJSON(piecesFile,pieces);
const saveDisplay1=()=>safeWriteJSON(display1File,display1);
const saveDisplay2=()=>safeWriteJSON(display2File,display2);
const saveDots=()=>safeWriteJSON(dotsFile,activeDots);
const saveLabels=()=>safeWriteJSON(labelsFile,labels);

const buildingPositions={
  1:{x:740,y:795},
  3:{x:594,y:795},
  6:{x:376,y:795},
  8:{x:232,y:795},
  9:{x:160,y:795},
  
  21:{x:160,y:105},
  22:{x:232,y:105},
  24:{x:376,y:105},
  26:{x:522,y:105},
  28:{x:666,y:105},
  29:{x:740,y:105},

  11:{x:105,y:736},
  12:{x:105,y:665},
  14:{x:105,y:516},
  16:{x:105,y:370},
  17:{x:105,y:300},
  19:{x:105,y:156},
  
  31:{x:793,y:156},
  33:{x:793,y:300},
  34:{x:793,y:370},
  37:{x:793,y:590},
  39:{x:793,y:736},
  
  41:{x:594,y:680},
  42:{x:524,y:680},
  44:{x:376,y:680},
  45:{x:305,y:680},
  
  47:{x:218,y:590},
  50:{x:218,y:375},
  51:{x:218,y:305},
  
  53:{x:304,y:220},
  56:{x:523,y:220},
  57:{x:595,y:220},
  

  59:{x:678,y:300},
  63:{x:678,y:590}
};

const boardSpaces=[
  {number:0,x:825,y:825},
  {number:1,x:722,y:825},
  {number:2,x:650,y:825},
  {number:3,x:577,y:825},
  {number:4,x:505,y:825},
  {number:5,x:430,y:825},
  {number:6,x:360,y:825},
  {number:7,x:287,y:825},
  {number:8,x:215,y:825},
  {number:9,x:143,y:825},
  {number:10,x:35,y:825},
  {number:11,x:35,y:720},
  {number:12,x:35,y:648},
  {number:13,x:35,y:575},
  {number:14,x:35,y:503},
  {number:15,x:35,y:430},
  {number:16,x:35,y:360},
  {number:17,x:35,y:288},
  {number:18,x:35,y:215},
  {number:19,x:35,y:143},
  {number:20,x:35,y:40},
  {number:21,x:140,y:40},
  {number:22,x:210,y:40},
  {number:23,x:285,y:40},
  {number:24,x:358,y:40},
  {number:25,x:430,y:40},
  {number:26,x:503,y:40},
  {number:27,x:575,y:40},
  {number:28,x:650,y:40},
  {number:29,x:720,y:40},
  {number:30,x:820,y:40},
  {number:31,x:820,y:140},
  {number:32,x:820,y:212},
  {number:33,x:820,y:285},
  {number:34,x:820,y:355},
  {number:35,x:820,y:425},
  {number:36,x:820,y:500},
  {number:37,x:820,y:575},
  {number:38,x:820,y:645},
  {number:39,x:820,y:717},
  {number:40,x:685,y:710},
  {number:41,x:577,y:710},
  {number:42,x:505,y:710},
  {number:43,x:432,y:710},
  {number:44,x:360,y:710},
  {number:45,x:288,y:710},
  {number:46,x:150,y:710},
  {number:47,x:150,y:580},
  {number:48,x:150,y:505},
  {number:49,x:150,y:430},
  {number:50,x:150,y:360},
  {number:51,x:150,y:290},
  {number:52,x:150,y:150},
  {number:53,x:285,y:150},
  {number:54,x:358,y:150},
  {number:55,x:430,y:150},
  {number:56,x:500,y:150},
  {number:57,x:575,y:150},
  {number:58,x:710,y:150},
  {number:59,x:710,y:285},
  {number:60,x:710,y:355},
  {number:61,x:710,y:430},
  {number:62,x:710,y:500},
  {number:63,x:710,y:575}
];


const clickableSpaces=[
  {number:1,x:717,y:779},
  {number:3,x:572,y:779},
  {number:4,x:500,y:779},
  {number:5,x:425,y:779},
  {number:6,x:355,y:779},
  {number:8,x:210,y:779},
  {number:9,x:138,y:779},
  {number:11,x:15,y:715},
  {number:12,x:15,y:643},
  {number:13,x:15,y:570},
  {number:14,x:15,y:498},
  {number:15,x:15,y:425},
  {number:16,x:15,y:355},
  {number:17,x:15,y:283},
  {number:19,x:15,y:138},
  {number:21,x:134,y:16},
  {number:22,x:207,y:16},
  {number:24,x:352,y:16},
  {number:25,x:424,y:16},
  {number:26,x:497,y:16},
  {number:27,x:569,y:16},
  {number:28,x:644,y:16},
  {number:29,x:714,y:16},
  {number:31,x:774,y:135},
  {number:33,x:774,y:280},
  {number:34,x:774,y:350},
  {number:35,x:774,y:420},
  {number:37,x:774,y:570},
  {number:38,x:774,y:640},
  {number:39,x:774,y:712},
  {number:40,x:650,y:650},
  {number:41,x:570,y:660},
  {number:42,x:495,y:660},
  {number:44,x:355,y:660},
  {number:45,x:280,y:660},
  {number:46,x:140,y:650},
  {number:47,x:130,y:570},
  {number:50,x:130,y:350},
  {number:51,x:130,y:280},
  {number:52,x:140,y:150},
  {number:53,x:280,y:129},
  {number:56,x:495,y:129},
  {number:57,x:568,y:129},
  {number:58,x:650,y:145},
  {number:59,x:660,y:275},
  {number:63,x:660,y:568}
];

const colorMap={p1:'red',p2:'blue',p3:'orange',p4:'green',p5:'purple',p6:'white'};

function initializeDefaults(){
  Object.keys(colorMap).forEach(p=>{if(money[p]===undefined)money[p]=10});
  if(!buildings||typeof buildings!=='object')buildings={};
  for(const color of Object.values(colorMap)){if(!pieces[color])pieces[color]={x:825,y:755}}
  if(!display1.text)display1.text="";
  if(!display2.text)display2.text="";
  if(!labels||typeof labels!=='object')labels={};
  Object.keys(colorMap).forEach(p=>{if(!labels[p])labels[p]=p});
  saveMoney();saveBuildings();savePieces();saveDisplay1();saveDisplay2();saveDots();saveLabels();
}
initializeDefaults();

function safeEmit(event,data){try{io.emit(event,data)}catch(err){console.error(`[Socket] Emit failed (${event}):`,err)}}
function safeEmitTo(room,event,data){try{io.to(room).emit(event,data)}catch(err){console.error(`[Socket] Emit failed (${event} -> ${room}):`,err)}}
function updatePiece(player,x,y){const color=colorMap[player];if(!color)return;const current=pieces[color];if(current&&current.x===x&&current.y===y)return;pieces[color]={x,y};savePieces();safeEmit('piecesUpdate',pieces)}
function updateDisplay1(newText){if(display1.text===newText)return;display1.text=newText;saveDisplay1();safeEmit('displayUpdate1',{text:display1.text})}
function updateDisplay2(newText){if(display2.text===newText)return;display2.text=newText;saveDisplay2();safeEmit('displayUpdate2',{text:display2.text})}
function updateMoney(player,amount){if(!colorMap[player]||money[player]===amount)return;money[player]=amount;saveMoney();safeEmit('moneyUpdate',money)}

function updateLabel(player,text){if(!colorMap[player]||typeof text!=='string'||text.length<2||text.length>8||labels[player]===text)return;labels[player]=text;saveLabels();io.emit('labelsUpdate',labels)}

function getBuilding(space){return buildings[String(space)]||null}

function setBuilding(space,type,unset=false){
  const key=String(Number(space));
  if(Number.isNaN(Number(key)))return false;
  if(unset){
    if(!buildings[key])return false;
    const old=buildings[key];
    delete buildings[key];
    saveBuildings();
    safeEmit('buildingsUpdate',buildings);
    safeEmit('building-removed',{space:Number(key),type:old});
    return true;
  }else{
    const old=buildings[key];
    if(old===type)return false;
    if(old)delete buildings[key];
    buildings[key]=type;
    saveBuildings();
    safeEmit('buildingsUpdate',buildings);
    safeEmit('building-set',{space:Number(key),type});
    return {removed:old||null,set:type};
  }
}

function bulkUpdateBuildings(spaces,type=null,unset=false){
  let changed=false;
  const sanitized=spaces.map(s=>Number(s)).filter(n=>!Number.isNaN(n)&&n>=0&&n<=63);
  sanitized.forEach(space=>{
    const key=String(space);
    if(unset){if(buildings[key]){delete buildings[key];changed=true}}
    else if(type&&buildings[key]!==type){buildings[key]=type;changed=true}
  });
  if(!changed)return false;
  saveBuildings();
  safeEmit('buildingsUpdate',buildings);
  return true;
}

function clearAllBuildings(){
  const count=Object.keys(buildings).length;
  buildings={};
  saveBuildings();
  safeEmit('buildingsUpdate',buildings);
  return count;
}

function updateDot(num,color){
  const n=Number(num);if(Number.isNaN(n))return false;
  const table=currentMap===1?coordinates1:coordinates2;
  const pos=table[n];if(!pos)return false;
  activeDots[String(n)]={x:pos.x,y:pos.y,color:String(color)};
  saveDots();
  safeEmit('draw-dot',{x:pos.x,y:pos.y,color,num:n});
  return true;
}

function removeDot(num){
  const n=Number(num);
  if(isNaN(n)||!activeDots[String(n)])return false;
  delete activeDots[String(n)];
  saveDots();
  safeEmit('remove-dot',n);
  return true;
}

function clearAllDots(){
  activeDots={};
  saveDots();
  safeEmit('clear-all-dots');
}

const coordinates1={
1:{x:732,y:758},
3:{x:588,y:758},
4:{x:516,y:758},
5:{x:444,y:758},
6:{x:370,y:758},
8:{x:226,y:758},
9:{x:156,y:758},
21:{x:156,y:124},
22:{x:226,y:124},
24:{x:370,y:124},
25:{x:444,y:124},
26:{x:516,y:124},
27:{x:588,y:124},
28:{x:664,y:124},
29:{x:732,y:124},

11:{x:124,y:730},
12:{x:124,y:660},
13:{x:124,y:586},
14:{x:124,y:512},
15:{x:124,y:444},
16:{x:124,y:370},
17:{x:124,y:296},
19:{x:124,y:154},
31:{x:756,y:154},
33:{x:756,y:296},
34:{x:756,y:370},
35:{x:756,y:444},
37:{x:756,y:586},
38:{x:756,y:660},
39:{x:756,y:730}
};

const coordinates2 = {
1:{x:757,y:871},
3:{x:614,y:871},
4:{x:542,y:871},
5:{x:467,y:871},
6:{x:395,y:871},
8:{x:250,y:871},
9:{x:178,y:871},
21:{x:178,y:12},
22:{x:250,y:12},
24:{x:395,y:12},
25:{x:467,y:12},
26:{x:542,y:12},
27:{x:614,y:12},
28:{x:686,y:12},
29:{x:757,y:12},

11:{x:12,y:758},
12:{x:12,y:686},
13:{x:12,y:614},
14:{x:12,y:537},
15:{x:12,y:468},
16:{x:12,y:394},
17:{x:12,y:322},
19:{x:12,y:176},
31:{x:869,y:176},
33:{x:869,y:322},
34:{x:869,y:394},
35:{x:869,y:468},
37:{x:869,y:614},
38:{x:869,y:686},
39:{x:869,y:758},

41:{x:614,y:758},
42:{x:542,y:758},
44:{x:395,y:758},
45:{x:324,y:758},

53:{x:324,y:126},
56:{x:542,y:126},
57:{x:614,y:126},

47:{x:126,y:614},
50:{x:126,y:394},
51:{x:126,y:322},

59:{x:756,y:322},
63:{x:756,y:614},

40:{x:756,y:760},
52:{x:126,y:126},
46:{x:126,y:760},
58:{x:756,y:126}
};

let currentMap=2;

function createBot(nick,defaultTarget,options={}){
  const client=new IRC.Client();
  const host=options.host||'irc.libera.chat';
  const port=options.port||6667;
  const secure=!!options.secure;
  const nickServ=options.nickServ||null;
  let reconnectDelay=9000,isConnecting=false,isConnected=false,destroyed=false;
  const sendQueue=[],SEND_INTERVAL_MS=900;
  let sendInterval=null;

  function startSendLoop(){
    if(sendInterval)return;
    sendInterval=setInterval(()=>{
      if(!sendQueue.length||!isConnected)return;
      const{msg,target}=sendQueue.shift();
      try{client.say(target,msg)}catch(err){console.error(`[${nick}] send error:`,err)}
    },SEND_INTERVAL_MS);
  }
  startSendLoop();

  function stopSendLoop(){
    if(sendInterval){clearInterval(sendInterval);sendInterval=null}
  }

  function safeSay(target,msg){
    if(!msg||typeof msg!=='string')return;
    const clean=msg.trim().slice(0,200).replace(/\r?\n/g,' ');
    if(!clean)return;
    sendQueue.push({target,msg:clean});
  }

  function connectBot(){
    if(destroyed||isConnecting||isConnected)return;
    isConnecting=true;
    try{client.connect({host,port,nick,secure,timeout:20000,auto_reconnect:false})}
    catch(err){
      console.error(`${nick} connection error:`,err);
      isConnecting=false;
      reconnectDelay=Math.min(reconnectDelay*2,60000);
      setTimeout(connectBot,reconnectDelay);
    }
  }
  connectBot();

  client.on('registered',()=>{
    reconnectDelay=9000;
    isConnecting=false;
    isConnected=true;
    if(defaultTarget){try{client.join(defaultTarget)}catch{}}
    if(nickServ?.identifyCommand)client.say('NickServ',nickServ.identifyCommand);
  });

  client.on('close',()=>{
    isConnected=false;
    isConnecting=false;
    if(sendQueue.length>2000)sendQueue.length=0;
    setTimeout(()=>{
      reconnectDelay=Math.min(reconnectDelay*2,60000);
      connectBot();
    },reconnectDelay);
  });

  client.on('error',err=>console.error(`Error for ${nick}:`,err?.stack||err));

  client.on('message', (event) => {
    try {
      if (!event?.message) return;
      const raw = String(event.message).trim();
      if (!raw.startsWith('!')) return;
      const nick = event.nick;
      const target = event.target || nick;
      const defaultTarget = event.target;
      const commands = raw.split(' !').map((c,i) => i>0?'!'+c:c);
      for (const fullCmd of commands) {
        if (!fullCmd) continue;
        const parts = fullCmd.trim().split(/\s+/);
        const cmd = (parts.shift() || '').toLowerCase();
        const args = parts;

        switch(cmd) {
          case '!set': {
            if (args[0]?.toLowerCase() !== 'all' || args.length !== Object.keys(colorMap).length + 1) { safeSay(defaultTarget, `Usage: !set all <amounts for ${Object.keys(colorMap).length} players>`); break; }
            const amounts = args.slice(1).map(a=>parseInt(a,10));
            if (amounts.some(a=>isNaN(a))) { safeSay(defaultTarget,'All amounts must be valid numbers.'); break; }
            Object.keys(colorMap).forEach((p,i)=>updateMoney(p,Math.max(-999,Math.min(9999,amounts[i]))));
            break;
          }

          case '!display': {
            if (args.length !== Object.keys(colorMap).length) { safeSay(defaultTarget, `Usage: !display <names for ${Object.keys(colorMap).length} players>`); break; }
            if (args.some(n=>!/^[A-Za-z0-9_-]{2,8}$/.test(n))) { safeSay(defaultTarget,'Labels must be 2-8 letters/numbers/-/_ each.'); break; }
            Object.keys(colorMap).forEach((p,i)=>updateLabel(p,args[i]));
            break;
          }

          case '!mv': {
            const [target,...spacesStr] = args;
            if (target?.toLowerCase()!=='all') { safeSay(defaultTarget,'Only !mv all ... allowed'); break; }
            const players = Object.keys(colorMap);
            if (spacesStr.length!==players.length) { safeSay(defaultTarget,`Must provide exactly ${players.length} spaces`); break; }
            players.forEach((p,i)=>{ const space=parseInt(spacesStr[i],10); const entry=isNaN(space)?null:boardSpaces.find(s=>s.number===space); if(!entry){ safeSay(defaultTarget,`Invalid space "${spacesStr[i]}"`); return; } updatePiece(p,entry.x,entry.y); });
            break;
          }
          case '!mv2': {
            const [player,xStr,yStr]=args;
            const x=parseInt(xStr,10),y=parseInt(yStr,10);
            if(!colorMap[player]||isNaN(x)||isNaN(y)){ safeSay(defaultTarget,'Invalid player or coordinates'); break; }
            updatePiece(player,x,y);
            break;
          }
          case '!house1': {
              const spaces=args.map(a=>parseInt(a,10)).filter(n=>!isNaN(n)&&n>=0&&n<=63);
              if(spaces.length===0){safeSay(defaultTarget,'Usage: !house1 <space>');break;}
              const changed=bulkUpdateBuildings(spaces,'house1',false);
              break;
          }

          case '!house2': {
              const spaces=args.map(a=>parseInt(a,10)).filter(n=>!isNaN(n)&&n>=0&&n<=63);
              if(spaces.length===0){safeSay(defaultTarget,'Usage: !house2 <space>');break;}
              const changed=bulkUpdateBuildings(spaces,'house2',false);
              break;
          }

          case '!house3': {
              const spaces=args.map(a=>parseInt(a,10)).filter(n=>!isNaN(n)&&n>=0&&n<=63);
              if(spaces.length===0){safeSay(defaultTarget,'Usage: !house3 <space>');break;}
              const changed=bulkUpdateBuildings(spaces,'house3',false);
              break;
          }

          case '!house4': {
              const spaces=args.map(a=>parseInt(a,10)).filter(n=>!isNaN(n)&&n>=0&&n<=63);
              if(spaces.length===0){safeSay(defaultTarget,'Usage: !house4 <space>');break;}
              const changed=bulkUpdateBuildings(spaces,'house4',false);
              break;
          }
          case '!hotel': {
              const spaces=args.map(a=>parseInt(a,10)).filter(n=>!isNaN(n)&&n>=0&&n<=63);
              if(spaces.length===0){safeSay(defaultTarget,'Usage: !hotel <space>');break;}
              const changed=bulkUpdateBuildings(spaces,'hotel',false);
              break;
          }

          case '!clearall': {
              clearAllBuildings();
              break;
          }
          case '!d1': { const msgText=args.join(' ').trim().replace(/^"(.*)"$/,'$1'); if(!msgText){ safeSay(defaultTarget,'Usage: !d1 <text>'); break; } updateDisplay1(msgText); break; }
          case '!d2': { const msgText=args.join(' ').trim().replace(/^"(.*)"$/,'$1'); if(!msgText){ safeSay(defaultTarget,'Usage: !d2 <text>'); break; } updateDisplay2(msgText); break; }
          case '!dot': {
            if(args.length>=1){
              const color=args[args.length-1]||'red';
              const nums=args.slice(0,-1);
              nums.forEach(n=>updateDot(n,color));
            }
            break;
          }
          case '!removedot': {
            if (args.length >= 1) {
              const n = args[0];
              if(!removeDot(n)) safeSay(defaultTarget,`No dot at ${n}`);
            }
            break;
          }
          case '!cleardot': {
            clearAllDots();
            break;
          }
          case '!dotlocation': {
            const num = parseInt(args[0], 10);
            if (Number.isNaN(num) || (num !== 1 && num !== 2)) { safeSay(defaultTarget, 'Usage: !dotlocation <1 or 2>'); break; }
            currentMap = num;
            safeEmit('reload-dots', activeDots);
            break;
          }
          case '!map': {
            const num = parseInt(args[0], 10);
            if(isNaN(num)||num<1){safeSay(defaultTarget,'Usage: !map <number>');break;}
            safeEmit('map-change',num);
            break;
          }
          case '!sound': {
            const file=args[0];
            if(!file) break;
            if(target==='player2bot')io.emit('play-sound',{file});
            break;
          }
          default: break;
        }
      }
    } catch(err){ console.error(`Command error ${nick}:`,err?.stack||err); }
  });

  return {
    client, defaultTarget, say:(t,m)=>safeSay(t,m), connect:connectBot,
    destroy:()=>{destroyed=true;isConnecting=false;isConnected=false;stopSendLoop();try{client.quit('shutdown',true);}catch{}},
    getState:()=>({nick,isConnected,reconnectDelay})
  };
}

const bots={
  player1bot:createBot('player1bot','##rento',{delay:0}),
  player2bot:createBot('player2bot','##rento',{delay:7000}),
  player3bot:createBot('player3bot','##rento',{delay:14000}),
  player4bot:createBot('player4bot','##rento',{delay:21000}),
  player5bot:createBot('player5bot','##rento',{delay:28000}),
  player6bot:createBot('player6bot','##rento',{delay:35000})
};



app.post('/send-irc',(req,res)=>{
  try{
    const {bot,target,msg}=req.body||{};
    if(!bot||!msg)return res.status(400).send('Missing bot or message');
    if(!bots[bot])return res.status(400).send('Unknown bot');
    const cleanMsg=String(msg).trim();
    if(!cleanMsg)return res.redirect('/');
    const finalTarget=typeof target==='string'&&target.trim()?target.trim():'##rento';
    bots[bot].say(finalTarget,cleanMsg);
    return res.redirect('/');
  }catch(err){
    console.error('/send-irc error:',err);
    return res.status(500).send('Server error');
  }
});

io.on('connection',(socket)=>{
  try{
    const ip=socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim()||socket.handshake.address;
    console.log(`[Socket] Frontend connected: ${ip}`);
    socket.on('sendMessage',payload=>{
      if(!payload||typeof payload!=='object')return;
      const {bot,msg}=payload;
      if(!bots[bot]||typeof msg!=='string')return;
      const cleanMsg=msg.trim().slice(0,200).replace(/\n/g,' ');
      if(cleanMsg)bots[bot].say(bots[bot].defaultTarget,cleanMsg);
    });

    socket.on('getMoney',()=>socket.emit('moneyUpdate',money));
    socket.on('getPieces',()=>socket.emit('piecesUpdate',pieces));
    socket.on('getBuildings',()=>socket.emit('buildingsUpdate',buildings));
    socket.on('getDisplay1',()=>socket.emit('displayUpdate1',{text:display1.text}));
    socket.on('getDisplay2',()=>socket.emit('displayUpdate2',{text:display2.text}));
    socket.on('getLabels',()=>socket.emit('labelsUpdate',labels));
    socket.on('updateMoney',payload=>{
      const player=payload.player,amount=parseInt(payload.amount,10);
      if(colorMap[player]&&!Number.isNaN(amount)&&amount>=-999&&amount<=9999)updateMoney(player,amount);
    });
    socket.on('updateDisplay1',p=>{const t=String(p?.text||'').trim();if(t)updateDisplay1(t)});
    socket.on('updateDisplay2',p=>{const t=String(p?.text||'').trim();if(t)updateDisplay2(t)});

    socket.on('updateLabel',payload=>{const player=payload?.player,text=String(payload?.text||'').trim();if(colorMap[player]&&text.length>=2&&text.length<=8)updateLabel(player,text);});

    socket.emit('map-change',currentMap);
    socket.emit('reload-dots',activeDots);
    socket.emit('buildingPositions',buildingPositions);
    socket.emit('clickableSpacesData', clickableSpaces);
    socket.on('cmd-dot',({num,color})=>updateDot(num,color));
    socket.on('cmd-remove',num=>removeDot(num));
    socket.on('cmd-cleardot',()=>clearAllDots());
    socket.on('cmd-map',num=>{
      const n=Number(num);
      if(!Number.isNaN(n)&&n>=1){
        currentMap=n;
        safeEmit('map-change',currentMap);
        safeEmit('reload-dots',activeDots);
      }
    });

    socket.on('cmd-dotlocation',num=>{
      const n=Number(num);
      if(n===1||n===2){
        currentMap=n;
        safeEmit('reload-dots',activeDots);
      }
    });

    socket.on('cmd-set-building',({space,type})=>{
      if(typeof space!=='undefined'&&type)setBuilding(space,type,false);
    });

    socket.on('cmd-remove-building',space=>{
      if(typeof space!=='undefined')setBuilding(space,null,true);
    });

    socket.on('cmd-clear-buildings',()=>clearAllBuildings());

    socket.on('disconnect',()=>console.log(`[Socket] Frontend disconnected: ${ip}`));
  }catch(err){console.error('[Socket] Error:',err);}
});

app.use(express.static(__dirname));
app.get('/pieces.json',(_,res)=>res.json(pieces));
app.get('/money.json',(_,res)=>res.json(money));
app.get('/building.json',(_,res)=>res.json(buildings));
app.get('/display1.json',(_,res)=>res.json(display1));
app.get('/display2.json',(_,res)=>res.json(display2));
app.get('/dots.json',(_,res)=>res.json(activeDots));
app.get('/labels.json',(_,res)=>res.json(labels));

let shuttingDown=false;

async function gracefulShutdown(signal){
  if(shuttingDown)return;
  shuttingDown=true;
  console.log(`[Server] Received ${signal}, shutting down gracefully...`);
  try{
    saveMoney();saveBuildings();savePieces();saveDisplay1();saveDisplay2();saveDots();saveLabels();
    for(const bot of Object.values(bots)){
      try{bot.destroy()}catch(err){console.error('[Server] Error destroying bot:',err)}
    }
    io.close(()=>console.log('[Server] Socket.IO closed.'));
    server.close(()=>{
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
    setTimeout(()=>{
      console.warn('[Server] Forcing shutdown after 5 seconds.');
      process.exit(1);
    },5000);
  }catch(err){
    console.error('[Server] Error during graceful shutdown:',err);
    process.exit(1);
  }
}
['SIGINT','SIGTERM'].forEach(sig=>process.on(sig,()=>gracefulShutdown(sig)));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[Server] Running at http://127.0.0.1:${PORT}`));
//server.listen(PORT, () => console.log(`[Server] Running at http://192.168.1.67:${PORT}`));
