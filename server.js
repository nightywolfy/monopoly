import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import IRC from 'irc-framework';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';


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


// --- File helpers with safe atomic writes ---
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


// --- Persistent files ---
const moneyFile = path.join(__dirname, 'money.json');
const hotelsFile = path.join(__dirname, 'hotels.json');
const housesFile = path.join(__dirname, 'houses.json');

let money = safeReadJSON(moneyFile, { p1: 10, p2: 10, p3: 10, p4: 10 });
let hotels = safeReadJSON(hotelsFile, {});
let houses = safeReadJSON(housesFile, {});

const saveMoney = () => safeWriteJSON(moneyFile, money);
const saveHotels = () => safeWriteJSON(hotelsFile, hotels);
const saveHouses = () => safeWriteJSON(housesFile, houses);

const boardSpaces = [
  { number: 0,  x: 825, y: 755 }, { number: 1,  x: 730, y: 775 },
  { number: 2,  x: 650, y: 775 }, { number: 3,  x: 580, y: 775 },
  { number: 4,  x: 505, y: 775 }, { number: 5,  x: 430, y: 775 },
  { number: 6,  x: 355, y: 775 }, { number: 7,  x: 280, y: 775 },
  { number: 8,  x: 205, y: 775 }, { number: 9,  x: 134, y: 775 },
  { number: 10, x: 40,  y: 775 }, { number: 11, x: 34,  y: 680 },
  { number: 12, x: 38,  y: 612 }, { number: 13, x: 42,  y: 545 },
  { number: 14, x: 46,  y: 475 }, { number: 15, x: 50,  y: 405 },
  { number: 16, x: 54,  y: 345 }, { number: 17, x: 58,  y: 280 },
  { number: 18, x: 62,  y: 215 }, { number: 19, x: 66,  y: 155 },
  { number: 20, x: 75, y: 75  }, { number: 21, x: 155, y: 75  },
  { number: 22, x: 223, y: 75  }, { number: 23, x: 295, y: 75  },
  { number: 24, x: 360, y: 75  }, { number: 25, x: 430, y: 75  },
  { number: 26, x: 500, y: 75  }, { number: 27, x: 570, y: 75  },
  { number: 28, x: 637, y: 75  }, { number: 29, x: 705, y: 75  },
  { number: 30, x: 796, y: 75  }, { number: 31, x: 800, y: 155 },
  { number: 32, x: 803, y: 215 }, { number: 33, x: 806, y: 277 },
  { number: 34, x: 809, y: 340 }, { number: 35, x: 812, y: 408 },
  { number: 36, x: 815, y: 478 }, { number: 37, x: 818, y: 543 },
  { number: 38, x: 821, y: 610 }, { number: 39, x: 824, y: 680 }
];


// --- Pieces ---
let pieces = {
  red:    { x: boardSpaces[0].x, y: boardSpaces[0].y },
  blue:   { x: boardSpaces[0].x, y: boardSpaces[0].y },
  yellow: { x: boardSpaces[0].x, y: boardSpaces[0].y },
  green:  { x: boardSpaces[0].x, y: boardSpaces[0].y }
};

// --- Player color mapping ---
const colorMap = { p1: 'red', p2: 'blue', p3: 'yellow', p4: 'green' };

// --- Initialize defaults ---
function initializeDefaults() {
  Object.keys(colorMap).forEach(p => { if (money[p] === undefined) money[p] = 10; });
  for (let i = 0; i < 40; i++) {
    if (hotels[i] === undefined) hotels[i] = false;
    if (houses[i] === undefined) houses[i] = false;
  }
  saveMoney(); saveHotels(); saveHouses();
}
initializeDefaults();

// --- Safe emit helper ---
function safeEmit(event, data) {
  try { io.emit(event, data); } catch (err) { console.error(`[Socket] Emit failed (${event}):`, err); }
}

