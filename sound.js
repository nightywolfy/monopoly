if(!window.SOUND_LISTENER_LOCK){
window.SOUND_LISTENER_LOCK=true;
socket.on('play-sound',({file})=>new Audio(file).play());
}
