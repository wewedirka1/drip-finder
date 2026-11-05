let appState = {
  user: null,
  slots: [],
  logs: [],
  marketListings: [],
  leaderboard: [],
  currentView: 'home',
  currentSlotFilter: 'all',
  currentLogFilter: 'all'
};

let ws = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  await loadState();
  initWebSocket();
  startTimers();
});

// Load full state from backend
async function loadState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    if (data.ok) {
      appState.user = data.state.user;
      appState.slots = data.state.slots;
      appState.marketListings = data.state.marketListings || [];
      appState.leaderboard = data.state.leaderboard || [];

      // Update Sidebar UI
      document.getElementById('sidebar-username').innerText = appState.user.username;
      document.getElementById('sidebar-balance').innerText = `$${appState.user.balance.toFixed(2)}`;

      const activeCount = appState.slots.filter(s => s.isActive).length;
      document.getElementById('stat-slots-count').innerText = activeCount;

      renderSlots();
      renderMarketplace();
      renderLeaderboard();
    }
  } catch (err) {
    console.error('Failed to load state:', err);
  }

  // Fetch initial logs pool
  await fetchLogs();
}

// WebSocket connection for real-time drop radar
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS] Connected to Drip Gateway');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'log') {
          handleIncomingLog(msg.data);
        } else if (msg.type === 'challenge') {
          ws.send(JSON.stringify({ type: 'auth', response: 'ok' }));
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected. Reconnecting in 3s...');
      setTimeout(initWebSocket, 3000);
    };
  } catch (err) {
    console.warn('[WS] Gateway connection error:', err);
  }
}

// Fetch initial logs from REST
async function fetchLogs() {
  try {
    const res = await fetch(`/api/logs?tier=${appState.currentLogFilter}`);
    const data = await res.json();
    if (data.ok) {
      appState.logs = data.logs;
      renderLogs();
      renderHomeDrops();
    }
  } catch (e) {
    console.error('Failed to fetch logs:', e);
  }
}

// Handle real-time incoming log
function handleIncomingLog(log) {
  appState.logs.unshift(log);
  if (appState.logs.length > 100) appState.logs.pop();

  // If on Radar view, prepend
  if (appState.currentLogFilter === 'all' || appState.currentLogFilter === log.tier) {
    const container = document.getElementById('radar-feed-list');
    if (container) {
      const card = createLogCard(log);
      card.classList.add('border-[#c8ff3d]');
      container.prepend(card);
      setTimeout(() => card.classList.remove('border-[#c8ff3d]'), 2000);
    }
  }

  renderHomeDrops();
}

