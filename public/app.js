let appState = {
  user: null,
  slots: [],
  logs: [],
  currentTab: 'dashboard',
  currentSlotFilter: 'all',
  currentLogFilter: 'all'
};

let ws = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  await loadState();
  initWebSocket();
});

// Load state from backend
async function loadState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    if (data.ok) {
      appState.user = data.state.user;
      appState.slots = data.state.slots;
      
      // Update UI elements
      document.getElementById('user-name').innerText = appState.user.username;
      document.getElementById('user-balance').innerText = `$${appState.user.balance.toFixed(2)}`;
      
      const activeCount = appState.slots.filter(s => s.isActive).length;
      document.getElementById('stat-active-slots').innerText = activeCount;

      renderSlots();
    }
  } catch (err) {
    console.error('Failed to load state:', err);
  }

  // Fetch initial logs
  await fetchLogs();
}

// Connect to live WebSocket
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
          // Respond to challenge
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

// Fetch logs from REST API
async function fetchLogs() {
  try {
    const res = await fetch(`/api/logs?tier=${appState.currentLogFilter}`);
    const data = await res.json();
    if (data.ok) {
      appState.logs = data.logs;
      renderLogs();
      renderDashboardLogs();
    }
  } catch (e) {
    console.error('Failed to fetch logs:', e);
  }
}

// Handle real-time incoming log over WebSocket
function handleIncomingLog(log) {
  appState.logs.unshift(log);
  if (appState.logs.length > 100) appState.logs.pop();

  if (appState.currentLogFilter === 'all' || appState.currentLogFilter === log.tier) {
    const container = document.getElementById('logs-container');
    if (container) {
      const card = createLogCard(log);
      card.classList.add('animate-pulse');
      container.prepend(card);
      setTimeout(() => card.classList.remove('animate-pulse'), 1500);
    }
  }
  renderDashboardLogs();
}

// Render 24 Slots Grid
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
    card.className = "bg-[#121217] border border-[#23232c] slot-glow rounded-xl p-4 flex flex-col justify-between space-y-4 transition";

    let tierBadge = "";
    if (slot.category === 'premium') tierBadge = '<span class="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">💎 PREMIUM</span>';
    else if (slot.category === 'farmer') tierBadge = '<span class="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">🌾 FARMER</span>';
    else tierBadge = '<span class="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">⚡ BUDGET</span>';

    const statusDot = slot.isActive 
      ? '<span class="flex items-center gap-1.5 text-xs text-emerald-400"><span class="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></span> Active</span>'
      : '<span class="flex items-center gap-1.5 text-xs text-zinc-500"><span class="w-2 h-2 rounded-full bg-zinc-600"></span> Idle</span>';

    card.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-mono font-bold text-sm text-white">#${slot.slotNumber}</span>
          ${tierBadge}
        </div>
        <div class="flex items-center justify-between pt-1">
          <span class="text-xs text-zinc-400">Rate: <b class="text-white font-mono">$${slot.pricePerHour.toFixed(1)}/h</b></span>
          ${statusDot}
        </div>
        <div class="pt-2 border-t border-[#1e1e26] text-xs flex items-center justify-between text-zinc-400">
          <span>Holder: <b class="text-zinc-200">${slot.owner.username}</b></span>
          <span class="font-mono text-[11px] text-zinc-500">${slot.isOwner ? 'Yours' : 'Occupied'}</span>
        </div>
      </div>

      <div class="pt-2 flex items-center gap-2">
        ${slot.isOwner ? `
          <button onclick="copyToClipboard('${slot.scriptKey}', 'Script Key copied!')" class="flex-1 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-lg transition">
            Copy Key
          </button>
          <button onclick="copyToClipboard('${slot.script}', 'Loader script copied!')" class="px-2.5 py-1.5 bg-[#1e1e28] hover:bg-[#282835] border border-zinc-700 text-xs text-zinc-300 rounded-lg transition" title="Copy Loader">
            📜
          </button>
        ` : `
          <button onclick="openDepositModal()" class="w-full py-1.5 bg-[#181822] hover:bg-[#222230] border border-[#2b2b3a] text-zinc-300 font-medium text-xs rounded-lg transition">
            Rent / Book
          </button>
        `}
      </div>
    `;
    grid.appendChild(card);
  });
}

// Render Live Logs
function renderLogs() {
  const container = document.getElementById('logs-container');
  if (!container) return;

  container.innerHTML = '';
  appState.logs.forEach(log => {
    container.appendChild(createLogCard(log));
  });
}

function renderDashboardLogs() {
  const container = document.getElementById('dashboard-recent-logs');
  if (!container) return;

  container.innerHTML = '';
  appState.logs.slice(0, 6).forEach(log => {
    const card = document.createElement('div');
    card.className = "bg-[#15151c] border border-[#23232c] p-3 rounded-xl flex items-center justify-between";
    card.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="text-lg">${log.icon}</span>
        <div>
          <span class="text-xs font-bold text-white block">${log.game}</span>
          <span class="text-[10px] font-mono text-cyan-400">${log.rarity}</span>
        </div>
      </div>
      <a href="${log.quickJoinUrl}" class="px-2.5 py-1 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 text-xs font-bold rounded-lg transition">
        Join
      </a>
    `;
    container.appendChild(card);
  });
}

