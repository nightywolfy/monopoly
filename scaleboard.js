function scaleBoard(){
const container=document.getElementById('boardContainer');
const wrapper=document.getElementById('boardWrapper');
const scale=Math.min(wrapper.clientWidth/900,wrapper.clientHeight/900);
container.style.transform=`scale(${scale})`;
}

window.addEventListener('resize',scaleBoard);
document.addEventListener('DOMContentLoaded',scaleBoard);
