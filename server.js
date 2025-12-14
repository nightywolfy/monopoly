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
import express from "express";
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 });
app.set('trust proxy', true);
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '100kb' }));
app.get("/", (req, res) => {
  res.send("Hello Railway!");
});

// --- Persistent files ---
const moneyFile = path.join(__dirname, 'money.json');
const buildingsFile = path.join(__dirname, 'building.json');
const piecesFile = path.join(__dirname, 'pieces.json');
const display1File = path.join(__dirname, 'display1.json');
const display2File = path.join(__dirname, 'display2.json');
const dotsFile = path.join(__dirname, 'dots.json');



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

// --- Load persisted state ---
let money = safeReadJSON(moneyFile, { p1: 10, p2: 10, p3: 10, p4: 10 });
let pieces = safeReadJSON(piecesFile, { red:{x:825,y:755}, blue:{x:825,y:755}, yellow:{x:825,y:755}, green:{x:825,y:755} });
let display1 = safeReadJSON(display1File, { text: "" });
let display2 = safeReadJSON(display2File, { text: "" });
let activeDots = safeReadJSON(dotsFile, {});
let buildings = safeReadJSON(buildingsFile, {});


// --- Save helpers ---
const saveMoney = () => safeWriteJSON(moneyFile, money);
const saveBuildings = () => safeWriteJSON(buildingsFile, buildings);
const savePieces = () => safeWriteJSON(piecesFile, pieces);
const saveDisplay1 = () => safeWriteJSON(display1File, display1);
const saveDisplay2 = () => safeWriteJSON(display2File, display2);
const saveDots = () => safeWriteJSON(dotsFile, activeDots);






// ------------------------------
// Player HTML files
// ------------------------------
const playerFiles = {
    "player1": "player1.html",
    "player2": "player2.html",
    "p1": "p1.html",
    "p2": "p2.html",
    "p3": "p3.html",
    "p4": "p4.html"
};

// ------------------------------
// Active keys and claimed players (global to prevent redeclaration issues)
// ------------------------------
global.validKeys = global.validKeys || {};       // playerName -> { key, file, used, expires }
global.claimedPlayers = global.claimedPlayers || {};  // playerName -> true if claimed

// ------------------------------
// Key generation
// ------------------------------
function generateKey() {
    return Math.random().toString(36).substring(2, 12);
}

// ------------------------------
// Key lifetime
// ------------------------------
const KEY_LIFETIME_MS = 15 * 60 * 1000; // 15 minutes

// ------------------------------
// Cleanup expired keys every 4 minutes (keeps behavior similar to your previous value)
// ------------------------------
setInterval(() => {
    const now = Date.now();
    for (const player in global.validKeys) {
        const record = global.validKeys[player];
        if (record.expires < now) {
            console.log(`Key for ${player} expired automatically.`);
            delete global.validKeys[player];
            delete global.claimedPlayers[player];
        }
    }
}, 240 * 1000);

// ------------------------------
// Get key route (called by index.html)
// ------------------------------
app.get("/getKey", (req, res) => {
    const player = req.query.player;
    const game = req.query.game;

    if (!player || !game) return res.json({ ok: false, msg: "Missing player or game" });

    if (global.claimedPlayers[player]) return res.json({ ok: false, msg: "Player already in use" });

    let fileToUse;
    if (game === "2p") {
        if (!["player1", "player2"].includes(player)) return res.json({ ok: false });
        fileToUse = `${player}.html`;
    } else if (game === "4p") {
        if (!["p1","p2","p3","p4"].includes(player)) return res.json({ ok: false });
        fileToUse = `${player}.html`;
    } else return res.json({ ok: false });

    const key = generateKey();
    global.validKeys[player] = {
        key,
        file: fileToUse,
        used: false,
        expires: Date.now() + KEY_LIFETIME_MS
    };

    global.claimedPlayers[player] = true;

    console.log(`Generated key for ${player}: ${key} ? ${fileToUse}`);
    res.json({ ok: true, key });
});

// ------------------------------
// Player page route
// ------------------------------
app.get("/player", (req, res) => {
    const player = req.query.name;
    const auth = req.query.auth;

    if (!player || !auth) return res.status(400).send("Missing player or key");

    const record = global.validKeys[player];

    if (!record || record.key !== auth) return res.status(403).send("Invalid key");

    if (record.expires && Date.now() > record.expires) {
        delete global.claimedPlayers[player];
        delete global.validKeys[player];
        return res.status(403).send("Key expired");
    }

    if (record.used) return res.status(403).send("Key already used");

    record.used = true;

    return res.sendFile(path.join(__dirname, record.file));
});


