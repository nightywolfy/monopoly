<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
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
const container=document.getElementById('board');
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

window.addEventListener('resize',scaleBoard);
scaleBoard();
if(!window.SOUND_LISTENER_LOCK){
window.SOUND_LISTENER_LOCK=true;
socket.on('play-sound',({file})=>{
new Audio(file).play();
});
}

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

function updateDisplay1(text){ document.getElementById('display1').innerText = text || ''; }
function updateDisplay2(text){ document.getElementById('display2').innerText = text || ''; }

socket.on('draw-dot', info => { renderDotsFromServer({[info.num]: info}); });
socket.on('reload-dots', data => { renderDotsFromServer(data); });
socket.on('remove-dot',n=>{if(activeDots[n]){activeDots[n].remove();delete activeDots[n];}});
socket.on('clear-all-dots',()=>{Object.values(activeDots).forEach(e=>e.remove());activeDots={};});
socket.on('map-change', n => document.getElementById('boardImg').src = `map${n}.png`);
socket.on('moneyUpdate', updateMoney);
socket.on('labelsUpdate', updateLabels);
socket.on('buildingsUpdate', data=>{ lastBuildingsData=data; renderBuildings(data); });
socket.on('buildingPositions', data=>{ buildingPositions=data; renderBuildings(lastBuildingsData); });
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