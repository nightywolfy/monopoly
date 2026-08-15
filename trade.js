const socket = io();
const BOT_NAME = 'player1bot';
let currentMap = 3;
let labels = {p1:'P1',p2:'P2',p3:'P3',p4:'P4',p5:'P5',p6:'P6'};
let activeDots = {};
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

window.addEventListener('resize',scaleBoard);
scaleBoard();

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
for(const [id,pos] of Object.entries(data)){
if(!pos||typeof pos.x!=="number"||typeof pos.y!=="number"){console.warn("Invalid position for",id,pos);continue;}
const key=`${pos.x},${pos.y}`;
if(!posMap[key])posMap[key]=[];
posMap[key].push(id);
}
for(const [key,ids] of Object.entries(posMap)){
const [baseX,baseY]=key.split(',').map(Number);
ids.forEach((id,idx)=>{
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
socket.on('piecesUpdate', updatePieces);

/* ==================== COMMAND BUILDER ==================== */
let cbCmd='!offer',entries=[],nextEntryId=1;
const entriesContainer=document.getElementById('entriesContainer');
const cbPreview=document.getElementById('preview');
const enterBtn=document.getElementById('enterBtn');
const cmdLog=document.getElementById('cmdLog');

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
amountInput.min='0';
amountInput.step='25';
amountInput.value=entry.amount;
amountInput.addEventListener('input',()=>{
if(amountInput.value!==''&&parseFloat(amountInput.value)<0)amountInput.value='0';
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
if(entry.picking&&typeof auctionSetPicking==='function')auctionSetPicking(false);
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

entries=[
{id:1,players:['p1'],amount:'0',spaces:[],picking:false},
{id:2,players:['p2'],amount:'0',spaces:[],picking:false}
];
nextEntryId=3;
renderEntries();
cbUpdatePreview();
}

/* ==================== RESET BUTTON ==================== */
document.getElementById('resetBtn').addEventListener('click',cbReset);

/* ==================== ENTER ==================== */
enterBtn.addEventListener('click',()=>{
const cmd=cbBuildCommand();
if(!cmd)return;

socket.emit('sendMessage',{
bot:BOT_NAME,
target:'##rento',
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

if(auctionPicking){
auctionSpaceClicked(spaceNum,btn);
return;
}
cbSpaceClicked(spaceNum,btn);
});

/* ==================== QUICK COMMAND BUILDER ==================== */
const qcCmdRow=document.getElementById('qcCmdRow');
const qcPlayerRow=document.getElementById('qcPlayerRow');
const qcAmountRow=document.getElementById('qcAmountRow');
const qcAmount=document.getElementById('qcAmount');
const qcPreview=document.getElementById('qcPreview');
const qcSendBtn=document.getElementById('qcSendBtn');

let qcCommand=null,qcPlayer=null;

['!status','!insert','!remove'].forEach(cmd=>{
const b=document.createElement('button');
b.type='button';
b.className='opt';
b.textContent=cmd;
b.addEventListener('click',()=>{
qcCommand=cmd;
qcCmdRow.querySelectorAll('button').forEach(btn=>btn.classList.remove('selected'));
b.classList.add('selected');
qcAmountRow.style.display=cmd==='!insert'?'block':'none';
if(cmd==='!insert')qcAmount.value='1000';
qcUpdatePreview();
});
qcCmdRow.appendChild(b);
});

['p1','p2','p3','p4','p5','p6'].forEach(p=>{
const b=document.createElement('button');
b.type='button';
b.className=`opt ${p}`;
b.textContent=p.toUpperCase();
b.addEventListener('click',()=>{
qcPlayer=p;
qcPlayerRow.querySelectorAll('button').forEach(btn=>btn.classList.remove('selected'));
b.classList.add('selected');
qcUpdatePreview();
});
qcPlayerRow.appendChild(b);
});

qcAmount.addEventListener('input',()=>{
if(qcAmount.value!==''&&parseFloat(qcAmount.value)<0)qcAmount.value='0';
qcUpdatePreview();
});

function qcBuildCommand(){
if(!qcCommand||!qcPlayer)return null;
if(qcCommand==='!insert'){
if(qcAmount.value===''||qcAmount.value==null)return null;
return `${qcCommand} ${qcPlayer} ${qcAmount.value}`;
}
return `${qcCommand} ${qcPlayer}`;
}

function qcUpdatePreview(){
const cmd=qcBuildCommand();
qcPreview.textContent=cmd||'(select a command and player)';
qcSendBtn.disabled=!cmd;
}

qcSendBtn.addEventListener('click',()=>{
const cmd=qcBuildCommand();
if(!cmd)return;

socket.emit('sendMessage',{
bot:BOT_NAME,
target:'##rento',
msg:cmd
});

const line=document.createElement('div');
line.textContent=`Sent: ${cmd}`;
cmdLog.prepend(line);
});

/* ==================== AUCTION MENU BUILDER ==================== */
const auctionPickBtn=document.getElementById('auctionPickBtn');
const auctionSpacesLabel=document.getElementById('auctionSpacesLabel');
const auctionPreview=document.getElementById('auctionPreview');
const auctionSendBtn=document.getElementById('auctionSendBtn');

let auctionPicking=false,auctionSpace=null;

function auctionSetPicking(val){
auctionPicking=val;
auctionPickBtn.textContent=auctionPicking?'Done picking space':'Pick space for this entry';
auctionPickBtn.classList.toggle('selected',auctionPicking);
}

auctionPickBtn.addEventListener('click',()=>{
if(!auctionPicking){
entries.forEach(en=>en.picking=false);
renderEntries();
}
auctionSetPicking(!auctionPicking);
});

function auctionSpaceClicked(spaceNum,btn){
if(auctionSpace===spaceNum){
btn.classList.remove('spacePicked');
auctionSpace=null;
}else{
if(auctionSpace!==null){
const prevBtn=boardSpaceBtns[auctionSpace];
if(prevBtn)prevBtn.classList.remove('spacePicked');
}
auctionSpace=spaceNum;
btn.classList.add('spacePicked');
}
auctionUpdatePreview();
}

function auctionBuildCommand(){
if(auctionSpace===null)return null;
return `!auction ${auctionSpace}`;
}

function auctionUpdatePreview(){
auctionSpacesLabel.textContent=auctionSpace!==null?`Space: ${auctionSpace}`:'';
const cmd=auctionBuildCommand();
auctionPreview.textContent=cmd||'(pick a space to auction)';
auctionSendBtn.disabled=!cmd;
}

auctionSendBtn.addEventListener('click',()=>{
const cmd=auctionBuildCommand();
if(!cmd)return;

socket.emit('sendMessage',{
bot:BOT_NAME,
target:'##rento',
msg:cmd
});

const line=document.createElement('div');
line.textContent=`Sent: ${cmd}`;
cmdLog.prepend(line);

if(auctionSpace!==null){
const b=boardSpaceBtns[auctionSpace];
if(b)b.classList.remove('spacePicked');
}
auctionSpace=null;
auctionSetPicking(false);
auctionUpdatePreview();
});

/* ==================== SWITCH MENU BUILDER ==================== */
const switchPlayerRow1=document.getElementById('switchPlayerRow1');
const switchPlayerRow2=document.getElementById('switchPlayerRow2');
const switchPreview=document.getElementById('switchPreview');
const switchSendBtn=document.getElementById('switchSendBtn');

let switchPlayer1=null,switchPlayer2=null;

['p1','p2','p3','p4','p5','p6'].forEach(p=>{
const b=document.createElement('button');
b.type='button';
b.className=`opt ${p}`;
b.textContent=p.toUpperCase();
b.addEventListener('click',()=>{
switchPlayer1=p;
switchPlayerRow1.querySelectorAll('button').forEach(btn=>btn.classList.remove('selected'));
b.classList.add('selected');
switchUpdatePreview();
});
switchPlayerRow1.appendChild(b);
});

['p1','p2','p3','p4','p5','p6'].forEach(p=>{
const b=document.createElement('button');
b.type='button';
b.className=`opt ${p}`;
b.textContent=p.toUpperCase();
b.addEventListener('click',()=>{
switchPlayer2=p;
switchPlayerRow2.querySelectorAll('button').forEach(btn=>btn.classList.remove('selected'));
b.classList.add('selected');
switchUpdatePreview();
});
switchPlayerRow2.appendChild(b);
});

function switchBuildCommand(){
if(!switchPlayer1||!switchPlayer2)return null;
return `!switch ${switchPlayer1} ${switchPlayer2}`;
}

function switchUpdatePreview(){
const cmd=switchBuildCommand();
switchPreview.textContent=cmd||'(select two players)';
switchSendBtn.disabled=!cmd;
}

switchSendBtn.addEventListener('click',()=>{
const cmd=switchBuildCommand();
if(!cmd)return;

socket.emit('sendMessage',{
bot:BOT_NAME,
target:'##rento',
msg:cmd
});

const line=document.createElement('div');
line.textContent=`Sent: ${cmd}`;
cmdLog.prepend(line);
});

/* ==================== INITIALIZE ==================== */
cbReset();