// --- Board spaces ---
const boardSpaces = [
  { number: 0, x: 825, y: 825 }, { number: 1, x: 722, y: 825 }, { number: 2, x: 650, y: 825 }, { number: 3, x: 577, y: 825 },
  { number: 4, x: 505, y: 825 }, { number: 5, x: 430, y: 825 }, { number: 6, x: 360, y: 825 }, { number: 7, x: 287, y: 825 },
  { number: 8, x: 215, y: 825 }, { number: 9, x: 143, y: 825 }, { number: 10, x: 35, y: 825 }, { number: 11, x: 35, y: 720 },
  { number: 12, x: 35, y: 648 }, { number: 13, x: 35, y: 575 }, { number: 14, x: 35, y: 503 }, { number: 15, x: 35, y: 430 },
  { number: 16, x: 35, y: 360 }, { number: 17, x: 35, y: 288 }, { number: 18, x: 35, y: 215 }, { number: 19, x: 35, y: 143 },
  { number: 20, x: 35, y: 40 }, { number: 21, x: 140, y: 40 }, { number: 22, x: 210, y: 40 }, { number: 23, x: 285, y: 40 },
  { number: 24, x: 358, y: 40 }, { number: 25, x: 430, y: 40 }, { number: 26, x: 503, y: 40 }, { number: 27, x: 575, y: 40 },
  { number: 28, x: 650, y: 40 }, { number: 29, x: 720, y: 40 }, { number: 30, x: 820, y: 40 }, { number: 31, x: 820, y: 140 },
  { number: 32, x: 820, y: 212 }, { number: 33, x: 820, y: 285 }, { number: 34, x: 820, y: 355 }, { number: 35, x: 820, y: 425 },
  { number: 36, x: 820, y: 500 }, { number: 37, x: 820, y: 575 }, { number: 38, x: 820, y: 645 }, { number: 39, x: 820, y: 717 },
  { number: 40, x: 685, y: 710 }, { number: 41, x: 577, y: 710 }, { number: 42, x: 505, y: 710 }, { number: 43, x: 432, y: 710 },
  { number: 44, x: 360, y: 710 }, { number: 45, x: 288, y: 710 }, { number: 46, x: 150, y: 710 }, { number: 47, x: 150, y: 580 },
  { number: 48, x: 150, y: 505 }, { number: 49, x: 150, y: 430 }, { number: 50, x: 150, y: 360 }, { number: 51, x: 150, y: 290 },
  { number: 52, x: 150, y: 150 }, { number: 53, x: 285, y: 150 }, { number: 54, x: 358, y: 150 }, { number: 55, x: 430, y: 150 },
  { number: 56, x: 500, y: 150 }, { number: 57, x: 575, y: 150 }, { number: 58, x: 710, y: 150 }, { number: 59, x: 710, y: 285 },
  { number: 60, x: 710, y: 355 }, { number: 61, x: 710, y: 430 }, { number: 62, x: 710, y: 500 }, { number: 63, x: 710, y: 575 }
];

const colorMap = { p1: 'red', p2: 'blue', p3: 'yellow', p4: 'green' };

// --- Initialize defaults ---
function initializeDefaults() {
  Object.keys(colorMap).forEach(p => { if (money[p] === undefined) money[p] = 10; });
  // buildings object exists (no need to prefill with false). Ensure it's an object.
  if (!buildings || typeof buildings !== 'object') buildings = {};
  for (const color of Object.values(colorMap)) { if (!pieces[color]) pieces[color] = { x: 825, y: 755 }; }
  if (!display1.text) display1.text = "";
  if (!display2.text) display2.text = "";
  saveMoney(); saveBuildings(); savePieces(); saveDisplay1(); saveDisplay2(); saveDots();
}
initializeDefaults();

// --- Socket Emit Helpers ---
function safeEmit(event, data) { try { io.emit(event, data); } catch (err) { console.error(`[Socket] Emit failed (${event}):`, err); } }