// --- Update piece ---
function updatePiece(player, x, y) {
  const color = colorMap[player];
  if (!color) return;
  const current = pieces[color];
  if (current && current.x === x && current.y === y) return;
  pieces[color] = { x, y };
  safeEmit('piecesUpdate', pieces);
}

// --- IRC Bot Factory (stable) ---
function createBot(nick, defaultTarget, options = {}) {
  const client = new IRC.Client();
  const host = options.host || 'irc.libera.chat';
  const port = options.port || 6667;
  const secure = !!options.secure;
  const nickServ = options.nickServ || null;

  let reconnectDelay = 9000; // start 9s
  const maxDelay = 60000;
  let isConnecting = false;
  let isConnected = false;
  let destroyed = false;

  // --- send queue / throttling ---
  const sendQueue = [];
  let sendInterval = null;
  const SEND_INTERVAL_MS = 900; // safe throttle (adjust if needed)

  function startSendLoop() {
    if (sendInterval) return;
    sendInterval = setInterval(() => {
      if (!sendQueue.length || !isConnected) return;
      const { msg, target } = sendQueue.shift();
      try {
        client.say(target, msg);
      } catch (err) {
        console.error(`[${nick}] safeSay send error:`, err);
      }
    }, SEND_INTERVAL_MS);
  }
  startSendLoop();

  function stopSendLoop() {
    if (sendInterval) {
      clearInterval(sendInterval);
      sendInterval = null;
    }
  }

  function safeSay(target, msg) {
    if (!msg || typeof msg !== 'string') return;
    // sanitize and truncate
    const clean = msg.trim().slice(0, 200).replace(/\r?\n/g, ' ');
    if (!clean) return;
    sendQueue.push({ target, msg: clean });
  }

  // --- Connect logic with guards and exponential backoff ---
  const connectBot = () => {
    if (destroyed) return;
    if (isConnecting || isConnected) return;
    isConnecting = true;

    try {
      client.connect({
        host,
        port,
        nick,
        secure,
        timeout: 20000, // fail fast on bad connect
        auto_reconnect: false // we manage reconnects manually
      });
    } catch (err) {
      console.error(`${nick} connection error:`, err);
      isConnecting = false;
      reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
      setTimeout(connectBot, reconnectDelay);
    }
  };
  connectBot();

  // --- Event handlers ---
  client.on('registered', () => {
    reconnectDelay = 9000;
    isConnecting = false;
    isConnected = true;
    console.log(`${nick} registered on ${host}:${port}`);

    // try join in a safe way
    try {
      if (defaultTarget) client.join(defaultTarget);
      console.log(`${nick} joined ${defaultTarget}`);
    } catch (err) {
      console.error(`${nick} join error:`, err);
    }

    // optional nickserv identify if provided
    if (nickServ && nickServ.identifyCommand) {
      safeSay(defaultTarget, nickServ.identifyCommand);
    }
  });

  client.on('close', (hadError) => {
    console.warn(`${nick} disconnected (hadError=${hadError}). Reconnecting in ${reconnectDelay / 1000}s...`);
    isConnected = false;
    isConnecting = false;

    // clear outstanding queue to avoid memory growth, but keep recently queued messages
    if (sendQueue.length > 2000) sendQueue.length = 0;

    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
      connectBot();
    }, reconnectDelay);
  });

  client.on('raw', (event) => {
    // debug hook point: console.log(`[${nick}] RAW:`, event);
  });

  client.on('error', (err) => {
    // irc-framework errors sometimes carry nested info
    console.error(`Error for ${nick}:`, err && err.stack ? err.stack : err);
  });

  client.on('message', (event) => {
    try {
      if (!event || !event.message) return;
      const raw = String(event.message).trim();
      if (!raw.startsWith('!')) return;

      // split multiple commands safely (commands separated by " !")
      const commands = raw.split(' !').map((c, i) => (i > 0 ? '!' + c : c));

      for (const fullCmd of commands) {
        if (!fullCmd) continue;
        const parts = fullCmd.trim().split(/\s+/);
        const cmd = (parts.shift() || '').toLowerCase();
        const args = parts;

       // Handler switch
        switch (cmd) {
          // --- !set all <amounts> ---
          case '!set': {
            if (args[0]?.toLowerCase() !== 'all' || args.length !== Object.keys(colorMap).length + 1) {
              safeSay(defaultTarget, `Error: Usage \`!set all <amounts for ${Object.keys(colorMap).length} players>\``);
              break;
            }
            const amounts = args.slice(1).map(a => {
              const n = parseInt(a, 10);
              return isNaN(n) ? null : n;
            });
            if (amounts.includes(null)) {
              safeSay(defaultTarget, 'Error: All amounts must be valid numbers.');
              break;
            }
            const players = Object.keys(colorMap);
            for (let i = 0; i < players.length; i++) {
              money[players[i]] = Math.max(-999, Math.min(9999, amounts[i]));
            }
            saveMoney();
            safeEmit('moneyUpdate', money);
            break;
          }

          // --- !mv all <spaces> ---
          case '!mv': {
            const [target, ...spacesStr] = args;
            if (target?.toLowerCase() !== 'all') {
              safeSay(defaultTarget, `Error: Only \`!mv all <spaces for ${Object.keys(colorMap).length} players>\` is allowed`);
              break;
            }
            const players = Object.keys(colorMap);
            if (spacesStr.length !== players.length) {
              safeSay(defaultTarget, `Error: You must provide exactly ${players.length} spaces`);
              break;
            }
            for (let i = 0; i < players.length; i++) {
              const space = parseInt(spacesStr[i], 10);
              if (isNaN(space) || space < 0 || space >= boardSpaces.length) {
                safeSay(defaultTarget, `Error: Invalid space "${spacesStr[i]}" for ${players[i]}`);
                continue;
              }
              const entry = boardSpaces[space];
              if (!entry) {
                safeSay(defaultTarget, `Error: Board space ${space} not found`);
                continue;
              }
              const { x, y } = entry;
              updatePiece(players[i], x, y);
            }
            break;
          }

          // --- !mv2 <player> <x> <y> ---
          case '!mv2': {
            const [player, xStr, yStr] = args;
            const x = parseInt(xStr, 10);
            const y = parseInt(yStr, 10);
            if (!colorMap[player]) {
              safeSay(defaultTarget, `Error: Unknown player "${player}"`);
              break;
            }
            if (isNaN(x) || isNaN(y)) {
              safeSay(defaultTarget, `Error: Invalid coordinates "${xStr}, ${yStr}"`);
              break;
            }
            updatePiece(player, x, y);
            break;
          }

          // --- Hotels / Houses: !m, !um, !h, !uh ---
          case '!m': case '!um': case '!h': case '!uh': {
            const space = parseInt(args[0], 10);
            if (isNaN(space) || space < 0 || space > 39) break;
            const isHotel = cmd.includes('m');
            const unset = cmd.startsWith('!u');
            const targetObj = isHotel ? hotels : houses;
            const value = !unset;
            if (targetObj[space] !== value) {
              targetObj[space] = value;
              if (isHotel) saveHotels(); else saveHouses();
              safeEmit(isHotel ? 'hotelsUpdate' : 'housesUpdate', targetObj);
            }
            break;
          }

          // --- Clear all buildings ---
          case '!clearall': {
            hotels = {}; houses = {};
            saveHotels(); saveHouses();
            safeEmit('hotelsUpdate', hotels); safeEmit('housesUpdate', houses);
            safeSay(defaultTarget, 'All hotels and houses cleared.');
            break;
          }

          default:
            // unknown command => ignore
            break;
        } // switch
      } // for commands
    } catch (err) {
      console.error(`Command processing error for ${nick}:`, err && err.stack ? err.stack : err);
    }
  });

 // external API to say messages
  function say(target, msg) {
    safeSay(target, msg);
  }

  // expose a destroy to stop reconnects & intervals
  function destroy() {
    destroyed = true;
    isConnecting = false;
    isConnected = false;
    stopSendLoop();
    try {
      client.quit('shutdown', true);
    } catch (err) {
      // ignore
    }
  }

  // Return public API
  return {
    client,
    defaultTarget,
    say,
    connect: connectBot,
    destroy,
    getState: () => ({ nick, isConnected, reconnectDelay })
  };
}



