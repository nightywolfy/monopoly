function scaleBoard(){
const board=document.getElementById('board');
const wrapper=document.getElementById('boardWrapper');
if(!board||!wrapper)return;
const scale=Math.min(wrapper.clientWidth/900,wrapper.clientHeight/900);
board.style.transform=`scale(${scale})`;
board.style.transformOrigin='center center';
}

window.addEventListener('resize',scaleBoard);
scaleBoard();
