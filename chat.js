const player=`p${new URLSearchParams(location.search).get('p')||1}`;
const chatMessages=document.getElementById('chatMessages');
const chatInput=document.getElementById('chatInput');
const chatSend=document.getElementById('chatSend');

function addChatMessage({name,message,type}){
const row=document.createElement('div');
row.className=`chat-message ${type}`;
row.innerHTML='<strong></strong><span></span>';
row.firstChild.textContent=name+': ';
row.lastChild.textContent=message;
chatMessages.appendChild(row);
if(chatMessages.children.length>1000)chatMessages.firstChild.remove();
chatMessages.scrollTop=chatMessages.scrollHeight;
}

async function identifyPlayer(){
socket.emit('set-player',player);
const info={width:screen.width,height:screen.height};
if(navigator.userAgentData?.getHighEntropyValues){
try{info.platformVersion=(await navigator.userAgentData.getHighEntropyValues(['platformVersion'])).platformVersion}catch{}
}
socket.emit('screen-info',info);
}

function sendChat(){
const msg=chatInput.value.trim();
if(!msg)return;
socket.emit('chat-message',{msg});
chatInput.value='';
chatInput.focus();
}

document.addEventListener('DOMContentLoaded',()=>{
chatInput.addEventListener('keydown',e=>e.key==='Enter'&&(e.preventDefault(),sendChat()));
chatSend.addEventListener('click',sendChat);
});

socket.on('connect',identifyPlayer);
socket.on('chat-message',addChatMessage);
socket.on('cmd-ack',r=>r?.error&&addChatMessage({name:'Monopoly',message:r.error,type:'error'}));
