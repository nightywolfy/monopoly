<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
const BOT_NAME = document.body.dataset.bot;
const colorMap = {red:"p1", blue:"p2", orange:"p3", green:"p4", purple:"p5", white:"p6"};
let currentMap = 3;
let activeDots = {};
let labels = {p1:'Player1',p2:'Player2',p3:'Player3',p4:'Player4',p5:'Player5',p6:'Player6'};
let lastMoney = {p1:0,p2:0,p3:0,p4:0,p5:0,p6:0};
let buildingPositions = {};
let lastBuildingsData = null;

function renderDotsFromServer(data){
const board=document.getElementById('board');
if(!data)return;
for(const [num,info] of Object.entries(data)){
if(!info)continue;
if(activeDots[num]){
const el=activeDots[num];
el.style.left=info.x+'px';
el.style.top=info.y+'px';
el.style.background=info.color||'#fff';
}else{
const el=document.createElement('div');
el.className='dot';
el.style.left=info.x+'px';
el.style.top=info.y+'px';
el.style.background=info.color||'#fff';
el.style.zIndex=30;
board.appendChild(el);
activeDots[num]=el;
}
}
}

function renderMoneyBoxes(){
document.getElementById('money-p1-overlay').textContent = labels.p1 + ': $' + lastMoney.p1;
document.getElementById('money-p2-overlay').textContent = labels.p2 + ': $' + lastMoney.p2;
document.getElementById('money-p3-overlay').textContent = labels.p3 + ': $' + lastMoney.p3;
document.getElementById('money-p4-overlay').textContent = labels.p4 + ': $' + lastMoney.p4;
document.getElementById('money-p5-overlay').textContent = labels.p5 + ': $' + lastMoney.p5;
document.getElementById('money-p6-overlay').textContent = labels.p6 + ': $' + lastMoney.p6;
}

function updateMoney(data){
lastMoney = {...lastMoney, ...data};
renderMoneyBoxes();
}

function updateLabels(data){
labels = {...labels, ...data};
renderMoneyBoxes();
}

function renderBuildings(data){
const board=document.getElementById('board');
document.querySelectorAll('.house,.hotel').forEach(el=>el.remove());
if(!data)return;
for(const [space,type] of Object.entries(data)){
const pos=buildingPositions[space];
if(!pos)continue;
const isHouse=type.startsWith('house');
const el=document.createElement('img');
el.src=isHouse?`${type}.jpg`:'hotel.jpg';
el.className=isHouse?'house':'hotel';
el.style.position='absolute';
el.style.left=(pos.x-14)+'px';
el.style.top=(pos.y-14)+'px';
el.style.width='29px';
el.style.height='29px';
el.style.zIndex=isHouse?25:26;
board.appendChild(el);
}
}

function scaleBoard(){
const container=document.getElementById('boardContainer');
const wrapper=document.getElementById('boardWrapper');
const scaleX=wrapper.clientWidth/930;
const scaleY=wrapper.clientHeight/930;
const scale=Math.min(scaleX,scaleY);
container.style.transform=`scale(${scale})`;
}