// Create a single log card element
function createLogCard(log) {
  const card = document.createElement('div');
  card.className = "bg-[#121217] border border-[#22222b] hover:border-zinc-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition";

  let rarityColor = "bg-zinc-800 text-zinc-300";
  if (log.rarity === 'MYTHIC') rarityColor = "bg-rose-500/10 text-rose-400 border border-rose-500/30";
  else if (log.rarity === 'LEGENDARY') rarityColor = "bg-amber-500/10 text-amber-400 border border-amber-500/30";
  else if (log.rarity === 'EPIC') rarityColor = "bg-purple-500/10 text-purple-400 border border-purple-500/30";
  else rarityColor = "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30";

  card.innerHTML = `
    <div class="flex items-start md:items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-[#181822] border border-[#282836] flex items-center justify-center text-xl shrink-0">
        ${log.icon}
      </div>
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm text-white">${log.game}</span>
          <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded ${rarityColor}">${log.rarity}</span>
          <span class="text-[11px] text-zinc-500 font-mono hidden sm:inline">Players: ${log.players}</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <span class="cursor-pointer hover:text-white" onclick="copyToClipboard('${log.jobId}', 'Job ID copied!')">Job: ${log.jobId.substring(0, 14)}... 📋</span>
          <span class="text-zinc-600">•</span>
          <span>Place: ${log.placeId}</span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button onclick="copyToClipboard('${log.jobId}', 'Job ID copied!')" class="px-3 py-1.5 bg-[#181820] hover:bg-[#22222c] border border-zinc-700 text-xs font-mono text-zinc-300 rounded-lg transition">
        Copy Job
      </button>
      <a href="${log.quickJoinUrl}" class="px-4 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs rounded-lg transition flex items-center gap-1.5">
        <span>🚀 Instant Join</span>
      </a>
    </div>
  `;
  return card;
}

// Navigation Tab Switcher
function switchTab(tabName) {
  appState.currentTab = tabName;

  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(`tab-${tabName}`).classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('text-white', 'bg-[#22222d]');
    btn.classList.add('text-zinc-400');
  });

  const activeBtn = document.getElementById(`nav-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-zinc-400');
    activeBtn.classList.add('text-white', 'bg-[#22222d]');
  }

  lucide.createIcons();
}

// Filter Slots
function filterSlots(category) {
  appState.currentSlotFilter = category;
  document.querySelectorAll('.slot-filter-btn').forEach(btn => {
    btn.classList.remove('text-white', 'bg-[#22222f]');
    btn.classList.add('text-zinc-400');
  });
  event.target.classList.remove('text-zinc-400');
  event.target.classList.add('text-white', 'bg-[#22222f]');
  renderSlots();
}

// Filter Logs
function filterLogs(tier) {
  appState.currentLogFilter = tier;
  document.querySelectorAll('.log-filter-btn').forEach(btn => {
    btn.classList.remove('text-white', 'bg-[#20202c]');
    btn.classList.add('text-zinc-400');
  });
  event.target.classList.remove('text-zinc-400');
  event.target.classList.add('text-white', 'bg-[#20202c]');
  fetchLogs();
}

// Modals
function openDepositModal() {
  document.getElementById('deposit-modal').classList.remove('hidden');
}

function closeDepositModal() {
  document.getElementById('deposit-modal').classList.add('hidden');
}

// Copy Helper & Toast
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
    showToast(data.message || "HWID Reset successful");
  } catch (e) {
    showToast("HWID Reset completed");
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
