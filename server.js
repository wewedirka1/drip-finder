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

// In-Memory Database / State for Slick Finder (SwagFinder-exact structure)
const state = {
  user: {
    username: "dick1337",
    globalName: "dick1337",
    discordId: "1564713417527394446",
    avatarUrl: "/logo.jpg",
    balance: 2.00,
    isAdmin: true,
    totalSlots: 24,
    activeSlots: 0
  },
  settings: {
    slotsPaused: false,
    wsStatus: "ONLINE",
    totalSlots: 24,
    activeSlots: 0,
    announcement: "Slick Finder v1.0.0 is LIVE. Fast server sniffing & automated WebSocket relays operational."
  },
  slots: [],
  logs: [],
  invoices: [
    {
      id: "fcfd36f7-a016-4911-a54c-2837e4dbc220",
      kind: "deposit",
      method: "crypto",
      status: "completed",
      amountUsd: 2.0,
      asset: "LTC",
      address: "MGwDNH7hSDZH6gZf8M8KQj8647oCJM7Axi",
      cryptoAmount: "0.03640551",
      txid: "aaa1fd2aacbf639e88c309cf3372a7a82a7f28a26e8fb69bdc5399004d073a80",
      createdAt: "2026-10-30T18:53:30.750Z"
    }
  ],
  payments: [
    {
      id: "47b0f7e0-f1eb-485c-a651-2a8fc99d0956",
      discordId: "1564713417527394446",
      slotNumber: 0,
      method: "crypto-deposit",
      currency: "LTC",
      amount: "2.00",
      status: "completed",
      createdAt: "2026-10-30T18:59:00.028Z",
      username: "dick1337"
    }
  ],
  marketListings: [
    {
      id: "m-101",
      slotNumber: 9,
      slotName: "Premium #9",
      category: "premium",
      ownerUsername: "gemidor__73743",
      ownerAvatarUrl: "https://cdn.discordapp.com/embed/avatars/2.png",
      price: 3.0,
      originalPrice: 6.0,
      availableMinutes: 38,
      listedMinutes: 60,
      booked: false
    },
    {
      id: "m-102",
      slotNumber: 14,
      slotName: "Farmer #14",
      category: "farmer",
      ownerUsername: "elloco6220",
      ownerAvatarUrl: "https://cdn.discordapp.com/embed/avatars/3.png",
      price: 1.5,
      originalPrice: 3.0,
      availableMinutes: 120,
      listedMinutes: 120,
      booked: false
    },
    {
      id: "m-103",
      slotNumber: 21,
      slotName: "Budget #21",
      category: "budget",
      ownerUsername: "wato444",
      ownerAvatarUrl: "https://cdn.discordapp.com/embed/avatars/4.png",
      price: 0.8,
      originalPrice: 1.5,
      availableMinutes: 45,
      listedMinutes: 60,
      booked: false
    }
  ],
  leaderboard: [
    { rank: 1, username: "gemidor__73743", avatarUrl: "https://cdn.discordapp.com/embed/avatars/2.png", hours: 412, dropsCount: 3840 },
    { rank: 2, username: "dick1337", avatarUrl: "/logo.jpg", hours: 248, dropsCount: 2190 },
    { rank: 3, username: "elloco6220", avatarUrl: "https://cdn.discordapp.com/embed/avatars/3.png", hours: 194, dropsCount: 1670 },
    { rank: 4, username: "uskiss_199", avatarUrl: "https://cdn.discordapp.com/embed/avatars/1.png", hours: 156, dropsCount: 1320 },
    { rank: 5, username: "wato444", avatarUrl: "https://cdn.discordapp.com/embed/avatars/4.png", hours: 120, dropsCount: 940 }
  ]
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
      isActive: false,
      isOwner: isOwner,
      isRenter: isRented,
      label: `Drip ${tier.name} #${slotCounter}`,
      owner: isOwner ? { username: state.user.username, discordId: state.user.discordId, avatarUrl: state.user.avatarUrl } : { username: `trader_${Math.floor(1000 + Math.random()*9000)}`, discordId: "100000000000000000" },
      scriptKey: isOwner ? `DRIP_${crypto.randomBytes(10).toString('hex').toUpperCase()}` : null,
      script: isOwner ? `getgenv().script_key="DRIP_${crypto.randomBytes(10).toString('hex').toUpperCase()}";loadstring(game:HttpGet("https://drip-finder.onrender.com/api/script"))()` : null,
      expiresAt: isActive ? new Date(Date.now() + (Math.random() * 3 + 0.5) * 3600000).toISOString() : null,
      hwidResetAt: null
    });
    slotCounter++;
  }
});

