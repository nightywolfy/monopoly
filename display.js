function updateDisplay1(text){
document.getElementById('display1').innerText=text||'';
}

function updateDisplay2(text){
document.getElementById('display2').innerText=text||'';
}

socket.on('displayUpdate1',data=>updateDisplay1(data.text));
socket.on('displayUpdate2',data=>updateDisplay2(data.text));
