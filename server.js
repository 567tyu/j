'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_MSG_LEN = 2000;
const MAX_NICK_LEN = 16;
const MAX_NOTE_LEN = 64;
const PAIR_MSG_LIMIT = 500;

// ---------------------------------------------------------------------------
// 数据层
// ---------------------------------------------------------------------------

const DEFAULT_DB = {
  users: {},    // id -> { id, nickname, color, token, createdAt }
  friends: {},  // id -> [friendId, ...]
  requests: {}, // reqId -> { id, from, to, note, at, status: 'pending'|'accepted'|'declined' }
  messages: {}, // "A|B"(排序后) -> [{ mid, from, to, content, at }]
  read: {},     // id -> { pairKey: lastReadAt }
};

let db = loadDb();

function loadDb() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return Object.assign({}, DEFAULT_DB, raw);
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

let saveTimer = null;
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_PATH);
  }, 50);
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

const ID_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 去掉了 0,1,I,L,O

function genId() {
  const buf = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += ID_CHARS[buf[i] % ID_CHARS.length];
  return out;
}

function uniqueId(prefix) {
  return prefix + crypto.randomBytes(6).toString('hex');
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

const COLORS = ['#6750A4', '#0B8043', '#006299', '#98423C', '#B3261E', '#8C4361', '#425066', '#7A5900'];

function colorFor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

function hasFriend(a, b) {
  return (db.friends[a] || []).includes(b);
}

function isOnline(id) {
  return (sockets.get(id) || new Set()).size > 0;
}

function userInfo(id) {
  const u = db.users[id];
  if (!u) return null;
  return { id: u.id, nickname: u.nickname, color: u.color, online: isOnline(u.id) };
}

function unreadCount(user, peer) {
  const key = pairKey(user, peer);
  const msgs = db.messages[key] || [];
  const readAt = (db.read[user] || {})[key] || 0;
  let n = 0;
  for (const m of msgs) if (m.from === peer && m.at > readAt) n++;
  return n;
}

function lastMsg(user, peer) {
  const msgs = db.messages[pairKey(user, peer)] || [];
  return msgs.length ? msgs[msgs.length - 1] : null;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > (limit || 1e5)) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('bad json'));
      }
    });
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function sanitizeNick(raw) {
  return String(raw || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NICK_LEN);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (req.method === 'POST' && p === '/api/register') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { error: 'bad request' });
    }
    const nickname = sanitizeNick(body.nickname);
    if (nickname.length < 1) return json(res, 400, { error: 'nickname required' });
    let id;
    do {
      id = genId();
    } while (db.users[id]);
    const user = {
      id,
      nickname,
      color: colorFor(id),
      token: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    db.users[id] = user;
    db.friends[id] = [];
    db.read[id] = {};
    saveDb();
    return json(res, 200, { id, nickname, color: user.color, token: user.token });
  }

  if (req.method === 'GET' && p === '/api/verify') {
    const token = url.searchParams.get('token') || '';
    const found = Object.values(db.users).find((u) => u.token === token);
    if (!found) return json(res, 404, { error: 'invalid token' });
    return json(res, 200, userInfo(found.id));
  }

  if (p.startsWith('/api/')) {
    return json(res, 404, { error: 'not found' });
  }

  // 静态文件
  let file = p === '/' ? '/index.html' : p;
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(PUBLIC_DIR, file);
  if (!full.startsWith(PUBLIC_DIR) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 Not Found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
});

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

const sockets = new Map(); // userId -> Set<ws>
const wss = new WebSocketServer({ server, path: '/ws' });

