function updatePieces(data){
if(!data||typeof data!=="object"){console.warn("Pieces data invalid:",data);return;}
const posMap={};
for(const [id,pos] of Object.entries(data)){
if(!pos||typeof pos.x!=="number"||typeof pos.y!=="number")continue;
if(id!=="p1"&&id!=="p2")continue;
const key=`${pos.x},${pos.y}`;
if(!posMap[key])posMap[key]=[];
posMap[key].push(id);
}
for(const [key,ids] of Object.entries(posMap)){
const [baseX,baseY]=key.split(",").map(Number);
ids.forEach((id,idx)=>{
const el=document.getElementById(id);
if(!el)return;
let offsetX=0,offsetY=0;
if(idx===1)offsetX=10;
if(idx===2)offsetY=10;
el.style.left=(baseX+offsetX)+"px";
el.style.top=(baseY+offsetY)+"px";
el.style.zIndex=20;
});
}
}

socket.on('piecesUpdate',updatePieces);
