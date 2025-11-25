import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import IRC from 'irc-framework';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import crypto from 'crypto';

// --- Path helpers ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Express + Socket.IO ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 });
app.set('trust proxy', true);
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '100kb' }));


// --- Persistent files ---
const moneyFile = path.join(__dirname, 'money.json');
const hotelsFile = path.join(__dirname, 'hotels.json');
const housesFile = path.join(__dirname, 'houses.json');
const piecesFile = path.join(__dirname, 'pieces.json');
const display1File = path.join(__dirname, 'display1.json');
const display2File = path.join(__dirname, 'display2.json');


// --- File helpers ---
function safeReadJSON(file, fallback = {}) {
  try {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return fallback;
  }
}

function safeWriteJSON(file, data) {
  const tmpFile = `${file}.tmp`;
  const json = JSON.stringify(data, null, 2);
  try {
    writeFileSync(tmpFile, json, 'utf-8');
    renameSync(tmpFile, file);
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
}



let money = safeReadJSON(moneyFile, { p1: 10, p2: 10, p3: 10, p4: 10 });
let hotels = safeReadJSON(hotelsFile, {});
let houses = safeReadJSON(housesFile, {});
let pieces = safeReadJSON(piecesFile, {
  red: { x: 825, y: 755 },
  blue: { x: 825, y: 755 },
  yellow: { x: 825, y: 755 },
  green: { x: 825, y: 755 }
});
let display1 = safeReadJSON(display1File, { text: "" });
let display2 = safeReadJSON(display2File, { text: "" });

const saveMoney = () => safeWriteJSON(moneyFile, money);
const saveHotels = () => safeWriteJSON(hotelsFile, hotels);
const saveHouses = () => safeWriteJSON(housesFile, houses);
const savePieces = () => safeWriteJSON(piecesFile, pieces);
const saveDisplay1 = () => safeWriteJSON(display1File, display1);
const saveDisplay2 = () => safeWriteJSON(display2File, display2);

// ------------------------------
//  KEYS STORAGE
// ------------------------------
let validKeys = {};   // { playerName: {key, file} }
let playerFiles = {   // player name -> file in root
    "player1": "player1.html",
    "player2": "player2.html",
    "p1": "p1.html",
    "p2": "p2.html",
    "p3": "p3.html",
    "p4": "p4.html"
};

// ------------------------------
//  GENERATE RANDOM KEY
// ------------------------------
function generateKey() {
    return Math.random().toString(36).substring(2, 12);
}

// ------------------------------
//  KEY EXPIRATION TIME
// ------------------------------
const KEY_LIFETIME_MS = 15 * 60 * 1000; // 15 minutes

// ------------------------------
//  GET KEY ROUTE (used by buttons)
// ------------------------------
app.get("/getKey", (req, res) => {
    const player = req.query.player;
    const game = req.query.game;

    if (!player || !game) return res.json({ ok: false });

    let fileToUse;

    if (game === "2p") {
        if (!["player1","player2"].includes(player)) return res.json({ ok: false });
        fileToUse = `${player}.html`;
    } else if (game === "4p") {
        if (!["p1","p2","p3","p4"].includes(player)) return res.json({ ok: false });
        fileToUse = `${player}.html`;
    } else return res.json({ ok: false });

    const key = generateKey();
    validKeys[player] = {
        key,
        file: fileToUse,
        used: false,
        expires: Date.now() + KEY_LIFETIME_MS
    };

    console.log(`Generated key for ${player}: ${key} ? ${fileToUse}`);
    res.json({ ok: true, key });
});

// ------------------------------
//  PLAYER ROUTE
// ------------------------------
app.get("/player", (req, res) => {
    const player = req.query.name;
    const auth = req.query.auth;

    if (!player || !auth) return res.status(400).send("Missing player or key");

    const record = validKeys[player];

    if (!record || record.key !== auth) {
        return res.status(403).send("Invalid key");
    }

    // Check if key is already used
    if (record.used) {
        return res.status(403).send("Key already used");
    }

    // Check expiration
    if (record.expires && Date.now() > record.expires) {
        return res.status(403).send("Key expired");
    }

    // Mark as used
    record.used = true;

    return res.sendFile(path.join(__dirname, record.file));
});











// --- Board spaces ---
const boardSpaces = [
  { number: 0, x: 825, y: 755 }, { number: 1, x: 730, y: 775 }, { number: 2, x: 650, y: 775 }, { number: 3, x: 580, y: 775 },
  { number: 4, x: 505, y: 775 }, { number: 5, x: 430, y: 775 }, { number: 6, x: 355, y: 775 }, { number: 7, x: 280, y: 775 },
  { number: 8, x: 205, y: 775 }, { number: 9, x: 134, y: 775 }, { number: 10, x: 40, y: 775 }, { number: 11, x: 34, y: 680 },
  { number: 12, x: 38, y: 612 }, { number: 13, x: 42, y: 545 }, { number: 14, x: 46, y: 475 }, { number: 15, x: 50, y: 405 },
  { number: 16, x: 54, y: 345 }, { number: 17, x: 58, y: 280 }, { number: 18, x: 62, y: 215 }, { number: 19, x: 66, y: 155 },
  { number: 20, x: 75, y: 75 }, { number: 21, x: 155, y: 75 }, { number: 22, x: 223, y: 75 }, { number: 23, x: 295, y: 75 },
  { number: 24, x: 360, y: 75 }, { number: 25, x: 430, y: 75 }, { number: 26, x: 500, y: 75 }, { number: 27, x: 570, y: 75 },
  { number: 28, x: 637, y: 75 }, { number: 29, x: 705, y: 75 }, { number: 30, x: 796, y: 75 }, { number: 31, x: 800, y: 155 },
  { number: 32, x: 803, y: 215 }, { number: 33, x: 806, y: 277 }, { number: 34, x: 809, y: 340 }, { number: 35, x: 812, y: 408 },
  { number: 36, x: 815, y: 478 }, { number: 37, x: 818, y: 543 }, { number: 38, x: 821, y: 610 }, { number: 39, x: 824, y: 680 }
];

const colorMap = { p1: 'red', p2: 'blue', p3: 'yellow', p4: 'green' };

// --- Initialize defaults ---
function initializeDefaults() {
  Object.keys(colorMap).forEach(p => { if (money[p] === undefined) money[p] = 10; });
  for (let i = 0; i < 40; i++) { if (hotels[i] === undefined) hotels[i] = false; if (houses[i] === undefined) houses[i] = false; }
  for (const color of Object.values(colorMap)) { if (!pieces[color]) pieces[color] = { x: 825, y: 755 }; }
  if (!display1.text) display1.text = "";
  if (!display2.text) display2.text = "";
  saveMoney(); saveHotels(); saveHouses(); savePieces(); saveDisplay1(); saveDisplay2();
}
initializeDefaults();

// --- Socket Emit Helpers ---
function safeEmit(event, data) { try { io.emit(event, data); } catch (err) { console.error(`[Socket] Emit failed (${event}):`, err); } }
// --- Player update helpers ---
function updatePiece(player, x, y) { 
  const color = colorMap[player]; 
  if (!color) return; 
  const current = pieces[color]; 
  if (current && current.x === x && current.y === y) return; 
  pieces[color] = { x, y }; 
  savePieces(); 
  safeEmit('piecesUpdate', pieces); 
}

function updateDisplay1(newText) { 
  if (display1.text === newText) return; 
  display1.text = newText; 
  saveDisplay1(); 
  safeEmit('displayUpdate1', { text: display1.text }); 
}

function updateDisplay2(newText) { 
  if (display2.text === newText) return; 
  display2.text = newText; 
  saveDisplay2(); 
  safeEmit('displayUpdate2', { text: display2.text }); 
}

function updateMoney(player, amount) { 
  if (!colorMap[player] || money[player] === amount) return; 
  money[player] = amount; 
  saveMoney(); 
  safeEmit('moneyUpdate', money); 
}

function updateBuildings(targetObj, spaces, unset = false) {
  let changed = false;
  spaces.forEach(space => { 
    if (space < 0 || space > 39) return; 
    if (targetObj[space] !== !unset) { 
      targetObj[space] = !unset; 
      changed = true; 
    } 
  });
  if (!changed) return false;
  if (targetObj === hotels) saveHotels(); else saveHouses();
  safeEmit(targetObj === hotels ? 'hotelsUpdate' : 'housesUpdate', targetObj);
  return true;
}
// --- IRC Bot Factory ---
function createBot(nick, defaultTarget, options = {}) {
  const client = new IRC.Client();
  const host = options.host || 'irc.libera.chat';
  const port = options.port || 6667;
  const secure = !!options.secure;
  const nickServ = options.nickServ || null;

  let reconnectDelay = 9000, isConnecting = false, isConnected = false, destroyed = false;
  const sendQueue = [], SEND_INTERVAL_MS = 900;
  let sendInterval = null;

  function startSendLoop() {
    if (sendInterval) return;
    sendInterval = setInterval(() => {
      if (!sendQueue.length || !isConnected) return;
      const { msg, target } = sendQueue.shift();
      try { client.say(target, msg); } catch (err) { console.error(`[${nick}] send error:`, err); }
    }, SEND_INTERVAL_MS);
  }
  startSendLoop();
  function stopSendLoop() { if (sendInterval) { clearInterval(sendInterval); sendInterval = null; } }

  function safeSay(target, msg) {
    if (!msg || typeof msg !== 'string') return;
    const clean = msg.trim().slice(0, 200).replace(/\r?\n/g, ' ');
    if (!clean) return;
    sendQueue.push({ target, msg: clean });
  }

  function connectBot() {
    if (destroyed || isConnecting || isConnected) return;
    isConnecting = true;
    try { client.connect({ host, port, nick, secure, timeout: 20000, auto_reconnect: false }); } 
    catch (err) { console.error(`${nick} connection error:`, err); isConnecting = false; reconnectDelay = Math.min(reconnectDelay*2,60000); setTimeout(connectBot,reconnectDelay); }
  }
  connectBot();

  client.on('registered', () => {
    reconnectDelay = 9000; isConnecting=false; isConnected=true;
    if (defaultTarget) { try { client.join(defaultTarget); } catch {} }
    if (nickServ?.identifyCommand) client.say('NickServ', nickServ.identifyCommand);
  });

  client.on('close', () => { 
    isConnected=false; isConnecting=false; 
    if (sendQueue.length>2000) sendQueue.length=0;
    setTimeout(()=>{ reconnectDelay=Math.min(reconnectDelay*2,60000); connectBot(); }, reconnectDelay); 
  });

  client.on('error', (err) => console.error(`Error for ${nick}:`, err?.stack || err));

  client.on('message', (event) => {
    try {
      if (!event?.message) return;
      const raw = String(event.message).trim();
      if (!raw.startsWith('!')) return;
      const commands = raw.split(' !').map((c,i) => i>0?'!'+c:c);
      for (const fullCmd of commands) {
        if (!fullCmd) continue;
        const parts = fullCmd.trim().split(/\s+/);
        const cmd = (parts.shift() || '').toLowerCase();
        const args = parts;

        switch(cmd) {
          case '!set': {
            if (args[0]?.toLowerCase() !== 'all' || args.length !== Object.keys(colorMap).length + 1) { safeSay(defaultTarget, `Usage: !set all <amounts for ${Object.keys(colorMap).length} players>`); break; }
            const amounts = args.slice(1).map(a=>parseInt(a,10));
            if (amounts.some(a=>isNaN(a))) { safeSay(defaultTarget,'All amounts must be valid numbers.'); break; }
            Object.keys(colorMap).forEach((p,i)=>updateMoney(p,Math.max(-999,Math.min(9999,amounts[i]))));
            break;
          }

          case '!mv': {
            const [target,...spacesStr] = args;
            if (target?.toLowerCase()!=='all') { safeSay(defaultTarget,'Only !mv all ... allowed'); break; }
            const players = Object.keys(colorMap);
            if (spacesStr.length!==players.length) { safeSay(defaultTarget,`Must provide exactly ${players.length} spaces`); break; }
            players.forEach((p,i)=>{ const space=parseInt(spacesStr[i],10); if(isNaN(space)||space<0||space>=boardSpaces.length){ safeSay(defaultTarget,`Invalid space "${spacesStr[i]}"`); return; } const {x,y}=boardSpaces[space]; updatePiece(p,x,y); });
            break;
          }

          case '!mv2': {
            const [player,xStr,yStr]=args;
            const x=parseInt(xStr,10),y=parseInt(yStr,10);
            if(!colorMap[player]||isNaN(x)||isNaN(y)){ safeSay(defaultTarget,'Invalid player or coordinates'); break; }
            updatePiece(player,x,y);
            break;
          }

          case '!hotel': case '!uhotel': case '!house': case '!uhouse': {
            const unset = cmd.startsWith('!u');
            const isHotel = cmd.includes('hotel');
            const targetObj = isHotel ? hotels : houses;
            const spaces = args.map(a=>parseInt(a,10)).filter(n=>!isNaN(n)&&n>=0&&n<=39);
            if (spaces.length===0) break;
            const changed = updateBuildings(targetObj,spaces,unset);
            if(changed) safeSay(defaultTarget,`${unset?'Removed':'Set'} ${isHotel?'hotel(s)':'house(s)'} on spaces: ${spaces.join(', ')}`);
            break;
          }
          
          case '!clearall': { updateBuildings(hotels,Object.keys(hotels).map(Number),true); updateBuildings(houses,Object.keys(houses).map(Number),true); safeSay(defaultTarget,'All hotels and houses cleared.'); break; }

          case '!d1': { const msgText=args.join(' ').trim().replace(/^"(.*)"$/,'$1'); if(!msgText){ safeSay(defaultTarget,'Usage: !d1 <text>'); break; } updateDisplay1(msgText); break; }

          case '!d2': { const msgText=args.join(' ').trim().replace(/^"(.*)"$/,'$1'); if(!msgText){ safeSay(defaultTarget,'Usage: !d2 <text>'); break; } updateDisplay2(msgText); break; }

          default: break;
        }
      }
    } catch(err){ console.error(`Command error ${nick}:`,err?.stack||err); }
  });

  return { 
    client, 
    defaultTarget, 
    say:(t,m)=>safeSay(t,m), 
    connect:connectBot, 
    destroy:()=>{destroyed=true;isConnecting=false;isConnected=false;stopSendLoop();try{client.quit('shutdown',true);}catch{}}, 
    getState:()=>({nick,isConnected,reconnectDelay}) 
  };
}

// --- Create bots ---
const bots = {

  player9bot:createBot('player9bot','##rento')
};

// --- Express + Socket.IO endpoints ---
app.post('/send-irc',(req,res)=>{
  try{ 
    const {bot,msg}=req.body||{}; 
    if(!bot||!msg) return res.status(400).send('Missing bot or message'); 
    if(!bots[bot]) return res.status(400).send('Unknown bot'); 
    bots[bot].say(bots[bot].defaultTarget,String(msg)); 
    return res.redirect('/'); 
  }
  catch(err){ console.error('/send-irc error:',err); return res.status(500).send('Server error'); }
});

io.on('connection',(socket)=>{
  try{
    const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim()||socket.handshake.address;
    console.log(`[Socket] Frontend connected: ${ip}`);

    socket.on('sendMessage',payload=>{ 
      if(!payload||typeof payload!=='object') return; 
      const bot=payload.bot,msg=payload.msg; 
      if(!bots[bot]||typeof msg!=='string') return; 
      const cleanMsg = msg.trim().slice(0,200).replace(/\n/g,' '); 
      if(cleanMsg) bots[bot].say(bots[bot].defaultTarget,cleanMsg); 
    });

    socket.on('getMoney',()=>socket.emit('moneyUpdate',money));
    socket.on('getPieces',()=>socket.emit('piecesUpdate',pieces));
    socket.on('getHotels',()=>socket.emit('hotelsUpdate',hotels));
    socket.on('getHouses',()=>socket.emit('housesUpdate',houses));
    socket.on('getDisplay1',()=>socket.emit('displayUpdate1',{text:display1.text}));
    socket.on('getDisplay2',()=>socket.emit('displayUpdate2',{text:display2.text}));

    socket.on('updateMoney',payload=>{ 
      const player=payload.player; 
      const amount=parseInt(payload.amount,10); 
      if(!colorMap[player]||Number.isNaN(amount)||amount<-999||amount>9999) return; 
      updateMoney(player,amount); 
    });

    socket.on('updateDisplay1',payload=>{ 
      const newText=String(payload?.text||'').trim(); 
      if(newText) updateDisplay1(newText); 
    });

    socket.on('updateDisplay2',payload=>{ 
      const newText=String(payload?.text||'').trim(); 
      if(newText) updateDisplay2(newText); 
    });

    socket.on('disconnect',()=>console.log(`[Socket] Frontend disconnected: ${ip}`));
  } catch(err){ console.error('[Socket] Error:',err); }
});

// --- Serve static files + JSON endpoints ---
app.use(express.static(__dirname));
app.get('/pieces.json',(_,res)=>res.json(pieces));
app.get('/money.json',(_,res)=>res.json(money));
app.get('/hotels.json',(_,res)=>res.json(hotels));
app.get('/houses.json',(_,res)=>res.json(houses));
app.get('/display1.json',(_,res)=>res.json(display1));
app.get('/display2.json',(_,res)=>res.json(display2));


// --- Graceful shutdown ---
let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[Server] Received ${signal}, shutting down gracefully...`);

  try {
    saveMoney(); saveHotels(); saveHouses(); savePieces(); saveDisplay1(); saveDisplay2();

    for (const bot of Object.values(bots)) {
      try { bot.destroy(); } catch (err) { console.error(`[Server] Error destroying bot:`, err); }
    }

    io.close(() => console.log('[Server] Socket.IO closed.'));
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });

    setTimeout(() => {
      console.warn('[Server] Forcing shutdown after 5 seconds.');
      process.exit(1);
    }, 5000);

  } catch (err) {
    console.error('[Server] Error during graceful shutdown:', err);
    process.exit(1);
  }
}

['SIGINT','SIGTERM'].forEach(sig => process.on(sig, () => gracefulShutdown(sig)));

const PORT = process.env.PORT||3000;
server.listen(PORT,()=>console.log(`[Server] Running at http://localhost:${PORT}`));