// --- Player update helpers ---
function updatePiece(player,x,y){ const color=colorMap[player]; if(!color) return; const current=pieces[color]; if(current&&current.x===x&&current.y===y) return; pieces[color]={x,y}; savePieces(); safeEmit('piecesUpdate',pieces); }
function updateDisplay1(newText){ if(display1.text===newText) return; display1.text=newText; saveDisplay1(); safeEmit('displayUpdate1',{text:display1.text}); }
function updateDisplay2(newText){ if(display2.text===newText) return; display2.text=newText; saveDisplay2(); safeEmit('displayUpdate2',{text:display2.text}); }
function updateMoney(player,amount){ if(!colorMap[player]||money[player]===amount) return; money[player]=amount; saveMoney(); safeEmit('moneyUpdate',money); }

// --- Building helpers (unified) ---
function getBuilding(space) {
  return buildings[String(space)] || null;
}

function setBuilding(space, type, unset = false) {
  const key = String(Number(space));
  if (Number.isNaN(Number(key))) return false;
  if (unset) {
    if (!buildings[key]) return false;
    const old = buildings[key];
    delete buildings[key];
    saveBuildings();
    safeEmit('buildingsUpdate', buildings);
    safeEmit('building-removed', { space: Number(key), type: old });
    return true;
  } else {
    const old = buildings[key];
    // If same type already present, do nothing
    if (old === type) return false;
    // Replace previous building (if any)
    if (old) {
      // notify removal of old
      delete buildings[key];
      // fall through to set new one
    }
    buildings[key] = type;
    saveBuildings();
    safeEmit('buildingsUpdate', buildings);
    safeEmit('building-set', { space: Number(key), type });
    return { removed: old || null, set: type };
  }
}

// Bulk helper: set/unset multiple spaces to a type (or unset)
function bulkUpdateBuildings(spaces, type = null, unset = false) {
  let changed = false;
  const sanitized = spaces.map(s => Number(s)).filter(n => !Number.isNaN(n) && n >= 0 && n <= 39);
  sanitized.forEach(space => {
    const key = String(space);
    if (unset) {
      if (buildings[key]) {
        delete buildings[key];
        changed = true;
      }
    } else {
      if (type && buildings[key] !== type) {
        buildings[key] = type;
        changed = true;
      }
    }
  });
  if (!changed) return false;
  saveBuildings();
  safeEmit('buildingsUpdate', buildings);
  return true;
}

function clearAllBuildings() {
  const count = Object.keys(buildings).length;
  buildings = {};
  saveBuildings();
  safeEmit('buildingsUpdate', buildings);
  return count;
}

// --- Dots ---
function updateDot(num,color){
  const n=Number(num); if(Number.isNaN(n)) return false;
  const table=currentMap===1?coordinates1:coordinates2;
  const pos=table[n]; if(!pos) return false;
  activeDots[String(n)]={x:pos.x,y:pos.y,color:String(color)};
  saveDots(); safeEmit('draw-dot',{x:pos.x,y:pos.y,color,num:n});
  return true;
}
function removeDot(num){ const n=Number(num); if(isNaN(n)||!activeDots[String(n)]) return false; delete activeDots[String(n)]; saveDots(); safeEmit('remove-dot',n); return true; }
function clearAllDots(){ activeDots={}; saveDots(); safeEmit('clear-all-dots'); }


// --- Dot coordinate tables ---
const coordinates1 = { 1:{x:731,y:761},3:{x:587,y:761},4:{x:518,y:761},5:{x:446,y:761},6:{x:373,y:761},8:{x:227,y:761},9:{x:156,y:761},
11:{x:125,y:731},12:{x:125,y:661},13:{x:125,y:590},14:{x:125,y:515},15:{x:125,y:444},16:{x:125,y:369},17:{x:125,y:300},19:{x:125,y:154},
21:{x:157,y:124},22:{x:227,y:124},24:{x:373,y:124},25:{x:446,y:124},26:{x:517,y:124},27:{x:591,y:124},28:{x:665,y:124},29:{x:735,y:124},
31:{x:759,y:153},33:{x:759,y:296},34:{x:759,y:369},35:{x:759,y:443},37:{x:759,y:588},38:{x:759,y:661},39:{x:759,y:732} };

