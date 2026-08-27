let labels={p1:'P1',p2:'P2',p3:'P3',p4:'P4',p5:'P5',p6:'P6'};
let lastMoney={p1:0,p2:0,p3:0,p4:0,p5:0,p6:0};

function renderMoneyBoxes(){
for(const p of ['p1','p2','p3','p4','p5','p6']){
document.getElementById(`money-${p}-overlay`).textContent=`${labels[p]}: $${lastMoney[p]}`;
}
}

function updateMoney(data){
lastMoney={...lastMoney,...data};
renderMoneyBoxes();
}

function updateLabels(data){
labels={...labels,...data};
renderMoneyBoxes();
}

socket.on('moneyUpdate',updateMoney);
socket.on('labelsUpdate',updateLabels);
