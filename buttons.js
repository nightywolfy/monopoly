const group1=[1,3,4,5,6,8,9,21,22,24,25,26,27,28,29,41,42,44,45,53,56,57];
const group2=[11,12,13,14,15,16,17,19,31,33,34,35,37,38,39,47,50,51,59,63];
const modeLabels={mortgage:'Mortgage',redeem:'Redeem',addhouse:'AddHouse',removehouse:'RemoveHouse'};
const boardButtonsContainer=document.getElementById('boardButtons');
const modeButtons=document.querySelectorAll('.mode-btn');
let currentMode='mortgage';

function buildBoardButtons(data){
data.forEach(coords=>{
const spaceNum=coords.number;
const btn=document.createElement('button');
btn.textContent=spaceNum;
Object.assign(btn.style,{
position:'absolute',left:`${coords.x}px`,top:`${coords.y}px`,
backgroundColor:'transparent',border:'none',color:'transparent',
zIndex:'100',cursor:'pointer',pointerEvents:'auto'
});
if(group1.includes(spaceNum)){
Object.assign(btn.style,{width:'50px',height:'105px',fontSize:'0.85em'});
}else if(group2.includes(spaceNum)){
Object.assign(btn.style,{width:'105px',height:'50px',fontSize:'0.75em'});
}else{
Object.assign(btn.style,{width:'110px',height:'110px',fontSize:'0.8em'});
}
btn.addEventListener('click',()=>socket.emit('sendMessage',{from:BOT_NAME,target:'rentobot',msg:`!${currentMode} ${spaceNum}`}));
boardButtonsContainer.appendChild(btn);
});
}

document.addEventListener('DOMContentLoaded',()=>{

modeButtons.forEach(btn=>{
btn.addEventListener('click',()=>{
modeButtons.forEach(b=>b.classList.remove('active'));
btn.classList.add('active');
currentMode=btn.dataset.mode;
boardButtonsContainer.querySelectorAll('button').forEach(b=>{
b.title=`${currentMode[0].toUpperCase()+currentMode.slice(1)} space ${b.textContent}`;
});
});
});

document.querySelectorAll('form[target="hiddenFrame"]').forEach(form=>{
form.addEventListener('submit',e=>{
e.preventDefault();
const bot=form.querySelector('[name="bot"]').value;
const msg=form.querySelector('[name="msg"]').value;
const target=form.querySelector('[name="target"]')?.value;
fetch(form.action,{
method:form.method||'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({bot,target,msg})
}).catch(console.error);
});
});

document.querySelectorAll('[data-msg]').forEach(el=>{
el.addEventListener('click',()=>{
socket.emit('sendMessage',{from:el.dataset.from||BOT_NAME,target:el.dataset.target,msg:el.dataset.msg});
});
});

});

socket.on('clickableSpacesData',buildBoardButtons);