const coordinates2 = { 1:{x:760,y:875},3:{x:617,y:875},4:{x:544,y:875},5:{x:471,y:875},6:{x:399,y:875},8:{x:255,y:875},9:{x:183,y:875},
11:{x:13,y:760},12:{x:13,y:687},13:{x:13,y:616},14:{x:13,y:542},15:{x:13,y:468},16:{x:13,y:397},17:{x:13,y:324},19:{x:13,y:178},
21:{x:182,y:12},22:{x:255,y:12},24:{x:400,y:12},25:{x:472,y:12},26:{x:545,y:12},27:{x:616,y:12},28:{x:688,y:12},29:{x:762,y:12},
31:{x:872,y:178},33:{x:872,y:324},34:{x:872,y:396},35:{x:872,y:469},37:{x:872,y:615},38:{x:872,y:688},39:{x:872,y:760},40:{x:758,y:760},
41:{x:616,y:760},42:{x:544,y:760},44:{x:399,y:760},45:{x:326,y:760},46:{x:126,y:760},47:{x:126,y:615},50:{x:126,y:395},51:{x:126,y:324},
52:{x:126,y:126},53:{x:326,y:126},56:{x:545,y:126},57:{x:617,y:126},58:{x:758,y:126},59:{x:758,y:324},63:{x:758,y:616} };

let currentMap = 2;



// ------------------------------------------------------------------
// IRC Bot Factory (unchanged) but extended with dot/map commands
// ------------------------------------------------------------------
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
      const nick = event.nick;
      const target = event.target || nick;
      const defaultTarget = event.target;
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


          case '!house': {
            const spaces = args.map(a=>parseInt(a,10)).filter(n=>!isNaN(n)&&n>=0&&n<=39);
            if (spaces.length === 0) { safeSay(defaultTarget, 'Usage: !house <space>'); break; }
            const changed = bulkUpdateBuildings(spaces, 'house', false);
            if (changed) safeSay(defaultTarget, `Set house(s) on spaces: ${spaces.join(', ')}`);
            break;
          }

          case '!hotel': {
            const spaces = args.map(a=>parseInt(a,10)).filter(n=>!isNaN(n)&&n>=0&&n<=39);
            if (spaces.length === 0) { safeSay(defaultTarget, 'Usage: !hotel <space>'); break; }
            const changed = bulkUpdateBuildings(spaces, 'hotel', false);
            if (changed) safeSay(defaultTarget, `Set hotel(s) on spaces: ${spaces.join(', ')}`);
            break;
          }

          case '!unbuilding': {
            const spaces = args.map(a=>parseInt(a,10)).filter(n=>!isNaN(n)&&n>=0&&n<=39);
            if (spaces.length === 0) { safeSay(defaultTarget, 'Usage: !unbuilding <space>'); break; }
            const removed = bulkUpdateBuildings(spaces, null, true);
            if (removed) safeSay(defaultTarget, `Removed building(s) from spaces: ${spaces.join(', ')}`);
            else safeSay(defaultTarget, `No buildings removed (none present on provided spaces).`);
            break;
          }
          
          case '!clearall': {
            const count = clearAllBuildings();
            safeSay(defaultTarget, `All buildings cleared (${count} removed).`);
            break;
          }

          case '!d1': { const msgText=args.join(' ').trim().replace(/^"(.*)"$/,'$1'); if(!msgText){ safeSay(defaultTarget,'Usage: !d1 <text>'); break; } updateDisplay1(msgText); break; }

          case '!d2': { const msgText=args.join(' ').trim().replace(/^"(.*)"$/,'$1'); if(!msgText){ safeSay(defaultTarget,'Usage: !d2 <text>'); break; } updateDisplay2(msgText); break; }

          case '!dot': {
            if(args.length>=1){
              const n=args[0];
              const color=args[1]||'red';
              if(updateDot(n,color)) safeSay(defaultTarget,`Dot set: ${n} -> ${color}`);
              else safeSay(defaultTarget,`Invalid number: ${n}`);
            }
            break;
          }
          
       
          case '!removedot': {
            if (args.length >= 1) {
              const n = args[0];
              if (removeDot(n)) safeSay(defaultTarget, `Dot removed: ${n}`);
              else safeSay(defaultTarget, `No dot at ${n}`);
            }
            break;
          }

          case '!cleardot': {
            const count = Object.keys(activeDots).length;
            clearAllDots();
            safeSay(defaultTarget, `Cleared ${count} dot(s)`);
            break;
          }
        
        // --- COORDINATE TABLE SWITCH ---
          case '!dotlocation': {
            const num = parseInt(args[0], 10);
            if (Number.isNaN(num) || (num !== 1 && num !== 2)) {
              safeSay(defaultTarget, 'Usage: !dotlocation <1 or 2>');
              break;
            }
            currentMap = num;
            safeEmit('reload-dots', activeDots);
            safeSay(defaultTarget, `Switched coordinates table to coordinates${num}`);
            break;
          }

          case '!map': {
            const num = parseInt(args[0], 10);
            if (isNaN(num) || num < 1) {
              safeSay(defaultTarget, 'Usage: !map <number> (e.g., !map 1, !map 2)');
              break;
            }
            safeEmit('map-change', num);
            safeSay(defaultTarget, `Switched map image to map${num}.png`);
            break;
            
          }
