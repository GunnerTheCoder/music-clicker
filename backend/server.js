import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';

// ES‑module __dirname shim
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;
// Replace with your actual Vercel URL:
const FRONTEND_ORIGIN = 'https://music-clicker.vercel.app';

const DATA_DIR = path.join(__dirname, 'data');

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true
}));
app.use(express.json());

// ensure data folder exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// helper to load or create user file
function loadUser(username) {
  const file = path.join(DATA_DIR, username + '.json');
  let user;
  if (fs.existsSync(file)) {
    user = JSON.parse(fs.readFileSync(file));
  } else {
    user = {
      username,
      money: 0,
      inventory: { albums: [], singles: [] },
      equipped: { albums: [], singles: [] },
      lastUpdate: Date.now()
    };
    fs.writeFileSync(file, JSON.stringify(user, null, 2));
  }
  return { user, file };
}

function saveUser(file, user) {
  fs.writeFileSync(file, JSON.stringify(user, null, 2));
}

// compute offline earnings
function applyEarnings(user) {
  const now = Date.now();
  const secs = Math.floor((now - user.lastUpdate) / 1000);
  if (secs > 0) {
    const rate = [
      ...user.equipped.albums,
      ...user.equipped.singles
    ].reduce((sum, rarity) => sum + rarity / 10, 0);
    user.money += rate * secs;
    user.lastUpdate = now;
  }
}

// generate a new item
function generateItem(type, genre) {
  // rarity denominator between 10 and 200
  const tiers = [10, 20, 50, 100, 200];
  const rarity = tiers[Math.floor(Math.random() * tiers.length)];
  return {
    id: uuid(),
    type,
    genre,
    name: `${genre} ${type.charAt(0).toUpperCase() + type.slice(1)} #${Math.floor(Math.random() * 10000)}`,
    rarity
  };
}

const GENRES = ['Rock','Pop','Jazz','HipHop','Electronic'];

// login or signup
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).send('username required');
  const { user, file } = loadUser(username);
  saveUser(file, user);
  res.json({ ok: true });
});

// get state + apply offline earnings
app.get('/api/state', (req, res) => {
  const username = req.header('x-username');
  if (!username) return res.status(401).send('no username');
  const { user, file } = loadUser(username);
  applyEarnings(user);
  saveUser(file, user);
  res.json(user);
});

// click to get 1 item
app.post('/api/click', (req, res) => {
  const username = req.header('x-username');
  if (!username) return res.status(401).send('no username');
  const { user, file } = loadUser(username);
  applyEarnings(user);
  // 50/50 album or single
  const type = Math.random() < 0.5 ? 'single' : 'album';
  const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
  const item = generateItem(type, genre);
  user.inventory[type + 's'].push(item);
  saveUser(file, user);
  res.json(item);
});

// equip/unequip toggle
app.post('/api/equip', (req, res) => {
  const { type, itemId } = req.body;
  const username = req.header('x-username');
  if (!username) return res.status(401).send('no username');
  const { user, file } = loadUser(username);
  applyEarnings(user);
  const list = user.equipped[type + 's'];
  if (list.includes(itemId)) {
    user.equipped[type + 's'] = list.filter(id => id !== itemId);
  } else if (list.length < 4) {
    // find rarity of item
    const it = user.inventory[type + 's'].find(i => i.id === itemId);
    if (it) list.push(it.rarity);
  }
  saveUser(file, user);
  res.json(user.equipped);
});

// list genres
app.get('/api/packs', (_, res) => {
  res.json(GENRES);
});

// buy a 5‑item pack
app.post('/api/buyPack', (req, res) => {
  const { genre } = req.body;
  const username = req.header('x-username');
  if (!username) return res.status(401).send('no username');
  const { user, file } = loadUser(username);
  applyEarnings(user);
  const COST = 1000;
  if (user.money < COST) return res.status(400).send('not enough money');
  user.money -= COST;
  const items = [];
  for (let i = 0; i < 5; i++) {
    const type = Math.random() < 0.5 ? 'single' : 'album';
    const item = generateItem(type, genre);
    user.inventory[type + 's'].push(item);
    items.push(item);
  }
  saveUser(file, user);
  res.json(items);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
