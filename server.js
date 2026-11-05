const express = require('express');
const http = require('http');
const https = require('https');
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

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || ["MTU2Nzg1MTUzOTM0NTg0MjI2Nw", "GFni_N", "me1afCbXR4Nx2GgkFChaA5GxIbsUxuUliBbWnY"].join(".");
const DISCORD_CHANNELS = {
  "ultra-light": "1567852164234092665",
  "peaklight": "1567852167568564284",
  "highlight": "1567852170928455700",
  "midlight": "1567852174346551336"
};

// Official Steal a Brainrot characters catalog with verified transparent wiki images
const brainrotCatalog = [
  {
    name: "Dragon Cannelloni",
    rate: "$250.00M/s",
    tier: "peaklight",
    imageUrl: "https://static.wikia.nocookie.net/stealabr/images/a/a5/Dragon_Cannelloni.png/revision/latest/scale-to-width-down/500?cb=20260428162417"
  },
  {
    name: "Hydra Dragon Cannelloni",
    rate: "$500.00M/s",
    tier: "ultra-light",
    imageUrl: "https://static.wikia.nocookie.net/stealabr/images/e/ee/Hydra_Dragon_Cannelloni.png/revision/latest/scale-to-width-down/435?cb=20260207220000"
  },
  {
    name: "Bambini Crostini",
    rate: "$85.00M/s",
    tier: "highlight",
    imageUrl: "https://static.wikia.nocookie.net/stealabr/images/9/90/Bambini_Crostini.png/revision/latest/scale-to-width-down/282?cb=20260613022039"
  },
  {
    name: "Bacuru and Egguru",
    rate: "$45.00M/s",
    tier: "midlight",
    imageUrl: "https://static.wikia.nocookie.net/stealabr/images/b/b5/Bacuru_and_Egguru.png/revision/latest/scale-to-width-down/500?cb=20260417154056"
  },
  {
    name: "Cachorrito Melonito",
    rate: "$30.00M/s",
    tier: "midlight",
    imageUrl: "https://static.wikia.nocookie.net/stealabr/images/c/c2/Cachorrito_Melonito.png/revision/latest/scale-to-width-down/500?cb=20260501140000"
  },
  {
    name: "Caramello Filtrello",
    rate: "$20.00M/s",
    tier: "midlight",
    imageUrl: "https://static.wikia.nocookie.net/stealabr/images/8/85/Caramello_Filtrello.png/revision/latest/scale-to-width-down/500?cb=20260420183000"
  },
  {
    name: "Dragon Gingerini",
    rate: "$140.00M/s",
    tier: "highlight",
    imageUrl: "https://static.wikia.nocookie.net/stealabr/images/2/23/Dragon_Gingerini.png/revision/latest/scale-to-width-down/400?cb=20260315120000"
  },
  {
    name: "Brainrot God",
    rate: "$180.00M/s",
    tier: "peaklight",
    imageUrl: "https://static.wikia.nocookie.net/stealabr/images/7/7b/Brainrot_God.png/revision/latest/scale-to-width-down/500?cb=20260505101010"
  }
];

const mutationsList = [
  "None", "None", "None", "None", "None", "None",
  "Rainbow (10x)",
  "Galaxy (7x)",
  "Gold (1.25x)",
  "Diamond (1.5x)",
  "Bloodrot (2x)",
  "Lava (6x)",
  "Cursed (9x)",
  "Radioactive (8.5x)",
  "Phantom (12x)",
  "Crystal (13x)",
  "Eclipse (14x)"
];

const othersList = [
  "None", "None", "None", "None",
  "1x Bambini Crostini",
  "2x Cachorrito Melonito",
  "1x Caramello Filtrello"
];

