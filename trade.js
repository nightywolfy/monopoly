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
if(!container||!wrapper)return;
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
fetch('/money.json').then(res=>res.json()).then(updateMoney);
fetch('/labels.json').then(res=>res.json()).then(updateLabels).catch(()=>{});
fetch('/building.json').then(r=>r.json()).then(data=>{ lastBuildingsData=data; renderBuildings(data); });




/* ==================== COMMAND BUILDER ==================== */
let cbCmd='!offer',entries=[],nextEntryId=1;
const entriesContainer=document.getElementById('entriesContainer');
const cbPreview=document.getElementById('preview');
const enterBtn=document.getElementById('enterBtn');
const cmdLog=document.getElementById('cmdLog');

/* ==================== CREATE ENTRY ==================== */
function makeEntry(player){
const id=nextEntryId++;
const entry={id,players:[player],amount:'0',spaces:[],picking:false};
entries.push(entry);
renderEntries();
cbUpdatePreview();
}

/* ==================== REMOVE ENTRY ==================== */
function removeEntry(id){
const index=entries.findIndex(en=>en.id===id);
if(index<2)return;
const entry=entries[index];
entry.spaces.forEach(sp=>{
const b=boardSpaceBtns[sp];
if(b)b.classList.remove('spacePicked',`entryColor${(entry.id%6)||6}`);
});
entries.splice(index,1);
renderEntries();
cbUpdatePreview();
}

/* ==================== RENDER ENTRIES ==================== */
function renderEntries(){
entriesContainer.innerHTML='';
entries.forEach((entry,idx)=>{
const card=document.createElement('div');
card.className='entryCard';

const top=document.createElement('div');
top.className='entryTop';

const label=document.createElement('span');
label.textContent=`Entry ${idx+1}`;
top.appendChild(label);

if(idx>=2){
const removeBtn=document.createElement('button');
removeBtn.className='removeEntryBtn';
removeBtn.textContent='? Remove';
removeBtn.addEventListener('click',()=>removeEntry(entry.id));
top.appendChild(removeBtn);
}
card.appendChild(top);

const playerLabel=document.createElement('div');
playerLabel.className='section-label';
playerLabel.textContent='Player';
card.appendChild(playerLabel);

const playerRow=document.createElement('div');
playerRow.className='btn-row player-row';

['p1','p2','p3','p4','p5','p6'].forEach(p=>{
const b=document.createElement('button');
b.type='button';
b.className=`opt ${p}`;
b.textContent=p.toUpperCase();
if(entry.players.includes(p))b.classList.add('selected');
b.addEventListener('click',()=>{
entry.players=[p];
renderEntries();
cbUpdatePreview();
});
playerRow.appendChild(b);
});

card.appendChild(playerRow);

const amountLabel=document.createElement('div');
amountLabel.className='section-label';
amountLabel.style.marginTop='4px';
amountLabel.textContent='Amount';
card.appendChild(amountLabel);

const amountInput=document.createElement('input');
amountInput.type='number';
amountInput.className='amountInput';
amountInput.placeholder='Enter amount...';
amountInput.value=entry.amount;
amountInput.addEventListener('input',()=>{
entry.amount=amountInput.value;
cbUpdatePreview();
});
card.appendChild(amountInput);

const pickBtn=document.createElement('button');
pickBtn.type='button';
pickBtn.className='opt';
pickBtn.style.width='100%';
pickBtn.style.marginTop='6px';
pickBtn.textContent=entry.picking?'? Done picking spaces':'?? Pick space(s) for this entry';
if(entry.picking)pickBtn.classList.add('selected');

pickBtn.addEventListener('click',()=>{
entries.forEach(en=>{
if(en.id!==entry.id)en.picking=false;
});
entry.picking=!entry.picking;
renderEntries();
cbUpdatePreview();
});
card.appendChild(pickBtn);

const spacesLabel=document.createElement('div');
spacesLabel.className='spacesLabel';
spacesLabel.textContent=entry.spaces.length?`Spaces: ${entry.spaces.join(',')}`:'';
card.appendChild(spacesLabel);
entriesContainer.appendChild(card);
});
}

/* ==================== SPACE PICKING ==================== */
function cbSpaceClicked(spaceNum,btn){
const entry=entries.find(en=>en.picking);
if(!entry)return false;

const colorClass=`entryColor${(entry.id%6)||6}`;
const idx=entry.spaces.indexOf(spaceNum);

if(idx!==-1){
entry.spaces.splice(idx,1);
btn.classList.remove('spacePicked',colorClass);
}else{
entry.spaces.push(spaceNum);
btn.classList.add('spacePicked',colorClass);
}

renderEntries();
cbUpdatePreview();
return true;
}

/* ==================== BUILD TRADE COMMAND ==================== */
function cbBuildCommand(){
if(entries.length<2)return null;

const e1=entries[0],e2=entries[1];

if(!e1.players.length||!e2.players.length)return null;
if(e1.amount===''||e1.amount==null)return null;
if(e2.amount===''||e2.amount==null)return null;

let cmd=`!offer-${e1.players[0]}`;

if(e1.spaces.length)cmd+=` ${e1.spaces.join(',')}`;

cmd+=` money:${e1.amount} ${e2.players[0]} money:${e2.amount}`;

if(e2.spaces.length)cmd+=` ${e2.spaces.join(',')}`;

return cmd;
}

/* ==================== UPDATE PREVIEW ==================== */
function cbUpdatePreview(){
const cmd=cbBuildCommand();
cbPreview.textContent=cmd||'(select players and enter amounts)';
enterBtn.disabled=!cmd;
}

/* ==================== RESET ==================== */
function cbReset(){
entries.forEach(entry=>{
entry.spaces.forEach(sp=>{
const b=boardSpaceBtns[sp];
if(b)b.classList.remove('spacePicked',`entryColor${(entry.id%6)||6}`);
});
});

entries=[];
nextEntryId=1;
makeEntry('p1');
makeEntry('p2');
renderEntries();
cbUpdatePreview();
}

/* ==================== ADD ENTRY ==================== */
const addEntryBtn=document.getElementById('addEntryBtn');

if(addEntryBtn){
addEntryBtn.addEventListener('click',()=>{
if(entries.length<6){
const players=['p1','p2','p3','p4','p5','p6'];
const used=entries.map(e=>e.players[0]);
const nextPlayer=players.find(p=>!used.includes(p))||'p3';
makeEntry(nextPlayer);
}
});
}

/* ==================== RESET BUTTON ==================== */
document.getElementById('resetBtn').addEventListener('click',cbReset);

/* ==================== ENTER ==================== */
enterBtn.addEventListener('click',()=>{
const cmd=cbBuildCommand();
if(!cmd)return;

socket.emit('sendMessage',{
bot:'player1bot',
msg:cmd
});

const line=document.createElement('div');
line.textContent=`Sent: ${cmd}`;
cmdLog.prepend(line);
cbReset();
});

/* ==================== BOARD SPACE CLICK HANDLING ==================== */
document.addEventListener('click',e=>{
const btn=e.target.closest('#boardButtons button');
if(!btn)return;

const spaceNum=parseInt(btn.textContent,10);
if(isNaN(spaceNum))return;

cbSpaceClicked(spaceNum,btn);
});

/* ==================== INITIALIZE ==================== */
cbReset();
