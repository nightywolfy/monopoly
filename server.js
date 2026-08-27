import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import {Server} from 'socket.io';
import {readFileSync,writeFileSync,existsSync,renameSync} from 'fs';
import express from 'express';
import {createHash,timingSafeEqual} from 'crypto';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const app=express();
const server=http.createServer(app);
const io=new Server(server,{maxHttpBufferSize:1e6});
const BOT_NAME='player1bot';

app.set('trust proxy',true);
app.use(express.urlencoded({extended:true}));
app.use(express.json({limit:'100kb'}));

const ADMIN_USERNAME='admin';
const ADMIN_PASSWORD_HASH='4ac134964872c4b0e2027c2be20aa440fa4e699ba9c5b9f1929bdab52824e424';

function hashPassword(password){
return createHash('sha256').update(String(password)).digest('hex');
}

function checkAdminPassword(password){
try{
const supplied=Buffer.from(hashPassword(password),'utf8');
const stored=Buffer.from(ADMIN_PASSWORD_HASH,'utf8');
if(supplied.length!==stored.length)return false;
return timingSafeEqual(supplied,stored);
}catch(err){return false}
}

const moneyFile=path.join(__dirname,'money.json');
const buildingsFile=path.join(__dirname,'building.json');
const piecesFile=path.join(__dirname,'pieces.json');
const display1File=path.join(__dirname,'display1.json');
const display2File=path.join(__dirname,'display2.json');
const dotsFile=path.join(__dirname,'dots.json');
const labelsFile=path.join(__dirname,'labels.json');

function safeReadJSON(file,fallback={}){try{if(!existsSync(file))return fallback;return JSON.parse(readFileSync(file,'utf-8'))}catch(err){return fallback}}
function safeWriteJSON(file,data){const tmp=`${file}.tmp`;try{writeFileSync(tmp,JSON.stringify(data,null,2),'utf-8');renameSync(tmp,file)}catch(err){}}

let money=safeReadJSON(moneyFile,{p1:10,p2:10,p3:10,p4:10,p5:10,p6:10});
let pieces=safeReadJSON(piecesFile,{});
let display1=safeReadJSON(display1File,{text:""});
let display2=safeReadJSON(display2File,{text:""});
let activeDots=safeReadJSON(dotsFile,{});
let buildings=safeReadJSON(buildingsFile,{});
let labels=safeReadJSON(labelsFile,{p1:'p1',p2:'p2',p3:'p3',p4:'p4',p5:'p5',p6:'p6'});

const saveMoney=()=>safeWriteJSON(moneyFile,money);
const saveBuildings=()=>safeWriteJSON(buildingsFile,buildings);
const savePieces=()=>safeWriteJSON(piecesFile,pieces);
const saveDisplay1=()=>safeWriteJSON(display1File,display1);
const saveDisplay2=()=>safeWriteJSON(display2File,display2);
const saveDots=()=>safeWriteJSON(dotsFile,activeDots);
const saveLabels=()=>safeWriteJSON(labelsFile,labels);
const connectedIPs={};
const clientInfo={};
const colorMap={p1:'red',p2:'blue',p3:'orange',p4:'green',p5:'purple',p6:'white'};
const PLAYERS=Object.keys(colorMap);
const HOUSE_TYPES=new Set(['house1','house2','house3','house4','hotel']);

const WINDOWS_NT_MAP={
'5.0':'Windows 2000',
'5.1':'Windows XP',
'5.2':'Windows XP x64',
'6.0':'Windows Vista',
'6.1':'Windows 7',
'6.2':'Windows 8',
'6.3':'Windows 8.1'
};