// Render 24 Slots Grid (Swag Style)
function renderSlots() {
  const grid = document.getElementById('slots-grid');
  if (!grid) return;

  const filtered = appState.slots.filter(s => {
    if (appState.currentSlotFilter === 'all') return true;
    return s.category === appState.currentSlotFilter;
  });

  grid.innerHTML = '';
  filtered.forEach(slot => {
    const card = document.createElement('div');
    card.className = "swag-card p-4 flex flex-col justify-between space-y-4";

    let tierBadge = "";
    if (slot.category === 'premium') {
      tierBadge = '<span class="text-[10px] font-bold font-mono px-2 py-0.5 rounded-[6px] bg-[#c8ff3d]/10 text-[#c8ff3d] border border-[#c8ff3d]/25">💎 PREMIUM</span>';
    } else if (slot.category === 'farmer') {
      tierBadge = '<span class="text-[10px] font-bold font-mono px-2 py-0.5 rounded-[6px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">🌾 FARMER</span>';
    } else {
      tierBadge = '<span class="text-[10px] font-bold font-mono px-2 py-0.5 rounded-[6px] bg-amber-500/10 text-amber-400 border border-amber-500/25">⚡ BUDGET</span>';
    }

    const statusDot = slot.isActive 
      ? '<span class="flex items-center gap-1.5 text-xs text-emerald-400 font-mono"><span class="w-2 h-2 rounded-full bg-[#c8ff3d] pulse-green"></span> Active</span>'
      : '<span class="flex items-center gap-1.5 text-xs text-zinc-500 font-mono"><span class="w-2 h-2 rounded-full bg-zinc-700"></span> Expired</span>';

    // Countdown mock
    const remainingText = slot.isActive ? 'Expires in ~2h 15m' : 'Available for purchase';

    card.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="font-mono font-black text-sm text-white">#${slot.slotNumber}</span>
          ${tierBadge}
        </div>

        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="text-zinc-500 font-mono">RATE</span>
            <span class="text-white font-mono font-bold">$${slot.pricePerHour.toFixed(1)}/hr</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-zinc-500 font-mono">STATUS</span>
            ${statusDot}
          </div>
        </div>

        <div class="p-2.5 rounded-[9px] bg-[#16161a] border border-[#23232b] text-[11px] font-mono flex items-center justify-between">
          <span class="text-zinc-400 truncate w-32">${slot.owner.username}</span>
          <span class="text-zinc-500">${slot.isOwner ? '👑 Yours' : 'Occupied'}</span>
        </div>
      </div>

      <div class="pt-2 border-t border-[#1c1c22]">
        ${slot.isOwner ? `
          <div class="flex items-center gap-1.5">
            <button onclick="copyToClipboard('${slot.scriptKey}', 'Script Key copied!')" class="flex-1 py-1.5 swag-btn-primary text-xs font-bold rounded-[8px]">
              Copy Key
            </button>
            <button onclick="copyToClipboard('${slot.script}', 'Loader script copied!')" class="px-2.5 py-1.5 bg-[#1a1a22] hover:bg-[#252530] border border-zinc-700 text-xs text-zinc-300 rounded-[8px]" title="Copy Loader">
              📜
            </button>
          </div>
        ` : `
          <button onclick="openDepositModal()" class="w-full py-1.5 bg-[#181820] hover:bg-[#20202c] border border-[#272734] text-zinc-200 text-xs font-semibold rounded-[8px] transition">
            Rent Slot · $${slot.pricePerHour.toFixed(1)}/h
          </button>
        `}
      </div>
    `;
    grid.appendChild(card);
  });
}

// Render Marketplace Listings
function renderMarketplace() {
  const container = document.getElementById('market-listings-grid');
  if (!container) return;

  container.innerHTML = '';
  appState.marketListings.forEach(item => {
    const card = document.createElement('div');
    card.className = "swag-card p-5 space-y-4 flex flex-col justify-between";
    card.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono font-bold text-white uppercase">${item.slotName}</span>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-[#c8ff3d]/10 text-[#c8ff3d] border border-[#c8ff3d]/20">RENTAL</span>
        </div>

        <div class="flex items-center gap-2.5">
          <img src="${item.ownerAvatarUrl}" class="w-8 h-8 rounded-full border border-zinc-700">
          <div>
            <span class="text-xs font-bold text-white block">${item.ownerUsername}</span>
            <span class="text-[10px] text-zinc-500 font-mono">${item.availableMinutes} mins available</span>
          </div>
        </div>

        <div class="p-3 rounded-[10px] bg-[#15151a] border border-[#22222a] flex items-center justify-between font-mono">
          <span class="text-xs text-zinc-400">Total Price:</span>
          <span class="text-sm font-black text-[#c8ff3d]">$${item.price.toFixed(2)}</span>
        </div>
      </div>

      <button onclick="rentMarketListing('${item.id}', ${item.price})" class="w-full py-2 rounded-[9px] swag-btn-primary text-xs font-bold ${item.booked ? 'opacity-40 cursor-not-allowed' : ''}" ${item.booked ? 'disabled' : ''}>
        ${item.booked ? 'Already Booked' : 'Rent Now · Instant'}
      </button>
    `;
    container.appendChild(card);
  });
}

// Rent Market Item Action
async function rentMarketListing(listingId, price) {
  if (appState.user.balance < price) {
    showToast("Insufficient balance! Please deposit first.");
    openDepositModal();
    return;
  }

  try {
    const res = await fetch('/api/market/rent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId })
    });
    const data = await res.json();
    if (data.ok) {
      showToast(data.message);
      appState.user.balance = data.balance;
      document.getElementById('sidebar-balance').innerText = `$${data.balance.toFixed(2)}`;
      await loadState();
    } else {
      showToast(data.message);
    }
  } catch (e) {
    showToast("Failed to rent");
  }
}

// Render Leaderboard
function renderLeaderboard() {
  const tbody = document.getElementById('leaderboard-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  appState.leaderboard.forEach(user => {
    let medal = `#${user.rank}`;
    if (user.rank === 1) medal = "🥇 1st";
    else if (user.rank === 2) medal = "🥈 2nd";
    else if (user.rank === 3) medal = "🥉 3rd";

    const tr = document.createElement('tr');
    tr.className = "hover:bg-[#15151c] transition";
    tr.innerHTML = `
      <td class="py-3 px-4 font-bold text-white">${medal}</td>
      <td class="py-3 px-4 flex items-center gap-2.5">
        <img src="${user.avatarUrl}" class="w-6 h-6 rounded-full border border-zinc-700">
        <span class="font-bold text-zinc-200">${user.username}</span>
      </td>
      <td class="py-3 px-4 text-zinc-300 font-mono">${user.hours} hrs</td>
      <td class="py-3 px-4 text-[#c8ff3d] font-mono font-bold">${user.dropsCount} drops</td>
      <td class="py-3 px-4 text-right">
        <span class="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] border border-zinc-700">TOP SNIPER</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Home Live Drops Preview
function renderHomeDrops() {
  const container = document.getElementById('home-drops-feed');
  if (!container) return;

  container.innerHTML = '';
  appState.logs.slice(0, 6).forEach(log => {
    const card = document.createElement('div');
    card.className = "p-3 rounded-[10px] bg-[#16161b] border border-[#222228] flex items-center justify-between";
    card.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="text-xl">${log.icon}</span>
        <div>
          <span class="text-xs font-bold text-white block">${log.game}</span>
          <span class="text-[10px] font-mono text-[#c8ff3d]">${log.rarity} · ${log.players}</span>
        </div>
      </div>
      <a href="${log.quickJoinUrl}" class="px-3 py-1 rounded-[7px] swag-btn-primary text-xs font-bold">
        Join
      </a>
    `;
    container.appendChild(card);
  });
}