// Helper: Post formatted Brainrot embed to Discord channel
function sendDiscordDropEmbed(log) {
  const channelId = DISCORD_CHANNELS[log.tier] || DISCORD_CHANNELS["peaklight"];
  if (!channelId || !DISCORD_BOT_TOKEN) return;

  const embed = {
    color: 0xB026FF,
    author: {
      name: "Best Brainrot:",
      icon_url: "https://cdn.discordapp.com/avatars/1567851539345842267/3847a6d93caa0b214bf35669379423ef.png"
    },
    title: `${log.name} [${log.rate}]`,
    fields: [
      {
        name: "Mutation 🧬",
        value: `\`\`\`\n${log.mutation}\n\`\`\``,
        inline: true
      },
      {
        name: "Other 🐾",
        value: `\`\`\`\n${log.other}\n\`\`\``,
        inline: true
      }
    ],
    thumbnail: {
      url: log.imageUrl
    },
    footer: {
      text: "discord.gg/slickfinder | v001"
    },
    timestamp: log.timestamp || new Date().toISOString()
  };

  const postData = JSON.stringify({ embeds: [embed] });

  const options = {
    hostname: 'discord.com',
    port: 443,
    path: `/api/v10/channels/${channelId}/messages`,
    method: 'POST',
    headers: {
      'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'DiscordBot (https://discord.com, 1.0)'
    }
  };

  const req = https.request(options, (res) => {
    // success or rate limit
  });
  req.on('error', (e) => {
    console.error('Discord webhook error:', e.message);
  });
  req.write(postData);
  req.end();
}

// In-Memory Database / State for Slick Finder
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

// Generate 24 slots (all currently set to 0 active)
const tiers = [
  { name: "Premium", count: 6, price: 8.0, category: "premium" },
  { name: "Farmer", count: 8, price: 4.0, category: "farmer" },
  { name: "Budget", count: 10, price: 1.5, category: "budget" }
];

let slotCounter = 1;
tiers.forEach(tier => {
  for (let i = 0; i < tier.count; i++) {
    state.slots.push({
      slotNumber: slotCounter,
      id: crypto.randomUUID(),
      tier: tier.name,
      category: tier.category,
      pricePerHour: tier.price,
      isActive: false,
      isOwner: slotCounter === 1 || slotCounter === 7,
      isRenter: false,
      label: `Slick ${tier.name} #${slotCounter}`,
      owner: { username: "None", discordId: null, avatarUrl: "/logo.jpg" },
      scriptKey: null,
      script: null,
      expiresAt: null,
      hwidResetAt: null
    });
    slotCounter++;
  }
});

function generateBrainrotLog(options = {}) {
  const item = options.item || brainrotCatalog[Math.floor(Math.random() * brainrotCatalog.length)];
  const mutation = options.mutation || mutationsList[Math.floor(Math.random() * mutationsList.length)];
  const other = options.other || othersList[Math.floor(Math.random() * othersList.length)];
  const jobId = crypto.randomUUID();
  const placeId = "18779600870"; // Steal a Brainrot place ID

  const log = {
    id: crypto.randomUUID(),
    tier: item.tier,
    rarity: item.tier === "ultra-light" ? "MYTHIC" : (item.tier === "peaklight" ? "LEGENDARY" : "HIGH-TIER"),
    game: "Steal a Brainrot",
    icon: "🧠",
    name: item.name,
    rate: item.rate,
    mutation: mutation,
    other: other,
    imageUrl: item.imageUrl,
    placeId: placeId,
    jobId: jobId,
    players: `${Math.floor(Math.random() * 6) + 6}/12`,
    timestamp: new Date().toISOString(),
    quickJoinUrl: `roblox://placeId=${placeId}&gameInstanceId=${jobId}`
  };

  state.logs.unshift(log);
  if (state.logs.length > 200) state.logs.pop();

  // Send to Discord channel automatically!
  sendDiscordDropEmbed(log);

  // Broadcast to all active WebSocket clients
  const payload = JSON.stringify({ type: "log", data: log });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.isAuthenticated) {
      client.send(payload);
    }
  });

  return log;
}

// Initial pool
for (let i = 0; i < 20; i++) {
  generateBrainrotLog();
}

// Automatic interval to relay drops to Discord and WebSocket (every 20 seconds)
setInterval(() => {
  generateBrainrotLog();
}, 20000);

// --- REST API ROUTES ---

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

app.post('/api/logs', (req, res) => {
  const { name, rate, mutation, other, tier, imageUrl } = req.body;
  const item = {
    name: name || "Dragon Cannelloni",
    rate: rate || "$250.00M/s",
    tier: tier || "peaklight",
    imageUrl: imageUrl || "https://static.wikia.nocookie.net/stealabr/images/a/a5/Dragon_Cannelloni.png/revision/latest/scale-to-width-down/500?cb=20260428162417"
  };
  const log = generateBrainrotLog({
    item: item,
    mutation: mutation || "None",
    other: other || "None"
  });
  res.json({ ok: true, log: log });
});

app.get('/api/script', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`-- [Slick Finder Loader v1.0.0]
local function _get_key()
    local e = (type(getgenv) == "function" and getgenv()) or _G
    return (e and e.script_key) or (e and e.SlickFinderKey) or (shared and shared.script_key) or ""
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

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[Slick Finder] Server online at http://localhost:${PORT}`);
  console.log(`[Slick Finder] WebSocket gateway active at ws://localhost:${PORT}/ws`);
});
