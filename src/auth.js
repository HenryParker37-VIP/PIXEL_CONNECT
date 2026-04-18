const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { load, save } = require('./storage');

const BACKUP_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function loadUsers() { return load('users', {}); }
function saveUsers(u) { save('users', u); }
function loadSessions() { return load('sessions', {}); }
function saveSessions(s) { save('sessions', s); }

function generateBackupCode() {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) code += BACKUP_CODE_CHARS[bytes[i] % BACKUP_CODE_CHARS.length];
  return code;
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function register({ username, email, password }) {
  if (!username || !email || !password) throw new Error('Missing fields');
  if (username.length < 3 || username.length > 20) throw new Error('Username must be 3-20 chars');
  if (password.length < 6) throw new Error('Password must be at least 6 chars');

  const users = loadUsers();
  const key = username.toLowerCase();
  if (users[key]) throw new Error('Username taken');
  for (const u of Object.values(users)) {
    if (u.email.toLowerCase() === email.toLowerCase()) throw new Error('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const backupCode = generateBackupCode();
  const backupHash = await bcrypt.hash(backupCode, 10);

  users[key] = {
    username,
    email,
    passwordHash,
    backupHash,
    coins: 1000,
    inventory: [],
    equipped: { hair: 'hair_brown', shirt: 'shirt_blue', pants: 'pants_gray' },
    avatar: { skin: '#f2c99b', hairColor: '#3b2a20' },
    houseName: `${username}'s House`,
    lastDaily: null,
    createdAt: Date.now(),
  };
  saveUsers(users);

  const token = createSession(key);
  return { token, username, backupCode, coins: users[key].coins };
}

function createSession(userKey) {
  const sessions = loadSessions();
  const token = generateToken();
  sessions[token] = { userKey, createdAt: Date.now() };
  saveSessions(sessions);
  return token;
}

async function login({ identifier, password, backupCode }) {
  if (!identifier) throw new Error('Missing identifier');
  const users = loadUsers();
  let user = users[identifier.toLowerCase()];
  if (!user) {
    for (const u of Object.values(users)) {
      if (u.email.toLowerCase() === identifier.toLowerCase()) { user = u; break; }
    }
  }
  if (!user) throw new Error('Invalid credentials');

  let ok = false;
  if (password) ok = await bcrypt.compare(password, user.passwordHash);
  else if (backupCode) ok = await bcrypt.compare(backupCode.toUpperCase(), user.backupHash);
  if (!ok) throw new Error('Invalid credentials');

  const token = createSession(user.username.toLowerCase());
  const daily = claimDaily(user.username.toLowerCase());
  return { token, username: user.username, coins: daily.coins, dailyReward: daily.reward };
}

function claimDaily(userKey) {
  const users = loadUsers();
  const user = users[userKey];
  const today = todayKey();
  let reward = 0;
  if (user.lastDaily !== today) {
    reward = 100;
    user.coins += reward;
    user.lastDaily = today;
    saveUsers(users);
  }
  return { coins: user.coins, reward };
}

function verifyToken(token) {
  if (!token) return null;
  const sessions = loadSessions();
  const s = sessions[token];
  if (!s) return null;
  const users = loadUsers();
  const user = users[s.userKey];
  if (!user) return null;
  return { userKey: s.userKey, user };
}

function regenerateBackupCode(userKey) {
  const users = loadUsers();
  const user = users[userKey];
  if (!user) throw new Error('User not found');
  const code = generateBackupCode();
  return bcrypt.hash(code, 10).then(hash => {
    user.backupHash = hash;
    saveUsers(users);
    return code;
  });
}

module.exports = {
  register, login, verifyToken, regenerateBackupCode,
  loadUsers, saveUsers,
};