// Render Full Logs
function renderLogs() {
  const container = document.getElementById('radar-feed-list');
  if (!container) return;

  container.innerHTML = '';
  appState.logs.forEach(log => {
    container.appendChild(createLogCard(log));
  });
}

// Create single log card element
function createLogCard(log) {
  const card = document.createElement('div');
  card.className = "swag-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition";

  let rarityBadge = "";
  if (log.rarity === 'MYTHIC') {
    rarityBadge = '<span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[6px] bg-rose-500/15 text-rose-400 border border-rose-500/30">MYTHIC</span>';
  } else if (log.rarity === 'LEGENDARY') {
    rarityBadge = '<span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[6px] bg-amber-500/15 text-amber-400 border border-amber-500/30">LEGENDARY</span>';
  } else {
    rarityBadge = '<span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[6px] bg-[#c8ff3d]/15 text-[#c8ff3d] border border-[#c8ff3d]/30">HIGH-TIER</span>';
  }

  card.innerHTML = `
    <div class="flex items-start md:items-center gap-3">
      <div class="w-10 h-10 rounded-[10px] bg-[#17171e] border border-[#272733] flex items-center justify-center text-xl shrink-0">
        ${log.icon}
      </div>
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm text-white">${log.game}</span>
          ${rarityBadge}
          <span class="text-[11px] text-zinc-500 font-mono hidden sm:inline">Players: ${log.players}</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <span class="cursor-pointer hover:text-white" onclick="copyToClipboard('${log.jobId}', 'Job ID copied!')">Job: ${log.jobId.substring(0, 14)}... 📋</span>
          <span class="text-zinc-600">•</span>
          <span>Target: <b class="text-zinc-300">${log.target}</b></span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button onclick="copyToClipboard('${log.jobId}', 'Job ID copied!')" class="px-3 py-1.5 rounded-[8px] bg-[#1a1a22] hover:bg-[#23232e] border border-zinc-700 text-xs font-mono text-zinc-300 transition">
        Copy Job
      </button>
      <a href="${log.quickJoinUrl}" class="px-4 py-1.5 rounded-[8px] swag-btn-primary text-xs font-bold transition flex items-center gap-1">
        <span>🚀 Instant Join</span>
      </a>
    </div>
  `;
  return card;
}

// Navigation View Switcher (SPA)
function navigateTo(viewName) {
  appState.currentView = viewName;

  document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden'));
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.remove('hidden');

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('bg-[#1a1a1f]', 'text-[#c8ff3d]', 'font-semibold');
    link.classList.add('text-zinc-400');
  });

  const activeLink = document.getElementById(`nav-${viewName}`);
  if (activeLink) {
    activeLink.classList.remove('text-zinc-400');
    activeLink.classList.add('bg-[#1a1a1f]', 'text-[#c8ff3d]', 'font-semibold');
  }

  document.getElementById('breadcrumb-title').innerText = viewName;
  lucide.createIcons();
}

// Filters
function filterSlots(category) {
  appState.currentSlotFilter = category;
  document.querySelectorAll('.slot-tab-btn').forEach(btn => {
    btn.classList.remove('bg-[#1e1e26]', 'text-[#c8ff3d]', 'font-bold');
    btn.classList.add('text-zinc-400');
  });
  event.target.classList.remove('text-zinc-400');
  event.target.classList.add('bg-[#1e1e26]', 'text-[#c8ff3d]', 'font-bold');
  renderSlots();
}

function filterLogs(tier) {
  appState.currentLogFilter = tier;
  document.querySelectorAll('.log-tab-btn').forEach(btn => {
    btn.classList.remove('bg-[#1e1e26]', 'text-[#c8ff3d]', 'font-bold');
    btn.classList.add('text-zinc-400');
  });
  event.target.classList.remove('text-zinc-400');
  event.target.classList.add('bg-[#1e1e26]', 'text-[#c8ff3d]', 'font-bold');
  fetchLogs();
}

// Modals
function openDepositModal() {
  document.getElementById('deposit-modal').classList.remove('hidden');
}

function closeDepositModal() {
  document.getElementById('deposit-modal').classList.add('hidden');
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('hidden');
}

// Copy & Toast Helpers
function copyToClipboard(text, msg = "Copied to clipboard") {
  navigator.clipboard.writeText(text);
  showToast(msg);
}

function copyKey() {
  const key = document.getElementById('my-script-key').value;
  copyToClipboard(key, "Script Key copied!");
}

async function resetHwid() {
  try {
    const res = await fetch('/api/slots/hwid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotNumber: 1 })
    });
    const data = await res.json();
    showToast(data.message || "HWID Reset complete");
  } catch (e) {
    showToast("HWID Reset complete");
  }
}

function showToast(text) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').innerText = text;
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 2500);
}

function startTimers() {
  setInterval(() => {
    // updates countdown timers if any
  }, 60000);
}
