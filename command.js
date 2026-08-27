let cbCmd='!offer',entries=[],nextEntryId=1;
const entriesContainer=document.getElementById('entriesContainer');
const cbPreview=document.getElementById('preview');
const enterBtn=document.getElementById('enterBtn');
const cmdLog=document.getElementById('cmdLog');
cmdLog.style.display='none';

/* ==================== RENDER ENTRIES ==================== */
function renderEntries(){
entriesContainer.innerHTML='';
entries.forEach((entry,idx)=>{
const card=document.createElement('div');
card.className='entryCard';

const top=document.createElement('div');
top.className='entryTop';

card.appendChild(top);

const playerRow=document.createElement('div');
playerRow.className='btn-row player-row';

const isFirstEntry=idx===0;
const lockedToOther=isFirstEntry&&restrictedPlayer;

['p1','p2','p3','p4','p5','p6'].forEach(p=>{
if(lockedToOther&&p!==restrictedPlayer)return;
const b=document.createElement('button');
b.type='button';
b.className=`opt ${p}`;
b.textContent=p.toUpperCase();
if(entry.players.includes(p))b.classList.add('selected');
const pickedElsewhere=entries.some(other=>other.id!==entry.id&&other.players.includes(p));
if(pickedElsewhere){
b.disabled=true;
b.classList.add('disabled');
}
b.addEventListener('click',()=>{
if(pickedElsewhere)return;
entry.players=[p];
renderEntries();
cbUpdatePreview();
});
playerRow.appendChild(b);
});

card.appendChild(playerRow);

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
pickBtn.textContent=entry.picking?'Done picking':'Pick space for this entry';
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
if(e1.players[0]===e2.players[0])return null;
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
{id:1,players:[restrictedPlayer||'p1'],amount:'0',spaces:[],picking:false},
{id:2,players:[restrictedPlayer==='p2'?'p1':'p2'],amount:'0',spaces:[],picking:false}
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
from:GM_IDENTITY,
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
qcPreview.style.display='none';
const qcSendBtn=document.getElementById('qcSendBtn');

let qcCommand=null,qcPlayer=null;

const qcLabels={'!status':'status','!insert':'insert','!remove':'bankrupt'};
let qcBankruptBtn=null;
['!remove','!status','!insert'].forEach(cmd=>{
const b=document.createElement('button');
b.type='button';
b.className='opt';
b.textContent=qcLabels[cmd];
b.addEventListener('click',()=>{
qcCommand=cmd;
qcCmdRow.querySelectorAll('button').forEach(btn=>btn.classList.remove('selected'));
b.classList.add('selected');
qcAmountRow.style.display=cmd==='!insert'?'block':'none';
if(cmd==='!insert')qcAmount.value='1000';
qcRefreshPlayerRow();
qcUpdatePreview();
});
qcCmdRow.appendChild(b);
if(cmd==='!remove')qcBankruptBtn=b;
});

['p1','p2','p3','p4','p5','p6'].forEach(p=>{
const b=document.createElement('button');
b.type='button';
b.className=`opt ${p}`;
b.textContent=p.toUpperCase();
b.dataset.player=p;
b.addEventListener('click',()=>{
if(b.disabled)return;
qcPlayer=p;
qcPlayerRow.querySelectorAll('button').forEach(btn=>btn.classList.remove('selected'));
b.classList.add('selected');
qcUpdatePreview();
});
qcPlayerRow.appendChild(b);
});

const qcAllBtn=document.createElement('button');
qcAllBtn.type='button';
qcAllBtn.className='opt';
qcAllBtn.textContent='ALL';
qcAllBtn.dataset.player='ALL';
qcAllBtn.addEventListener('click',()=>{
if(qcAllBtn.disabled)return;
qcPlayer='ALL';
qcPlayerRow.querySelectorAll('button').forEach(btn=>btn.classList.remove('selected'));
qcAllBtn.classList.add('selected');
qcUpdatePreview();
});
qcPlayerRow.appendChild(qcAllBtn);

qcBankruptBtn.click();

function qcRefreshPlayerRow(){
const isStatus=qcCommand==='!status';
const restrict=(qcCommand==='!remove'||isStatus)&&restrictedPlayer;
qcPlayerRow.querySelectorAll('button[data-player]').forEach(btn=>{
const p=btn.dataset.player;
if(p==='ALL'){
const hidden=!isStatus;
btn.style.display=hidden?'none':'';
btn.disabled=hidden;
return;
}
const hidden=restrict&&p!==restrictedPlayer;
btn.style.display=hidden?'none':'';
btn.disabled=hidden;
});
if(restrict){
qcPlayer=restrictedPlayer;
qcPlayerRow.querySelectorAll('button[data-player]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.player===restrictedPlayer));
}else if(qcCommand==='!insert'){
qcPlayer=null;
qcPlayerRow.querySelectorAll('button[data-player]').forEach(btn=>btn.classList.remove('selected'));
}
}

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
if(qcPlayer==='ALL')return qcCommand;
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
from:GM_IDENTITY,
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
auctionSendBtn.disabled=!cmd;
}

auctionSendBtn.addEventListener('click',()=>{
const cmd=auctionBuildCommand();
if(!cmd)return;

socket.emit('sendMessage',{
from:GM_IDENTITY,
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
switchPreview.style.display='none';
const switchSendBtn=document.getElementById('switchSendBtn');

let switchPlayer1=null,switchPlayer2=null;
let switchPlayer1DefaultBtn=null;
const switchDefaultPlayer=`p${new URLSearchParams(location.search).get('p')||1}`;

function switchRefreshDisabled(){
switchPlayerRow1.querySelectorAll('button').forEach(btn=>{
const p=['p1','p2','p3','p4','p5','p6'].find(x=>btn.classList.contains(x));
const disabled=p===switchPlayer2;
btn.disabled=disabled;
btn.classList.toggle('disabled',disabled);
});
switchPlayerRow2.querySelectorAll('button').forEach(btn=>{
const p=['p1','p2','p3','p4','p5','p6'].find(x=>btn.classList.contains(x));
const disabled=p===switchPlayer1;
btn.disabled=disabled;
btn.classList.toggle('disabled',disabled);
});
}

['p1','p2','p3','p4','p5','p6'].forEach(p=>{
const b=document.createElement('button');
b.type='button';
b.className=`opt ${p}`;
b.textContent=p.toUpperCase();
b.addEventListener('click',()=>{
if(p===switchPlayer2)return;
switchPlayer1=p;
switchPlayerRow1.querySelectorAll('button').forEach(btn=>btn.classList.remove('selected'));
b.classList.add('selected');
switchRefreshDisabled();
switchUpdatePreview();
});
switchPlayerRow1.appendChild(b);
if(p===switchDefaultPlayer)switchPlayer1DefaultBtn=b;
});

['p1','p2','p3','p4','p5','p6'].forEach(p=>{
const b=document.createElement('button');
b.type='button';
b.className=`opt ${p}`;
b.textContent=p.toUpperCase();
b.addEventListener('click',()=>{
if(p===switchPlayer1)return;
switchPlayer2=p;
switchPlayerRow2.querySelectorAll('button').forEach(btn=>btn.classList.remove('selected'));
b.classList.add('selected');
switchRefreshDisabled();
switchUpdatePreview();
});
switchPlayerRow2.appendChild(b);
});

switchPlayer1DefaultBtn?.click();

function switchBuildCommand(){
if(!switchPlayer1||!switchPlayer2)return null;
if(switchPlayer1===switchPlayer2)return null;
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
from:GM_IDENTITY,
target:'##rento',
msg:cmd
});

const line=document.createElement('div');
line.textContent=`Sent: ${cmd}`;
cmdLog.prepend(line);
});

/* ==================== INITIALIZE ==================== */
cbReset();