function send(userId, obj) {
  const set = sockets.get(userId);
  if (!set) return;
  const payload = JSON.stringify(obj);
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

function broadcast(obj, except) {
  for (const [uid, set] of sockets) {
    if (uid === except) continue;
    const payload = JSON.stringify(obj);
    for (const ws of set) if (ws.readyState === 1) ws.send(payload);
  }
}

function snapshot(userId) {
  const friends = (db.friends[userId] || []).map((fid) => userInfo(fid)).filter(Boolean);
  const chats = friends.map((f) => ({
    peer: f.id,
    friend: f,
    last: lastMsg(userId, f.id),
    unread: unreadCount(userId, f.id),
  }));
  const incoming = Object.values(db.requests)
    .filter((r) => r.to === userId && r.status === 'pending')
    .map((r) => ({ id: r.id, from: r.from, nickname: db.users[r.from]?.nickname, color: db.users[r.from]?.color, note: r.note, at: r.at, online: isOnline(r.from) }));
  const outgoing = Object.values(db.requests)
    .filter((r) => r.from === userId && r.status === 'pending')
    .map((r) => ({ id: r.id, to: r.to, nickname: db.users[r.to]?.nickname, color: db.users[r.to]?.color, note: r.note, at: r.at, online: isOnline(r.to) }));
  return {
    type: 'snapshot',
    me: userInfo(userId),
    friends,
    chats,
    incoming,
    outgoing,
    online: [...sockets.keys()].filter(isOnline),
  };
}

function findRequest(id) {
  const r = db.requests[id];
  return r && r.status === 'pending' ? r : null;
}

wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://x').searchParams.get('token') || '';
  const user = Object.values(db.users).find((u) => u.token === token);
  if (!user) {
    ws.close(4001, 'unauthorized');
    return;
  }
  const uid = user.id;
  let set = sockets.get(uid);
  if (!set) {
    set = new Set();
    sockets.set(uid, set);
  }
  set.add(ws);
  ws.userId = uid;

  if (set.size === 1) {
    // 上线
    ws.send(JSON.stringify({ type: 'presence', id: uid, online: true, nickname: user.nickname }));
    broadcast({ type: 'presence', id: uid, online: true, nickname: user.nickname }, uid);
  }
  send(uid, snapshot(uid));

  ws.on('message', (data) => {
    let m;
    try {
      m = JSON.parse(data.toString('utf8'));
    } catch {
      return;
    }
    handle(uid, m, ws);
  });

  ws.on('close', () => {
    const s = sockets.get(uid);
    if (!s) return;
    s.delete(ws);
    if (s.size === 0) {
      sockets.delete(uid);
      broadcast({ type: 'presence', id: uid, online: false }, uid);
    }
  });
});