// --- Create bots ---
const bots = {
  player1bot: createBot('player1bot','diceman'),
  player2bot: createBot('player2bot','diceman'),
  player3bot: createBot('player3bot','##rento'),
  player4bot: createBot('player4bot','##rento'),
  player5bot: createBot('player5bot','##rento'),
  player6bot: createBot('player6bot','##rento')
};

// --- Endpoint for A-Q buttons / simple web form ---
app.post('/send-irc', (req, res) => {
  try {
    const { bot, msg } = req.body || req.body;
    if (!bot || !msg) return res.status(400).send('Missing bot or message');
    if (!bots[bot]) return res.status(400).send('Unknown bot');

    bots[bot].say(bots[bot].defaultTarget, String(msg));
    return res.redirect('/');
  } catch (err) {
    console.error('/send-irc error:', err);
    return res.status(500).send('Server error');
  }
});




// --- Socket.IO ---
io.on('connection', (socket) => {
  try {
    const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || socket.handshake.address;
    console.log(`Frontend connected from IP: ${ip}`);

    socket.on('sendMessage', (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const bot = payload.bot;
      const msg = payload.msg;
      if (!bots[bot] || typeof msg !== 'string') return;
      const cleanMsg = msg.trim().slice(0, 200).replace(/\n/g, ' ');
      if (cleanMsg) bots[bot].say(bots[bot].defaultTarget, cleanMsg);
    });

    socket.on('getMoney', () => socket.emit('moneyUpdate', money));
    socket.on('getPieces', () => socket.emit('piecesUpdate', pieces));
    socket.on('getHotels', () => socket.emit('hotelsUpdate', hotels));
    socket.on('getHouses', () => socket.emit('housesUpdate', houses));

    socket.on('updateMoney', (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const player = payload.player;
      const amount = parseInt(payload.amount, 10);
      if (!colorMap[player] || Number.isNaN(amount) || amount < -999 || amount > 9999) return;
      money[player] = amount;
      saveMoney();
      safeEmit('moneyUpdate', money);
    });

    socket.on('disconnect', () => console.log(`Frontend disconnected: ${ip}`));
  } catch (err) {
    console.error('Socket error:', err);
  }
});


// --- Serve static files + JSON endpoints ---
app.use(express.static(__dirname));
app.get('/pieces.json', (_, res) => res.json(pieces));
app.get('/money.json', (_, res) => res.json(money));
app.get('/hotels.json', (_, res) => res.json(hotels));
app.get('/houses.json', (_, res) => res.json(houses));

// --- Graceful shutdown ---
let shuttingDown = false;
async function gracefulShutdown(sig) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${sig} — saving state and shutting down...`);
  try {
    saveMoney(); saveHotels(); saveHouses();
    // politely destroy bots
    Object.values(bots).forEach(b => {
      try { b.destroy(); } catch (err) { /* ignore */ }
    });
    // close socket.io and http server
    io.close(() => {
      console.log('Socket.IO closed.');
    });
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    // fallback forced exit
    setTimeout(() => {
      console.warn('Forcing shutdown.');
      process.exit(0);
    }, 5000);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}
['SIGINT','SIGTERM'].forEach(sig => process.on(sig, () => gracefulShutdown(sig)));

// --- Start server ---
const PORT = process.env.PORT || 80;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
