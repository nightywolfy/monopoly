const socket=io();
const GM_IDENTITY = 'p1';
const urlParams=new URLSearchParams(window.location.search);
const pParam=urlParams.get('p');
const restrictedPlayer=(pParam&&/^[1-6]$/.test(pParam))?`p${pParam}`:null;
let currentMap=2;
let activeDots={};
let buildingPositions={};
let lastBuildingsData=null;

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

document.addEventListener("click",e=>{
const btn=e.target.closest("button[data-cmd]");
if(!btn)return;
const cmd=btn.dataset.cmd;
socket.emit("sendMessage",{from:btn.dataset.from||GM_IDENTITY,target:btn.dataset.target||"##rento",msg:cmd});
const line=document.createElement("div");
line.textContent=`Sent: ${cmd}`;
cmdLog.prepend(line);
});

const boardSpaceBtns={};
const group1=[1,3,4,5,6,8,9,21,22,24,25,26,27,28,29,41,42,44,45,53,56,57];
const group2=[11,12,13,14,15,16,17,19,31,33,34,35,37,38,39,47,50,51,59,63];
const boardButtonsContainer=document.getElementById('boardButtons');

function buildBoardButtons(data){
boardButtonsContainer.innerHTML='';
Object.keys(boardSpaceBtns).forEach(k=>delete boardSpaceBtns[k]);
if(!Array.isArray(data))return;
data.forEach(coords=>{
const spaceNum=coords.number,btn=document.createElement('button');
btn.type='button';
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
boardSpaceBtns[spaceNum]=btn;
boardButtonsContainer.appendChild(btn);
});
}

socket.on('clickableSpacesData',buildBoardButtons);
socket.on('draw-dot',info=>renderDotsFromServer({[info.num]:info}));
socket.on('reload-dots',renderDotsFromServer);
socket.on('remove-dot',n=>{if(activeDots[n]){activeDots[n].remove();delete activeDots[n];}});
socket.on('clear-all-dots',()=>{Object.values(activeDots).forEach(e=>e.remove());activeDots={};});
socket.on('map-change',n=>document.getElementById('boardImg').src=`map${n}.png`);
socket.on('buildingsUpdate',data=>{lastBuildingsData=data;renderBuildings(data);});
socket.on('buildingPositions',data=>{buildingPositions=data;renderBuildings(lastBuildingsData);});
