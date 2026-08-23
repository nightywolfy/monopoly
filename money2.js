let labels={p1:'P1',p2:'P2'};
let lastMoney={p1:0,p2:0};

function renderMoneyBoxes(){
document.getElementById('money-p1-overlay').textContent=labels.p1+': $'+lastMoney.p1;
document.getElementById('money-p2-overlay').textContent=labels.p2+': $'+lastMoney.p2;
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