function parseUserAgent(ua,headers={}){
if(!ua)return{os:'Unknown',browser:'Unknown'};

let os='Unknown';

const ntMatch=ua.match(/Windows NT ([\d.]+)/);
if(ntMatch){
const nt=ntMatch[1];
if(nt==='10.0'){

const hint=headers['sec-ch-ua-platform-version'];
if(hint){
const major=parseInt(String(hint).replace(/"/g,'').split('.')[0],10);
if(!isNaN(major))os=major>=13?'Windows 11':'Windows 10';
}
if(os==='Unknown')os='Windows 10/11 (unconfirmed)';
}else{
os=WINDOWS_NT_MAP[nt]||`Windows (NT ${nt})`;
}
}else if(/Mac OS X/.test(ua)){
const m=ua.match(/Mac OS X ([\d_]+)/);
os=m?`macOS ${m[1].replace(/_/g,'.')}`:'macOS';
}else if(/Android/.test(ua)){
const m=ua.match(/Android ([\d.]+)/);
os=m?`Android ${m[1]}`:'Android';
}else if(/iPhone|iPad|iPod/.test(ua)){
const m=ua.match(/(?:iPhone )?OS ([\d_]+) like Mac OS X/);
os=m?`iOS ${m[1].replace(/_/g,'.')}`:'iOS';
}else if(/Linux/.test(ua)){
os='Linux';
}

let browser='Unknown';
let bMatch;
if((bMatch=ua.match(/Edg\/([\d.]+)/)))browser=`Edge ${bMatch[1]}`;
else if((bMatch=ua.match(/OPR\/([\d.]+)/)))browser=`Opera ${bMatch[1]}`;
else if(/Chrome\//.test(ua)&&!/Chromium/.test(ua)&&(bMatch=ua.match(/Chrome\/([\d.]+)/)))browser=`Chrome ${bMatch[1]}`;
else if((bMatch=ua.match(/Firefox\/([\d.]+)/)))browser=`Firefox ${bMatch[1]}`;
else if(/Safari\//.test(ua)&&(bMatch=ua.match(/Version\/([\d.]+)/)))browser=`Safari ${bMatch[1]}`;

return{os,browser};
}

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
{number:3,x:576,y:825},
{number:4,x:504,y:825},
{number:5,x:430,y:825},
{number:6,x:360,y:825},
{number:7,x:286,y:825},
{number:8,x:214,y:825},
{number:9,x:142,y:825},
{number:10,x:35,y:825},
{number:21,x:142,y:40},
{number:22,x:214,y:40},
{number:23,x:286,y:40},
{number:24,x:360,y:40},
{number:25,x:430,y:40},
{number:26,x:504,y:40},
{number:27,x:576,y:40},
{number:28,x:650,y:40},
{number:29,x:722,y:40},
{number:11,x:35,y:720},
{number:12,x:35,y:648},
{number:13,x:35,y:574},
{number:14,x:35,y:502},
{number:15,x:35,y:428},
{number:16,x:35,y:354},
{number:17,x:35,y:286},
{number:18,x:35,y:212},
{number:19,x:35,y:140},
{number:20,x:35,y:40},
{number:30,x:820,y:40},
{number:31,x:820,y:140},
{number:32,x:820,y:212},
{number:33,x:820,y:286},
{number:34,x:820,y:354},
{number:35,x:820,y:428},
{number:36,x:820,y:502},
{number:37,x:820,y:574},
{number:38,x:820,y:648},
{number:39,x:820,y:720},
{number:40,x:686,y:710},
{number:46,x:150,y:710},
{number:52,x:150,y:150},
{number:58,x:686,y:150},
{number:41,x:576,y:710},
{number:42,x:504,y:710},
{number:43,x:432,y:710},
{number:44,x:360,y:710},
{number:45,x:286,y:710},
{number:53,x:286,y:150},
{number:54,x:360,y:150},
{number:55,x:432,y:150},
{number:56,x:504,y:150},
{number:57,x:576,y:150},
{number:47,x:150,y:576},
{number:48,x:150,y:504},
{number:49,x:150,y:430},
{number:50,x:150,y:356},
{number:51,x:150,y:286},
{number:59,x:710,y:286},
{number:60,x:710,y:356},
{number:61,x:710,y:430},
{number:62,x:710,y:504},
{number:63,x:710,y:576}
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

const coordinates2={
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

function initializeDefaults(){
if(!buildings||typeof buildings!=='object')buildings={};
if(!labels||typeof labels!=='object')labels={};
PLAYERS.forEach(p=>{
if(money[p]===undefined)money[p]=10;
if(!pieces[p])pieces[p]={x:825,y:755};
if(!labels[p])labels[p]=p;
});
if(!display1.text)display1.text="";
if(!display2.text)display2.text="";
saveMoney();saveBuildings();savePieces();saveDisplay1();saveDisplay2();saveDots();saveLabels();
}

initializeDefaults();

function safeEmit(event,data){
try{io.emit(event,data)}catch(err){console.error(`[Socket] Emit failed (${event}):`,err)}
}

function updatePiece(player,x,y){
if(!colorMap[player])return;
const current=pieces[player];
if(current&&current.x===x&&current.y===y)return;
pieces[player]={x,y};
savePieces();
safeEmit('piecesUpdate',pieces);
}

function updateDisplay1(newText){
if(display1.text===newText)return;
display1.text=newText;
saveDisplay1();
safeEmit('displayUpdate1',{text:display1.text});
}

function updateDisplay2(newText){
if(display2.text===newText)return;
display2.text=newText;
saveDisplay2();
safeEmit('displayUpdate2',{text:display2.text});
}

function updateMoney(player,amount){
if(!colorMap[player]||money[player]===amount)return;
money[player]=amount;
saveMoney();
safeEmit('moneyUpdate',money);
}

function updateLabel(player,text){
if(!colorMap[player]||typeof text!=='string'||text.length<2||text.length>8||labels[player]===text)return;
labels[player]=text;
saveLabels();
safeEmit('labelsUpdate',labels);
}

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
}
const old=buildings[key];
if(old===type)return false;
if(old)delete buildings[key];
buildings[key]=type;
saveBuildings();
safeEmit('buildingsUpdate',buildings);
safeEmit('building-set',{space:Number(key),type});
return{removed:old||null,set:type};
}

function bulkUpdateBuildings(spaces,type=null,unset=false){
let changed=false;
const sanitized=spaces.map(s=>Number(s)).filter(n=>!Number.isNaN(n)&&n>=0&&n<=63);
sanitized.forEach(space=>{
const key=String(space);
if(unset){
if(buildings[key]){delete buildings[key];changed=true}
}else if(type&&buildings[key]!==type){
buildings[key]=type;
changed=true;
}
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
const n=Number(num);
if(Number.isNaN(n))return false;
const table=currentMap===1?coordinates1:coordinates2,pos=table[n];
if(!pos)return false;
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

function clamp(n,min,max){return Math.max(min,Math.min(max,n))}

const commands={
setAll(amounts){
if(!Array.isArray(amounts)||amounts.length!==PLAYERS.length)return{ok:false,error:`Expected ${PLAYERS.length} amounts`};
const parsed=amounts.map(a=>parseInt(a,10));
if(parsed.some(a=>isNaN(a)))return{ok:false,error:'All amounts must be valid numbers'};
PLAYERS.forEach((p,i)=>updateMoney(p,clamp(parsed[i],-999,9999)));
return{ok:true};
},
setMoney(player,amount){
const amt=parseInt(amount,10);
if(!colorMap[player])return{ok:false,error:'Invalid player'};
if(isNaN(amt)||amt<-999||amt>9999)return{ok:false,error:'Amount out of range'};
updateMoney(player,amt);
return{ok:true};
},
setDisplayLabel(player,label){
if(!colorMap[player])return{ok:false,error:'Invalid player'};
if(typeof label!=='string'||!/^[A-Za-z]{1,7}$/.test(label))return{ok:false,error:'Label must be 1-7 letters only'};
updateLabel(player,`${label}${player.replace('p','')}`);
return{ok:true};
},
moveAll(spaces){
if(!Array.isArray(spaces)||spaces.length!==PLAYERS.length)return{ok:false,error:`Must provide exactly ${PLAYERS.length} spaces`};
const errors=[];
PLAYERS.forEach((p,i)=>{
const space=parseInt(spaces[i],10),entry=isNaN(space)?null:boardSpaces.find(s=>s.number===space);
if(!entry){errors.push(`Invalid space "${spaces[i]}"`);return}
updatePiece(p,entry.x,entry.y);
});
return errors.length?{ok:false,error:errors.join('; ')}:{ok:true};
},
movePiece(player,x,y){
const nx=parseInt(x,10),ny=parseInt(y,10);
if(!colorMap[player]||isNaN(nx)||isNaN(ny))return{ok:false,error:'Invalid player or coordinates'};
updatePiece(player,nx,ny);
return{ok:true};
},
moveToSpace(player,spaceNum){
const space=parseInt(spaceNum,10),entry=isNaN(space)?null:boardSpaces.find(s=>s.number===space);
if(!colorMap[player]||!entry)return{ok:false,error:'Invalid player or space'};
updatePiece(player,entry.x,entry.y);
return{ok:true};
},
buildBulk(type,spaces){
if(!HOUSE_TYPES.has(type))return{ok:false,error:'Invalid building type'};
const list=Array.isArray(spaces)?spaces:[spaces];
const sanitized=list.map(s=>parseInt(s,10)).filter(n=>!isNaN(n)&&n>=0&&n<=63);
if(sanitized.length===0)return{ok:false,error:'No valid spaces provided'};
bulkUpdateBuildings(sanitized,type,false);
return{ok:true};
},
setBuilding(space,type){
if(!HOUSE_TYPES.has(type))return{ok:false,error:'Invalid building type'};
setBuilding(space,type,false);
return{ok:true};
},
removeBuilding(space){
setBuilding(space,null,true);
return{ok:true};
},
clearAllBuildings(){
clearAllBuildings();
return{ok:true};
},
setDisplay1(text){
const t=String(text||'').trim().replace(/^"(.*)"$/,'$1');
if(!t)return{ok:false,error:'Text required'};
updateDisplay1(t);
return{ok:true};
},
setDisplay2(text){
const t=String(text||'').trim().replace(/^"(.*)"$/,'$1');
if(!t)return{ok:false,error:'Text required'};
updateDisplay2(t);
return{ok:true};
},
dot(nums,color){
const list=Array.isArray(nums)?nums:[nums],c=color||'red';
list.forEach(n=>updateDot(n,c));
return{ok:true};
},
removeDot(num){
if(!removeDot(num))return{ok:false,error:`No dot at ${num}`};
return{ok:true};
},
clearAllDots(){
clearAllDots();
return{ok:true};
},
setDotLocation(num){
const n=parseInt(num,10);
if(n!==1&&n!==2)return{ok:false,error:'Must be 1 or 2'};
currentMap=n;
safeEmit('reload-dots',activeDots);
return{ok:true};
},
setMap(num){
const n=parseInt(num,10);
if(n!==1&&n!==2&&n!==3)return{ok:false,error:'Map must be 1, 2, or 3'};
currentMap=n;
safeEmit('map-change',currentMap);
safeEmit('reload-dots',activeDots);
return{ok:true};
},
playSound(file){
if(!file)return{ok:false,error:'File required'};
safeEmit('play-sound',{file});
return{ok:true};
}
};

function cleanChatMessage(msg){
return typeof msg==='string'?msg.trim().slice(0,200).replace(/\r?\n/g,' '):'';
}

function broadcastChat(player,msg,type='chat'){
const clean=cleanChatMessage(msg);
if(!clean)return;
const playerId=/^p[1-6]$/i.test(String(player||''))?String(player).toLowerCase():'system';
safeEmit('chat-message',{
player:playerId,
name:playerId==='system'?BOT_NAME:(labels[playerId]||playerId),
message:clean,
type,
timestamp:Date.now()
});
}

function isAdmin(socket){return !!socket?.adminAuthenticated}

function resolvePlayer(socketPlayer,raw){
const supplied=typeof raw==='string'?raw.toLowerCase():null;
return socketPlayer||(/^p[1-6]$/.test(supplied||'')?supplied:'system');
}

function handleIncomingChat(socket,player,msg){
const clean=cleanChatMessage(msg);
if(!clean)return;
if(clean.startsWith('!')||clean.startsWith('/')){
const result=processChatCommand(player,clean,socket);
if(result.private){
socket.emit('cmd-ack',result);
if(result.ok&&result.message){
socket.emit('chat-message',{
player:'system',
name:BOT_NAME,
message:result.message,
type:'private',
timestamp:Date.now()
});
}
}
return;
}
broadcastChat(player,clean,'chat');
}

function sendPrivateResponse(socket,player,result){
if(!result.message)return;
socket.emit('chat-message',{
player:'system',
name:BOT_NAME,
message:result.message,
type:'private',
timestamp:Date.now()
});
}

function processChatCommand(player,raw,socket,viaPrivate=false){
const message=cleanChatMessage(raw);
if(!message.startsWith('!')&&!message.startsWith('/'))return{handled:false,ok:true};

const lower=message.toLowerCase();

if(lower.startsWith('/login')){
const p=message.trim().split(/\s+/);
if(p.length!==3)return{handled:true,ok:false,private:true,error:'Usage: /login admin <password>'};
if(p[1]!==ADMIN_USERNAME||!checkAdminPassword(p[2]))return{handled:true,ok:false,private:true,error:'Invalid admin username or password.'};
socket.adminAuthenticated=true;
return{handled:true,ok:true,private:true,message:'Authentication successful.'};
}

if(lower==='/logout'){
socket.adminAuthenticated=false;
return{handled:true,ok:true,private:true,message:'Session ended.'};
}

if(lower.startsWith('/whois')){
if(!isAdmin(socket))return{handled:true,ok:false,private:true,error:'Only the authenticated can use /whois.'};
const target=(message.trim().split(/\s+/)[1]||'').toLowerCase();
if(!/^p[1-6]$/.test(target))return{handled:true,ok:false,private:true,error:'Usage: /whois p1-p6'};
const info=clientInfo[target]||{};
return{
handled:true,
ok:true,
private:true,
message:`${target} (${labels[target]||target}) IP: ${connectedIPs[target]||'Not connected'} | OS: ${info.os||'Unknown'} | Browser: ${info.browser||'Unknown'} | Res: ${info.resolution||'Unknown'}`
};
}

const commandsRaw=message.split(' !').map((c,i)=>i>0?'!'+c:c);
let lastResult={ok:true};

for(const fullCmd of commandsRaw){
if(!fullCmd)continue;

const parts=fullCmd.trim().split(/\s+/);
const cmd=(parts.shift()||'').toLowerCase();
const args=parts;
let result=null;

switch(cmd){
case '!set':
if(args[0]?.toLowerCase()!=='all'||args.length!==PLAYERS.length+1)return{handled:true,ok:false,error:`Usage: !set all <amounts for ${PLAYERS.length} players>`};
result=commands.setAll(args.slice(1));
break;

case '!display':
if(args.length!==2||!/^p[1-6]$/i.test(args[0]))return{handled:true,ok:false,error:'Usage: !display p1-p6 <name>'};
result=commands.setDisplayLabel(args[0].toLowerCase(),args[1]);
break;

case '!mv':{
const[target,...spacesStr]=args;
if(target?.toLowerCase()!=='all')return{handled:true,ok:false,error:'Only !mv all ... allowed'};
result=commands.moveAll(spacesStr);
break;
}

case '!mv2':{
const[playerId,xStr,yStr]=args;
result=commands.movePiece(playerId,xStr,yStr);
break;
}

case '!house1':
case '!house2':
case '!house3':
case '!house4':
case '!hotel':{
const type=cmd.slice(1),spaces=args;
if(!spaces.length)return{handled:true,ok:false,error:`Usage: ${cmd} <space>`};
result=commands.buildBulk(type,spaces);
break;
}

case '!clearall':
result=commands.clearAllBuildings();
break;

case '!d1':
result=commands.setDisplay1(args.join(' '));
break;

case '!d2':
result=commands.setDisplay2(args.join(' '));
break;

case '!dot':{
if(!args.length)return{handled:true,ok:false,error:'Usage: !dot <space> [space...] <color>'};
const color=args[args.length-1]||'red';
result=commands.dot(args.slice(0,-1),color);
break;
}

case '!removedot':
if(!args.length)return{handled:true,ok:false,error:'Usage: !removedot <space>'};
result=commands.removeDot(args[0]);
break;

case '!cleardot':
result=commands.clearAllDots();
break;

case '!dotlocation':
result=commands.setDotLocation(args[0]);
break;

case '!map':
result=commands.setMap(args[0]);
break;

case '!sound':
result=commands.playSound(args[0]);
break;

default:
if(/^p[1-6]$/i.test(String(player||''))){
safeEmit('rentoCommand',{from:player,msg:fullCmd.trim(),via:viaPrivate?'private':'public'});
result={ok:true};
break;
}
return{handled:true,ok:false,error:`Unknown command: ${cmd}`};
}

if(result&&!result.ok){
lastResult=result;
safeEmit('chat-message',{
player:'system',
name:BOT_NAME,
message:result.error,
type:'error',
timestamp:Date.now()
});
return{handled:true,...result};
}

if(result)lastResult=result;
}

return{handled:true,...lastResult};
}

io.on('connection',socket=>{
try{
const ip=socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim()||socket.handshake.address;
let socketPlayer=null;
socket.adminAuthenticated=false;

socket.on('set-player',player=>{
if(typeof player!=='string'||!/^p[1-6]$/i.test(player))return;
socketPlayer=player.toLowerCase();
connectedIPs[socketPlayer]=ip;
const{os,browser}=parseUserAgent(socket.handshake.headers['user-agent'],socket.handshake.headers);
clientInfo[socketPlayer]={...clientInfo[socketPlayer],os,browser};

socket.emit('player-set',{
player:socketPlayer,
name:labels[socketPlayer]||socketPlayer
});
});

socket.on('screen-info',payload=>{
if(!socketPlayer||!payload||typeof payload!=='object')return;
const w=parseInt(payload.width,10),h=parseInt(payload.height,10);
if(!w||!h)return;
clientInfo[socketPlayer]={...clientInfo[socketPlayer],resolution:`${w}x${h}`};
});

socket.on('chat-message',payload=>{
if(!payload||typeof payload!=='object')return;
handleIncomingChat(socket,resolvePlayer(socketPlayer,payload.player),payload.msg);
});

socket.on('sendMessage',payload=>{
if(!payload||typeof payload!=='object')return;
handleIncomingChat(socket,resolvePlayer(socketPlayer,payload.from??payload.bot),payload.msg);
});

socket.on('private-message',payload=>{
if(!payload||typeof payload!=='object')return;
const supplied=typeof payload.from==='string'?payload.from.toLowerCase():null;
const player=socketPlayer||(/^p[1-6]$/.test(supplied||'')?supplied:'system');
const target=typeof payload.to==='string'?payload.to.toLowerCase():'';
const msg=cleanChatMessage(payload.msg);
if(target!==BOT_NAME.toLowerCase()||!msg)return;
if(msg.startsWith('!')||msg.startsWith('/')){
const result=processChatCommand(player,msg,socket,true);
socket.emit('cmd-ack',result);
sendPrivateResponse(socket,player,result);
}
});

function run(fn){return(...args)=>{const result=fn(...args);socket.emit('cmd-ack',result);return result}};

socket.on('getMoney',()=>socket.emit('moneyUpdate',money));
socket.on('getPieces',()=>socket.emit('piecesUpdate',pieces));
socket.on('getBuildings',()=>socket.emit('buildingsUpdate',buildings));
socket.on('getDisplay1',()=>socket.emit('displayUpdate1',{text:display1.text}));
socket.on('getDisplay2',()=>socket.emit('displayUpdate2',{text:display2.text}));
socket.on('getLabels',()=>socket.emit('labelsUpdate',labels));

socket.on('autoUp',payload=>{
if(!payload||typeof payload!=='object')return;
const positions=Array.isArray(payload.positions)?payload.positions:[];
const amounts=Array.isArray(payload.money)?payload.money:[];
if(positions.length===PLAYERS.length){
const result=commands.moveAll(positions);
if(!result.ok)socket.emit('cmd-ack',result);
}
if(amounts.length===PLAYERS.length){
const result=commands.setAll(amounts);
if(!result.ok)socket.emit('cmd-ack',result);
}
});

socket.on('updateMoney',run(p=>commands.setMoney(p?.player,p?.amount)));
socket.on('updateDisplay1',run(p=>commands.setDisplay1(p?.text)));
socket.on('updateDisplay2',run(p=>commands.setDisplay2(p?.text)));
socket.on('updateLabel',run(p=>commands.setDisplayLabel(p?.player,p?.text)));
socket.on('cmd-set-all',run(a=>commands.setAll(a)));
socket.on('cmd-mv-all',run(s=>commands.moveAll(s)));
socket.on('cmd-mv2',run(p=>commands.movePiece(p?.player,p?.x,p?.y)));
socket.on('cmd-mv-space',run(p=>commands.moveToSpace(p?.player,p?.space)));
socket.on('cmd-house',run(p=>commands.buildBulk(p?.type,p?.spaces)));
socket.on('cmd-sound',run(p=>commands.playSound(p?.file)));
socket.on('cmd-dot',p=>commands.dot(p?.num,p?.color));
socket.on('cmd-remove',n=>commands.removeDot(n));
socket.on('cmd-cleardot',()=>commands.clearAllDots());
socket.on('cmd-map',run(n=>commands.setMap(n)));
socket.on('cmd-dotlocation',run(n=>commands.setDotLocation(n)));
socket.on('cmd-set-building',run(p=>commands.setBuilding(p?.space,p?.type)));
socket.on('cmd-remove-building',n=>commands.removeBuilding(n));
socket.on('cmd-clear-buildings',()=>commands.clearAllBuildings());

socket.emit('map-change',currentMap);
socket.emit('buildingPositions',buildingPositions);
socket.emit('clickableSpacesData',clickableSpaces);
socket.emit('reload-dots',activeDots);
socket.emit('piecesUpdate',pieces);
socket.emit('moneyUpdate',money);
socket.emit('labelsUpdate',labels);
socket.emit('buildingsUpdate',buildings);
socket.emit('displayUpdate1',{text:display1.text});
socket.emit('displayUpdate2',{text:display2.text});

socket.on('disconnect',()=>{if(socketPlayer&&connectedIPs[socketPlayer]===ip)delete connectedIPs[socketPlayer]});}catch(err){console.error('[Socket] Error:',err)}})

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
io.close(()=>console.log('[Server] Socket.IO closed.'));
server.close(()=>{console.log('[Server] HTTP server closed.');process.exit(0)});
setTimeout(()=>{console.warn('[Server] Forcing shutdown after 5 seconds.');process.exit(1)},5000);
}catch(err){console.error('[Server] Error during graceful shutdown:',err);process.exit(1)}
}
['SIGINT','SIGTERM'].forEach(sig=>process.on(sig,()=>gracefulShutdown(sig)));

const PORT=process.env.PORT||80;
server.listen(PORT,'0.0.0.0',()=>console.log(`[Server] ${BOT_NAME} running at http://0.0.0.0:${PORT}`));