document.addEventListener("DOMContentLoaded",()=>{
document.querySelectorAll('form[target="hiddenFrame"]').forEach(form=>{
form.addEventListener("submit",function(e){
e.preventDefault();
const bot=form.querySelector('[name="bot"]').value;
const msg=form.querySelector('[name="msg"]').value;
const targetInput=form.querySelector('[name="target"]');
const target=targetInput?.value||undefined;
fetch(form.action,{method:form.method||"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bot,target,msg})}).catch(err=>console.error(err));
});
});
});

function updatePieces(data){
if(!data||typeof data!=="object"){console.warn("Pieces data invalid:",data);return;}
const posMap={};
for(const [color,pos] of Object.entries(data)){
if(!pos||typeof pos.x!=="number"||typeof pos.y!=="number"){console.warn("Invalid position for",color,pos);continue;}
const key=`${pos.x},${pos.y}`;
if(!posMap[key])posMap[key]=[];
posMap[key].push(color);
}
for(const [key,colors] of Object.entries(posMap)){
const [baseX,baseY]=key.split(',').map(Number);
colors.forEach((color,idx)=>{
const id=colorMap[color];
if(!id)return;
const el=document.getElementById(id);
if(!el)return;
let offsetX=0,offsetY=0;
if(idx===1){offsetX=10;}
if(idx===2){offsetY=10;}
if(idx===3){offsetX=10;offsetY=10;}
if(idx===4){offsetX=20;}
if(idx===5){offsetX=20;offsetY=10;}
el.style.left=(baseX+offsetX)+'px';
el.style.top=(baseY+offsetY)+'px';
el.style.zIndex=20;
});
}
}

window.addEventListener('resize',scaleBoard);
scaleBoard();
if(!window.SOUND_LISTENER_LOCK){
window.SOUND_LISTENER_LOCK=true;
socket.on('play-sound',({file})=>{
new Audio(file).play();
});
}


function updateDisplay1(text){ document.getElementById('display1').innerText = text || ''; }
function updateDisplay2(text){ document.getElementById('display2').innerText = text || ''; }

const group1 = [1,3,4,5,6,8,9,21,22,24,25,26,27,28,29,41,42,44,45,53,56,57];
const group2 = [11,12,13,14,15,16,17,19,31,33,34,35,37,38,39,47,50,51,59,63];
const boardButtonsContainer = document.getElementById('boardButtons');
const modeButtons=document.querySelectorAll('.mode-btn');
let currentMode='mortgage';
modeButtons.forEach(btn=>{
btn.addEventListener('click',()=>{
modeButtons.forEach(b=>b.classList.remove('active'));
btn.classList.add('active');
currentMode=btn.dataset.mode;
boardButtonsContainer.querySelectorAll('button').forEach(b=>{
const spaceNum=b.textContent;
b.title=`${currentMode.charAt(0).toUpperCase()+currentMode.slice(1)} space ${spaceNum}`;
});
});
});

function buildBoardButtons(data){
data.forEach(coords=>{
const spaceNum=coords.number;
const btn=document.createElement('button');
btn.textContent=spaceNum;
btn.style.position='absolute';
btn.style.left=`${coords.x}px`;
btn.style.top=`${coords.y}px`;
if(group1.includes(spaceNum)){btn.style.width='50px';btn.style.height='105px';btn.style.fontSize='0.85em';}
else if(group2.includes(spaceNum)){btn.style.width='105px';btn.style.height='50px';btn.style.fontSize='0.75em';}
else{btn.style.width='110px';btn.style.height='110px';btn.style.fontSize='0.8em';}
btn.style.backgroundColor='transparent';
btn.style.border='none';
btn.style.color='transparent';
btn.style.zIndex='100';
btn.style.cursor='pointer';
btn.style.pointerEvents='auto';
btn.addEventListener('click',()=>socket.emit('sendMessage',{bot:BOT_NAME,msg:`!${currentMode} ${spaceNum}`}));
boardButtonsContainer.appendChild(btn);
});
}

socket.on('draw-dot', info => { renderDotsFromServer({[info.num]: info}); });
socket.on('reload-dots', data => { renderDotsFromServer(data); });
socket.on('remove-dot',n=>{if(activeDots[n]){activeDots[n].remove();delete activeDots[n];}});
socket.on('clear-all-dots',()=>{Object.values(activeDots).forEach(e=>e.remove());activeDots={};});
socket.on('map-change', n => document.getElementById('boardImg').src = `map${n}.png`);
socket.on('moneyUpdate', updateMoney);
socket.on('labelsUpdate', updateLabels);
socket.on('buildingsUpdate', data=>{ lastBuildingsData=data; renderBuildings(data); });
socket.on('buildingPositions', data=>{ buildingPositions=data; renderBuildings(lastBuildingsData); });
socket.on('clickableSpacesData', data => { buildBoardButtons(data); });
socket.on('boardClickPositions', data=>{ buildBoardButtons(data); });
socket.on('piecesUpdate', updatePieces);
socket.on('displayUpdate1', data=>updateDisplay1(data.text));
socket.on('displayUpdate2', data=>updateDisplay2(data.text));
fetch('/money.json').then(res=>res.json()).then(updateMoney);
fetch('/labels.json').then(res=>res.json()).then(updateLabels).catch(()=>{});
fetch('/building.json').then(r=>r.json()).then(data=>{ lastBuildingsData=data; renderBuildings(data); });
fetch('/pieces.json').then(res=>res.json()).then(updatePieces);
fetch('/display1.json').then(res=>res.json()).then(data=>updateDisplay1(data.text));
fetch('/display2.json').then(res=>res.json()).then(data=>updateDisplay2(data.text));
</script>