function handle(uid, m, ws) {
  switch (m.type) {
    case 'hello':
      return send(uid, snapshot(uid));

    case 'chat': {
      const to = String(m.to || '');
      const content = String(m.content || '').slice(0, MAX_MSG_LEN);
      const mid = String(m.mid || '').slice(0, 64) || uniqueId('m');
      if (!db.users[to]) return send(uid, { type: 'error', code: 'user_not_found', message: '用户不存在', ref: mid });
      if (to === uid) return send(uid, { type: 'error', code: 'self', message: '不能给自己发消息', ref: mid });
      if (!hasFriend(uid, to)) return send(uid, { type: 'error', code: 'not_friend', message: '还不是好友，请先添加', ref: mid });
      if (!content) return;
      const key = pairKey(uid, to);
      const arr = db.messages[key] || [];
      const msg = { mid, from: uid, to, content, at: Date.now() };
      arr.push(msg);
      if (arr.length > PAIR_MSG_LIMIT) db.messages[key] = arr.slice(-PAIR_MSG_LIMIT);
      else db.messages[key] = arr;
      saveDb();
      send(to, { type: 'chat', msg, unread: unreadCount(to, uid) });
      send(uid, { type: 'chat', msg, self: true, unread: unreadCount(uid, to) });
      return;
    }

    case 'history': {
      const peer = String(m.peer || '');
      if (!db.users[peer] || !hasFriend(uid, peer)) return send(uid, { type: 'error', code: 'not_friend', message: '还不是好友' });
      const msgs = (db.messages[pairKey(uid, peer)] || []).slice(-60);
      return send(uid, { type: 'history', peer, msgs });
    }

    case 'search': {
      const q = String(m.q || '').trim().toLowerCase().slice(0, 32);
      if (!q) return;
      const results = Object.values(db.users)
        .filter((u) => u.id.toLowerCase().includes(q) || u.nickname.toLowerCase().includes(q))
        .slice(0, 10)
        .map((u) => ({ ...userInfo(u.id), isFriend: hasFriend(uid, u.id), isSelf: u.id === uid }));
      return send(uid, { type: 'search_result', ref: m.ref, results });
    }

    case 'friend_request': {
      const to = String(m.to || '');
      const note = String(m.note || '').replace(/[\u0000-\u001f]/g, '').slice(0, MAX_NOTE_LEN);
      if (!db.users[to]) return send(uid, { type: 'error', code: 'user_not_found', message: '未找到该 ID 的用户' });
      if (to === uid) return send(uid, { type: 'error', code: 'self', message: '不能添加自己' });
      if (hasFriend(uid, to)) return send(uid, { type: 'error', code: 'already_friend', message: '对方已是你的好友' });
      if (Object.values(db.requests).some((r) => r.status === 'pending' && ((r.from === uid && r.to === to) || (r.from === to && r.to === uid)))) {
        return send(uid, { type: 'error', code: 'dup_request', message: '已存在待处理的好友申请' });
      }
      const req = { id: uniqueId('r'), from: uid, to, note, at: Date.now(), status: 'pending' };
      db.requests[req.id] = req;
      saveDb();
      send(to, { type: 'friend_request_in', req: { id: req.id, from: uid, nickname: db.users[uid].nickname, color: db.users[uid].color, note, at: req.at, online: true } });
      send(uid, { type: 'friend_request_sent', req });
      return;
    }

    case 'friend_accept': {
      const req = findRequest(String(m.reqId || ''));
      if (!req || req.to !== uid) return send(uid, { type: 'error', code: 'bad_request', message: '申请不存在或已处理' });
      req.status = 'accepted';
      addFriendship(req.from, req.to);
      send(req.to, { type: 'friend_added', id: req.from, info: userInfo(req.from) });
      send(req.from, { type: 'friend_accepted', id: req.to, info: userInfo(req.to) });
      send(req.to, { type: 'sync' });
      send(req.from, { type: 'sync' });
      saveDb();
      return;
    }

    case 'friend_decline': {
      const req = findRequest(String(m.reqId || ''));
      if (!req || req.to !== uid) return send(uid, { type: 'error', code: 'bad_request', message: '申请不存在或已处理' });
      req.status = 'declined';
      send(req.from, { type: 'friend_declined', reqId: req.id });
      saveDb();
      return;
    }

    case 'friend_remove': {
      const other = String(m.id || '');
      if (!db.users[other]) return;
      removeFriendship(uid, other);
      // 同时清理双方 pending 申请
      for (const r of Object.values(db.requests)) {
        if (r.status === 'pending' && ((r.from === uid && r.to === other) || (r.from === other && r.to === uid))) r.status = 'declined';
      }
      send(other, { type: 'friend_removed', id: uid, initiator: uid });
      send(uid, { type: 'friend_removed', id: other, initiator: uid });
      send(other, { type: 'sync' });
      send(uid, { type: 'sync' });
      saveDb();
      return;
    }

    case 'mark_read': {
      const peer = String(m.peer || '');
      if (!db.users[peer]) return;
      (db.read[uid] = db.read[uid] || {})[pairKey(uid, peer)] = Date.now();
      saveDb();
      return;
    }

    default:
      return;
  }
}

function addFriendship(a, b) {
  (db.friends[a] = db.friends[a] || []).push(b);
  (db.friends[b] = db.friends[b] || []).push(a);
  const cleanup = Object.values(db.requests).filter((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a));
  for (const r of cleanup) r.status = 'accepted';
}

function removeFriendship(a, b) {
  db.friends[a] = (db.friends[a] || []).filter((x) => x !== b);
  db.friends[b] = (db.friends[b] || []).filter((x) => x !== a);
}

server.listen(PORT, HOST, () => {
  console.log(`m3-chat listening on http://${HOST}:${PORT} (ws: /ws)`);
});
