const API = `${window.API_BASE}/api`;
let username = localStorage.getItem('mc_user');

const qs = sel => document.querySelector(sel);

const headers = () => ({
  'Content-Type': 'application/json',
  'x-username': username
});

async function api(path, opts = {}) {
  opts.headers = { ...headers(), ...(opts.headers || {}) };
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) throw await res.text();
  return res.json();
}

async function loadState() {
  const state = await api('/state');
  qs('#money').textContent = state.money.toFixed(0);
  renderInventory(state);
  renderEquipped(state);
}

function renderInventory({ inventory }) {
  ['singles','albums'].forEach(type => {
    const container = qs(`#${type}List`);
    container.innerHTML = '';
    inventory[type].forEach(item => {
      const el = document.createElement('div');
      el.className = 'item';
      el.textContent = `${item.name} [1/${item.rarity}]`;
      el.onclick = () => api('/equip', {
        method:'POST',
        body: JSON.stringify({ type: type.slice(0,-1), itemId: item.id })
      }).then(loadState);
      container.appendChild(el);
    });
  });
}

function renderEquipped({ equipped }) {
  qs('#equippedSingles').innerHTML =
    equipped.singles.map(r => `[1/${r}]`).join(' ');
  qs('#equippedAlbums').innerHTML =
    equipped.albums.map(r => `[1/${r}]`).join(' ');
}

async function mintClick() {
  const item = await api('/click', { method:'POST' });
  alert(`You got a ${item.type}! ${item.name} (1/${item.rarity})`);
  loadState();
}

async function loadPacks() {
  const genres = await api('/packs');
  const container = qs('#packs');
  container.innerHTML = '';
  genres.forEach(g => {
    const btn = document.createElement('button');
    btn.textContent = g;
    btn.onclick = async () => {
      try {
        const items = await api('/buyPack', {
          method:'POST',
          body: JSON.stringify({ genre: g })
        });
        alert('Pack opened:\n' + items.map(i=>`${i.name} (1/${i.rarity})`).join('\n'));
        loadState();
      } catch(e) {
        alert(e);
      }
    };
    container.appendChild(btn);
  });
}

async function init() {
  if (!username) {
    qs('#login').style.display = 'block';
    qs('#btnLogin').onclick = async () => {
      username = qs('#username').value.trim();
      if (!username) return alert('pick a name');
      localStorage.setItem('mc_user', username);
      await api('/login', {
        method:'POST',
        body: JSON.stringify({ username })
      });
      startGame();
    };
  } else {
    startGame();
  }
}

function startGame() {
  qs('#login').style.display = 'none';
  qs('#game').style.display = 'block';
  qs('#logout').onclick = () => {
    localStorage.removeItem('mc_user');
    location.reload();
  };
  qs('#note').onclick = mintClick;
  loadState();
  loadPacks();
  // auto‑refresh every sec
  setInterval(loadState, 1000);
}

init();