case '!sound': {
  const file = args[0];
  if (!file) break;

  const botKey = 'player2bot';

  // Safe lookup: works even if bots[player5bot] or .nick is undefined
  const botObj  = bots[botKey];
  const botNick = botObj?.nick || botKey;

  // Only allow !sound if message was sent in PM to player5bot
  const isPrivate = (target === botNick || target === botKey);

  if (isPrivate) {
    io.emit('play-sound', { file, bot: botKey });
    console.log(`[Sound IRC] ${nick} triggered sound: ${file}`);
  } else {
    console.log(`[Sound IRC] Ignored !sound from non-PM target: ${target}`);
  }

  break;
}

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

const bots = {
  dice1bot: createBot('dice1bot', 'rentobot'),
  dice2bot: createBot('dice2bot', 'rentobot'),
  player1bot: createBot('player1bot', '##rento'),
  player2bot: createBot('player2bot', '##rento'),
  player3bot: createBot('player3bot', '##rento'),
  player4bot: createBot('player4bot', '##rento')
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
      if(!cleanMsg) return;

      bots[bot].say(bots[bot].defaultTarget, cleanMsg); 
    });
    
    socket.on('getMoney',()=>socket.emit('moneyUpdate',money));
    socket.on('getPieces',()=>socket.emit('piecesUpdate',pieces));
    // removed socket events for hotels/houses (backward-compat removed)
    // preferred new event
    socket.on('getBuildings',()=>socket.emit('buildingsUpdate',buildings));

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


    socket.emit('map-change', currentMap);
    socket.emit('reload-dots', activeDots);
    socket.on('cmd-dot', ({ num, color }) => updateDot(num, color));
    socket.on('cmd-remove', num => removeDot(num));
    socket.on('cmd-cleardot', () => clearAllDots());
    socket.on('cmd-map', (num) => {
      const n = Number(num);
      if (Number.isNaN(n) || n < 1) return;
      currentMap = n;
      safeEmit('map-change', currentMap);
      safeEmit('reload-dots', activeDots);
    });
    
    socket.on('cmd-dotlocation', num => {
      const n = Number(num);
      if(Number.isNaN(n) || (n !== 1 && n !== 2)) return;
      currentMap = n;
      safeEmit('reload-dots', activeDots);
    });

    // socket-based building commands (optional helpers from UI)
    socket.on('cmd-set-building', ({ space, type }) => {
      if (typeof space === 'undefined' || !type) return;
      setBuilding(space, type, false);
    });
    socket.on('cmd-remove-building', (space) => {
      if (typeof space === 'undefined') return;
      setBuilding(space, null, true);
    });
    socket.on('cmd-clear-buildings', () => clearAllBuildings());
   
    socket.on('disconnect',()=>console.log(`[Socket] Frontend disconnected: ${ip}`));
  } catch(err){ console.error('[Socket] Error:',err); }
});

// --- Serve static files + JSON endpoints ---
app.use(express.static(__dirname));
app.get('/pieces.json', (_, res) => res.json(pieces));
app.get('/money.json', (_, res) => res.json(money));
app.get('/building.json', (_, res) => res.json(buildings));
app.get('/display1.json', (_, res) => res.json(display1));
app.get('/display2.json', (_, res) => res.json(display2));
app.get('/dots.json', (_, res) => res.json(activeDots));

// --- Graceful shutdown ---
let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[Server] Received ${signal}, shutting down gracefully...`);

  try {
    saveMoney(); saveBuildings(); savePieces(); saveDisplay1(); saveDisplay2(); saveDots();

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

// --- Start server ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});