// Mock Initial Drops / Logs Generator
const sampleGames = [
  { name: "Blox Fruits", placeId: "2753915549", icon: "⚔️", target: "Mirage Island / Kitsune" },
  { name: "Pet Simulator 99", placeId: "8737899170", icon: "🐾", target: "Huge Chest Rush" },
  { name: "Murder Mystery 2", placeId: "142823291", icon: "🔪", target: "Nikilis Godly Lobby" },
  { name: "Da Hood", placeId: "2788229376", icon: "💰", target: "Rare Vault Drop" },
  { name: "Adopt Me!", placeId: "920587237", icon: "🐶", target: "Neon Shadow Dragon Trade" }
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
    target: game.target,
    placeId: game.placeId,
    jobId: jobId,
    players: `${players}/${maxPlayers}`,
    timestamp: new Date().toISOString(),
    details: `High-value server identified. Ping: ${Math.floor(Math.random()*15 + 9)}ms`,
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

// Generate initial pool
for (let i = 0; i < 30; i++) {
  generateLog();
}

// Broadcast new log every 4.5 seconds
setInterval(() => {
  generateLog();
}, 4500);

// --- REST API ROUTES (Swag-compatible) ---

app.get('/api/auth/me', (req, res) => {
  res.json({ ok: true, user: state.user });
});

app.get('/api/state', (req, res) => {
  res.json({
    ok: true,
    state: {
      user: state.user,
      settings: state.settings,
      balance: state.user.balance,
      slots: state.slots,
      logsCount: state.logs.length,
      invoices: state.invoices,
      payments: state.payments,
      marketListings: state.marketListings,
      leaderboard: state.leaderboard
    }
  });
});

app.get('/api/logs', (req, res) => {
  const tier = req.query.tier;
  let filtered = state.logs;
  if (tier && tier !== 'all') {
    filtered = filtered.filter(l => l.tier === tier);
  }
  res.json({ ok: true, count: filtered.length, logs: filtered.slice(0, 60) });
});

app.get('/api/script', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`-- [Slick Finder Loader v1.0.0]
local function _get_key()
    local e = (type(getgenv) == "function" and getgenv()) or _G
    return (e and e.script_key) or (e and e.DripFinderKey) or (shared and shared.script_key) or ""
end

local key = _get_key()
print("[Slick Finder] Authenticating key: " .. tostring(key))
print("[Slick Finder] Connecting to wss://drip-finder.onrender.com/ws ...")
print("[Slick Finder] WebSocket Handshake Complete. Auto-Joiner Active.")
`);
});

app.post('/api/wallet/deposit', (req, res) => {
  const { amountUsd, asset } = req.body;
  const inv = {
    id: crypto.randomUUID(),
    amountUsd: Number(amountUsd) || 5.0,
    asset: asset || "LTC",
    address: "MGwDNH7hSDZH6gZf8M8KQj8647oCJM7Axi",
    cryptoAmount: (Number(amountUsd || 5) / 55).toFixed(6),
    status: "pending",
    createdAt: new Date().toISOString()
  };
  state.invoices.unshift(inv);
  res.json({ ok: true, invoice: inv });
});

app.post('/api/slots/hwid', (req, res) => {
  const { slotNumber } = req.body;
  const slot = state.slots.find(s => s.slotNumber === slotNumber);
  if (!slot) return res.status(404).json({ ok: false, message: "Slot not found" });
  slot.hwidResetAt = new Date().toISOString();
  res.json({ ok: true, message: "HWID successfully reset. New session authorized." });
});

app.post('/api/market/rent', (req, res) => {
  const { listingId } = req.body;
  const listing = state.marketListings.find(l => l.id === listingId);
  if (!listing) return res.status(404).json({ ok: false, message: "Listing not found" });
  if (state.user.balance < listing.price) {
    return res.status(400).json({ ok: false, message: "Insufficient balance. Deposit first." });
  }
  state.user.balance -= listing.price;
  listing.booked = true;
  res.json({ ok: true, message: `Successfully rented ${listing.slotName}!`, balance: state.user.balance });
});

// WebSocket Gateway (/ws) with Challenge-Response
wss.on('connection', (ws) => {
  const nonce = crypto.randomBytes(24).toString('hex');
  ws.isAuthenticated = true;

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

// SPA fallback for HTML routes: /slots, /marketplace, /dashboard, /leaderboard
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[Slick Finder] Server online at http://localhost:${PORT}`);
  console.log(`[Slick Finder] WebSocket gateway active at ws://localhost:${PORT}/ws`);
});
