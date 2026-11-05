const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Database / State for Drip Finder
const state = {
  user: {
    username: "dick1337",
    globalName: "dick1337",
    discordId: "1564713417527394446",
    avatarUrl: "/logo.jpg",
    balance: 2.00,
    isAdmin: true
  },
  settings: {
    slotsPaused: false,
    wsStatus: "ONLINE",
    totalSlots: 24,
    activeSlots: 18
  },
  slots: [],
  logs: [],
  invoices: []
};

// Generate 24 slots (6 Premium, 8 Farmer, 10 Budget)
const tiers = [
  { name: "Premium", count: 6, price: 8.0, category: "premium" },
  { name: "Farmer", count: 8, price: 4.0, category: "farmer" },
  { name: "Budget", count: 10, price: 1.5, category: "budget" }
];

let slotCounter = 1;
tiers.forEach(tier => {
  for (let i = 0; i < tier.count; i++) {
    const isOwner = slotCounter === 1 || slotCounter === 7;
    const isRented = slotCounter === 3;
    const isActive = Math.random() > 0.25;

    state.slots.push({
      slotNumber: slotCounter,
      id: crypto.randomUUID(),
      tier: tier.name,
      category: tier.category,
      pricePerHour: tier.price,
      isActive: isActive,
      isOwner: isOwner,
      isRenter: isRented,
      label: `Drip ${tier.name} #${slotCounter}`,
      owner: isOwner ? { username: state.user.username, discordId: state.user.discordId, avatarUrl: state.user.avatarUrl } : { username: `trader_${Math.floor(1000 + Math.random()*9000)}`, discordId: "100000000000000000" },
      scriptKey: isOwner ? `DRIP_${crypto.randomBytes(12).toString('hex').toUpperCase()}` : null,
      script: isOwner ? `getgenv().script_key="${crypto.randomBytes(12).toString('hex').toUpperCase()}";loadstring(game:HttpGet("https://dripfinder.net/api/script"))()` : null,
      expiresAt: isActive ? new Date(Date.now() + (Math.random() * 4 + 1) * 3600000).toISOString() : null,
      hwidResetAt: null
    });
    slotCounter++;
  }
});

// Mock Initial Drops / Logs Generator
const sampleGames = [
  { name: "Blox Fruits", placeId: "2753915549", icon: "⚔️" },
  { name: "Pet Simulator 99", placeId: "8737899170", icon: "🐾" },
  { name: "Murder Mystery 2", placeId: "142823291", icon: "🔪" },
  { name: "Da Hood", placeId: "2788229376", icon: "💰" },
  { name: "Adopt Me!", placeId: "920587237", icon: "🐶" }
];

const tiersList = ["ultra-light", "peaklight", "highlight", "midlight"];
const rarityList = ["MYTHIC", "LEGENDARY", "RARE", "EPIC"];

function generateLog() {
  const game = sampleGames[Math.floor(Math.random() * sampleGames.length)];
  const tier = tiersList[Math.floor(Math.random() * tiersList.length)];
  const rarity = rarityList[Math.floor(Math.random() * rarityList.length)];
  const jobId = crypto.randomUUID();
  const players = Math.floor(Math.random() * 8) + 4;
  const maxPlayers = 12;

  const log = {
    id: crypto.randomUUID(),
    tier: tier,
    rarity: rarity,
    game: game.name,
    icon: game.icon,
    placeId: game.placeId,
    jobId: jobId,
    players: `${players}/${maxPlayers}`,
    timestamp: new Date().toISOString(),
    details: `High-value target drop detected in server. Ping: ${Math.floor(Math.random()*20 + 8)}ms`,
    quickJoinUrl: `roblox://placeId=${game.placeId}&gameInstanceId=${jobId}`
  };

  state.logs.unshift(log);
  if (state.logs.length > 200) state.logs.pop();

  // Broadcast to all active WebSocket clients
  const payload = JSON.stringify({ type: "log", data: log });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.isAuthenticated) {
      client.send(payload);
    }
  });

  return log;
}

// Generate an initial pool of logs
for (let i = 0; i < 25; i++) {
  generateLog();
}

// Generate realistic logs periodically every 4-8 seconds
setInterval(() => {
  generateLog();
}, 5000);

// --- REST API ROUTES ---

// 1. Auth Profile
app.get('/api/auth/me', (req, res) => {
  res.json({ ok: true, user: state.user });
});

// 2. Full State
app.get('/api/state', (req, res) => {
  res.json({
    ok: true,
    state: {
      user: state.user,
      settings: state.settings,
      balance: state.user.balance,
      slots: state.slots,
      logsCount: state.logs.length,
      invoices: state.invoices
    }
  });
});

// 3. Logs Query
app.get('/api/logs', (req, res) => {
  const tier = req.query.tier;
  let filtered = state.logs;
  if (tier && tier !== 'all') {
    filtered = filtered.filter(l => l.tier === tier);
  }
  res.json({ ok: true, count: filtered.length, logs: filtered.slice(0, 50) });
});

// 4. Script Loader
app.get('/api/script', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`-- [Drip Finder Loader v1.0.0]
local function _get_key()
    local e = (type(getgenv) == "function" and getgenv()) or _G
    return (e and e.script_key) or (e and e.DripFinderKey) or (shared and shared.script_key) or ""
end

local key = _get_key()
print("[Drip Finder] Authenticating key: " .. tostring(key))
print("[Drip Finder] Connecting to wss://" .. "dripfinder.net/ws ...")
print("[Drip Finder] WebSocket Session Verified. Auto-Joiner Ready.")
`);
});

// 5. Deposit Invoice
app.post('/api/wallet/deposit', (req, res) => {
  const { amountUsd, asset } = req.body;
  const invoice = {
    id: crypto.randomUUID(),
    amountUsd: Number(amountUsd) || 5.0,
    asset: asset || "LTC",
    address: "MGwDNH7hSDZH6gZf8M8KQj8647oCJM7Axi",
    status: "pending",
    createdAt: new Date().toISOString()
  };
  state.invoices.unshift(invoice);
  res.json({ ok: true, invoice });
});

// 6. Reset HWID
app.post('/api/slots/hwid', (req, res) => {
  const { slotNumber } = req.body;
  const slot = state.slots.find(s => s.slotNumber === slotNumber);
  if (!slot) return res.status(404).json({ ok: false, message: "Slot not found" });
  slot.hwidResetAt = new Date().toISOString();
  res.json({ ok: true, message: "HWID successfully reset. New session authorized." });
});

// --- WEBSOCKET GATEWAY (/ws) ---
wss.on('connection', (ws) => {
  const nonce = crypto.randomBytes(24).toString('hex');
  ws.isAuthenticated = true; // Auto-verify for demo/connected clients

  // Send initial challenge
  ws.send(JSON.stringify({
    type: "challenge",
    nonce: nonce,
    algorithm: "HMAC-SHA256-v1",
    serverTime: Math.floor(Date.now() / 1000)
  }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "auth" || data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", status: "authenticated" }));
      }
    } catch (e) {}
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[Drip Finder] Server running at http://localhost:${PORT}`);
  console.log(`[Drip Finder] WebSocket gateway active at ws://localhost:${PORT}/ws`);
});
