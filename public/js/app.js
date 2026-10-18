'use strict';

/* ================= 图标 ================= */
const ICONS = {
  chat: '<svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" transform="scale(0)"/><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2 3v2h12V7H6zm0 4v2h8v-2H6zm0 4v2h10v-2H6z"/></svg>',
  group: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h4v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
  person: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V16h2V7.83l5.58 5.58L20 12l-8-8-8 8z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8v-2H4V5z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
  smile: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm3.5-9a1.5 1.5 0 1 0-1.5-1.5 1.5 1.5 0 0 0 1.5 1.5zm-7 0a1.5 1.5 0 1 0-1.5-1.5 1.5 1.5 0 0 0 1.5 1.5zm3.5 6a4 4 0 0 0 4-2.5H8a4 4 0 0 0 4 2.5z"/></svg>',
  'friend-add': '<svg viewBox="0 0 24 24"><path d="M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm12 7a8 8 0 0 0-5.98 2.7V19H18v-1.5A6.4 6.4 0 0 1 21.5 19v-1.5a5.6 5.6 0 0 0-3.5-.5z"/></svg>',
};

/* ================= 状态 ================= */
const S = {
  me: null,
  token: localStorage.getItem('mchat_token') || '',
  ws: null,
  wsRetry: 0,
  friends: [],
  chats: [],
  incoming: [],
  outgoing: [],
  online: new Set(),
  active: null,
  msgs: {},          // peer -> [msg]
  pendingMid: new Set(),
  searchSeq: 0,
  modalFor: null,
};

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fmtTime(at) {
  const d = new Date(at);
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === now.toDateString()) return hm;
  const y = new Date(now.getTime() - 864e5);
  if (d.toDateString() === y.toDateString()) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

function fmtDay(at) {
  const d = new Date(at);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return '今天';
  const y = new Date(now.getTime() - 864e5);
  if (d.toDateString() === y.toDateString()) return '昨天';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2600);
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(
      () => toast('ID 已复制'),
      () => fallbackCopy(text)
    );
  }
  fallbackCopy(text);
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); toast('ID 已复制'); } catch { toast('复制失败, 请手动复制'); }
  ta.remove();
}

/* ================= 图标注入 ================= */
function injectIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = ICONS[el.dataset.icon] || '';
  });
}

/* ================= 头像 ================= */
function avatarEl(info, cls = '') {
  const d = document.createElement('div');
  d.className = `avatar ${cls}`;
  d.style.background = info.color || '#6750A4';
  d.textContent = (info.nickname || '?')[0].toUpperCase();
  const dot = document.createElement('span');
  dot.className = 'dot';
  d.appendChild(dot);
  if (info.online) d.classList.add('online');
  return d;
}

/* ================= 网络 ================= */
async function api(pathname, opts) {
  const res = await fetch(pathname, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

function connect() {
  S.ws = new WebSocket(`${wsUrl()}?token=${encodeURIComponent(S.token)}`);
  S.ws.onopen = () => {
    S.wsRetry = 0;
  };
  S.ws.onmessage = (e) => onWs(JSON.parse(e.data));
  S.ws.onclose = () => {
    scheduleReconnect();
  };
  S.ws.onerror = () => S.ws.close();
}

function scheduleReconnect() {
  const delay = Math.min(15000, 500 * 2 ** S.wsRetry++);
  setTimeout(() => { if (!S.ws) connect(); }, delay);
}

function wsSend(obj) {
  if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(obj));
}

/* ================= 登录 ================= */
async function boot() {
  injectIcons();
  setupStatic();
  if (!S.token) return showLogin();
  try {
    const me = await api(`/api/verify?token=${encodeURIComponent(S.token)}`);
    S.me = me;
    enterMain();
  } catch {
    S.token = '';
    localStorage.removeItem('mchat_token');
    showLogin();
  }
}

function showLogin() {
  $('#screen-login').classList.remove('hidden');
  $('#screen-main').classList.add('hidden');
}

async function doRegister() {
  const nick = $('#input-nick').value.trim();
  const err = $('#login-error');
  err.textContent = '';
  if (!nick) { err.textContent = '请输入昵称'; return; }
  $('#btn-enter').disabled = true;
  try {
    const r = await api('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: nick }),
    });
    S.me = { id: r.id, nickname: r.nickname, color: r.color };
    S.token = r.token;
    localStorage.setItem('mchat_token', r.token);
    enterMain();
  } catch (e) {
    err.textContent = '注册失败: ' + e.message;
  } finally {
    $('#btn-enter').disabled = false;
  }
}

function logout() {
  if (!confirm('退出将清除当前 ID 会话, 下次进入会随机生成新 ID, 确定?')) return;
  localStorage.removeItem('mchat_token');
  location.reload();
}

function enterMain() {
  $('#screen-login').classList.add('hidden');
  $('#screen-main').classList.remove('hidden');
  renderMe();
  switchTab('chat');
  connect();
}

/* ================= 静态事件 ================= */
function setupStatic() {
  $('#btn-enter').addEventListener('click', doRegister);
  $('#input-nick').addEventListener('keydown', (e) => e.key === 'Enter' && doRegister());
  $('#btn-logout').addEventListener('click', logout);
  $('#btn-copy-id').addEventListener('click', () => S.me && copyText(S.me.id));

  document.querySelectorAll('.rail-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 搜索
  let searchTimer = null;
  $('#search-input').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(searchTimer);
    if (!q) {
      $('#search-results').classList.add('hidden');
      $('#contacts-body').classList.remove('hidden');
      return;
    }
    searchTimer = setTimeout(() => {
      S.searchSeq++;
      wsSend({ type: 'search', q, ref: S.searchSeq });
    }, 300);
  });

  // 聊天输入
  const input = $('#msg-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSend();
  });
  $('#btn-send').addEventListener('click', doSend);

  // 表情
  const EMOJIS = ['😀', '😂', '🤣', '😊', '😍', '🤔', '👍', '👏', '❤️', '🎉', '😭', '😎', '🙏', '🤝', '💯', '🔥'];
  const row = $('#emoji-row');
  EMOJIS.forEach((em) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = em;
    b.addEventListener('click', () => {
      input.value += em;
      input.focus();
    });
    row.appendChild(b);
  });
  $('#btn-emoji').addEventListener('click', () => {
    row.classList.toggle('hidden');
    input.focus();
  });

  // 弹窗
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-user').addEventListener('click', (e) => {
    if (e.target.id === 'modal-user') closeModal();
  });
  $('#m-request-send').addEventListener('click', sendFriendRequestFromModal);
  $('#btn-back').addEventListener('click', closeMobileChat);
  $('#btn-peer-card').addEventListener('click', () => {
    if (S.active) openUserCard(friendInfo(S.active));
  });
}

/* ================= Tab 切换 ================= */
function switchTab(name) {
  document.querySelectorAll('.rail-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-page').forEach((p) => p.classList.toggle('hidden', p.dataset.page !== name));
  closeMobileChat();
  if (name === 'contacts') $('#search-input').focus();
}

function closeMobileChat() {
  document.querySelector('.chat-panel').classList.remove('open');
}

/* ================= WebSocket 消息 ================= */
function onWs(m) {
  switch (m.type) {
    case 'snapshot':
      S.friends = m.friends || [];
      S.chats = m.chats || [];
      S.incoming = m.incoming || [];
      S.outgoing = m.outgoing || [];
      S.online = new Set(m.online || []);
      S.me = Object.assign(S.me || {}, m.me, { online: true });
      renderAll();
      break;

    case 'chat': {
      const peer = m.self ? m.msg.from : m.msg.to;
      applyChatMsg(m.msg, peer, !m.self ? m.unread : undefined);
      break;
    }

    case 'presence':
      if (m.online) S.online.add(m.id);
      else S.online.delete(m.id);
      renderAll();
      break;

    case 'friend_request_in': {
      S.incoming.push(m.req);
      renderContacts();
      updateBadges();
      toast(`收到 ${m.req.nickname} 的好友申请, 去联系人查看`);
      const tab = document.querySelector('[data-tab="contacts"]');
      tab.classList.add('active');
      switchTab('contacts');
      break;
    }

    case 'friend_request_sent':
      S.outgoing.unshift({ id: m.req.id, to: m.req.to, note: m.req.note, at: m.req.at });
      renderContacts();
      toast('好友申请已发送, 等待对方同意');
      break;

    case 'friend_added':
      S.incoming = S.incoming.filter((r) => r.from !== m.id);
      upsertFriend(m.info);
      toast(`${m.info.nickname} 已成为你的好友, 开始聊天吧`);
      renderAll();
      break;

    case 'friend_accepted':
      S.outgoing = S.outgoing.filter((r) => r.to !== m.id);
      upsertFriend(m.info);
      toast(`${m.info.nickname} 同意了你, 开始聊天吧`);
      renderAll();
      break;

    case 'friend_declined':
      S.outgoing = S.outgoing.filter((r) => r.id !== m.reqId);
      renderContacts();
      toast('你的好友申请被对方拒绝了');
      break;

    case 'friend_removed':
      removeFriend(m.id);
      toast(m.initiator === S.me.id ? '你已删除该好友' : '对方已删除你');
      renderAll();
      break;

    case 'search_result':
      renderSearchResults(m.results, m.ref);
      break;

    case 'history': {
      S.msgs[m.peer] = m.msgs;
      if (S.active === m.peer) renderMessages();
      break;
    }

    case 'error':
      if (m.code === 'not_friend' && m.ref && S.pendingMid.has(m.ref)) {
        failPending(m.message || '发送失败');
      } else if (m.code === 'user_not_found') {
        toast(m.message);
      } else if (m.code === 'dup_request') {
        toast(m.message);
      } else if (m.code === 'self') {
        toast(m.message);
      }
      break;

    case 'sync':
      wsSend({ type: 'hello' });
      break;

    default:
      break;
  }
}

function upsertFriend(info) {
  if (!info || !info.id) return;
  const f = S.friends.find((x) => x.id === info.id);
  if (f) Object.assign(f, info);
  else S.friends.push(info);
  S.incoming = S.incoming.filter((r) => r.from !== info.id);
  S.outgoing = S.outgoing.filter((r) => r.to !== info.id);
}

function removeFriend(id) {
  S.friends = S.friends.filter((f) => f.id !== id);
  S.chats = S.chats.filter((c) => c.peer !== id);
  S.outgoing = S.outgoing.filter((r) => r.to !== id);
  S.incoming = S.incoming.filter((r) => r.from !== id);
  if (S.active === id) {
    S.active = null;
    showChatEmpty();
  }
}

function applyChatMsg(msg, peer, unread) {
  // 去重(自己发送回显 + 历史)
  const arr = S.msgs[peer] || [];
  const i = arr.findIndex((x) => x.mid === msg.mid);
  if (i >= 0) arr.splice(i, 1);
  arr.push(msg);
  S.msgs[peer] = arr;

  // 更新会话条目
  let c = S.chats.find((x) => x.peer === peer);
  if (!c) {
    const f = S.friends.find((x) => x.id === peer);
    if (!f) return;
    c = { peer, friend: f, last: null, unread: 0 };
    S.chats.unshift(c);
  }
  c.last = msg;
  if (unread != null) c.unread = unread;

  if (S.active === peer) {
    renderMessages();
    wsSend({ type: 'mark_read', peer });
    c.unread = 0;
  }
  renderChatList();
  renderContacts();
  updateBadges();
}

function failPending(message) {
  S.pendingMid.clear();
  toast(message || '消息发送失败');
  if (S.active) renderMessages();
}

/* ================= 发送 ================= */
function doSend() {
  const input = $('#msg-input');
  const text = input.value.trim();
  if (!text || !S.active) return;
  const mid = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  S.pendingMid.add(mid);
  const msg = { mid, from: S.me.id, to: S.active, content: text, at: Date.now() };
  (S.msgs[S.active] = S.msgs[S.active] || []).push(msg);
  input.value = '';
  wsSend({ type: 'chat', to: S.active, content: text, mid });
  const c = S.chats.find((x) => x.peer === S.active);
  if (c) c.last = msg;
  renderMessages();
  renderChatList();
  setTimeout(() => {
    if (S.pendingMid.has(mid)) {
      // 超时未回显
      S.pendingMid.delete(mid);
      toast('发送失败, 请检查连接');
      renderMessages();
    }
  }, 4000);
  // 回显后移除 pending
  setTimeout(() => { S.pendingMid.delete(mid); }, 1500);
}

/* ================= 渲染 ================= */
function renderAll() {
  renderChatList();
  renderContacts();
  renderMe();
  updateBadges();
  if (S.active) renderChatHeader();
}

function renderMe() {
  if (!S.me) return;
  const a = $('#me-avatar');
  a.className = 'avatar avatar-xl';
  a.style.background = S.me.color;
  a.textContent = S.me.nickname[0].toUpperCase();
  $('#me-name').textContent = S.me.nickname;
  $('#me-id').textContent = S.me.id;
}

function renderChatList() {
  const list = $('#chat-list');
  list.innerHTML = '';
  const empty = $('#chat-list-empty');
  empty.classList.toggle('hidden', S.chats.length > 0);
  S.chats.sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0));
  for (const c of S.chats) {
    const f = c.friend || S.friends.find((x) => x.id === c.peer);
    if (!f) continue;
    f.online = S.online.has(f.id);
    const li = document.createElement('li');
    li.className = 'list-item' + (S.active === c.peer ? ' active' : '');
    const av = avatarEl(f);
    const main = document.createElement('div');
    main.className = 'li-main';
    const nm = document.createElement('div');
    nm.className = 'li-name';
    nm.textContent = f.nickname;
    main.appendChild(nm);
    const sub = document.createElement('div');
    sub.className = 'li-sub';
    sub.textContent = c.last ? (c.last.from === S.me.id ? '我: ' : '') + c.last.content : (f.online ? '在线' : '离线');
    main.appendChild(sub);
    const right = document.createElement('div');
    right.className = 'li-right';
    if (c.last) {
      const t = document.createElement('div');
      t.className = 'li-time';
      t.textContent = fmtTime(c.last.at);
      right.appendChild(t);
    }
    if (c.unread > 0) {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = c.unread > 99 ? '99+' : String(c.unread);
      right.appendChild(b);
    }
    li.appendChild(av);
    li.appendChild(main);
    li.appendChild(right);
    li.addEventListener('click', () => openChat(c.peer));
    list.appendChild(li);
  }
}

function renderContacts() {
  // 好友申请
  const incSec = $('#req-incoming');
  const outSec = $('#req-outgoing');
  const incList = $('#incoming-list');
  const outList = $('#outgoing-list');
  incList.innerHTML = '';
  outList.innerHTML = '';

  for (const r of S.incoming) {
    const li = document.createElement('li');
    li.className = 'list-item';
    const av = avatarEl({ nickname: r.nickname, color: r.color, online: S.online.has(r.from) }, 'avatar');
    li.appendChild(av);
    const main = document.createElement('div');
    main.className = 'li-main';
    const nm = document.createElement('div');
    nm.className = 'li-name';
    nm.textContent = r.nickname;
    const nt = document.createElement('div');
    nt.className = 'req-note';
    nt.textContent = r.note ? `申请: ${r.note}` : '申请添加你为好友';
    main.appendChild(nm);
    main.appendChild(nt);
    li.appendChild(main);
    const acts = document.createElement('div');
    acts.className = 'req-actions';
    const ok = document.createElement('button');
    ok.className = 'btn btn-filled btn-sm';
    ok.textContent = '同意';
    ok.addEventListener('click', (ev) => { ev.stopPropagation(); wsSend({ type: 'friend_accept', reqId: r.id }); });
    const no = document.createElement('button');
    no.className = 'btn btn-outlined btn-sm';
    no.textContent = '拒绝';
    no.addEventListener('click', (ev) => { ev.stopPropagation(); wsSend({ type: 'friend_decline', reqId: r.id }); });
    acts.appendChild(ok);
    acts.appendChild(no);
    li.appendChild(acts);
    incList.appendChild(li);
  }
  incSec.classList.toggle('hidden', S.incoming.length === 0);
  $('#badge-incoming').textContent = String(S.incoming.length);
  $('#badge-incoming').classList.toggle('hidden', S.incoming.length === 0);

  for (const r of S.outgoing) {
    const li = document.createElement('li');
    li.className = 'list-item';
    const info = S.friends.find((f) => f.id === r.to);
    const av = avatarEl({ nickname: r.nickname, color: r.color, online: S.online.has(r.to) });
    li.appendChild(av);
    const main = document.createElement('div');
    main.className = 'li-main';
    const nm = document.createElement('div');
    nm.className = 'li-name';
    nm.textContent = r.nickname;
    const st = document.createElement('div');
    st.className = 'li-sub';
    st.textContent = info ? '已是好友' : '等待对方同意';
    main.appendChild(nm);
    main.appendChild(st);
    li.appendChild(main);
    outList.appendChild(li);
  }
  outSec.classList.toggle('hidden', S.outgoing.length === 0);

  // 好友列表
  const fl = $('#friend-list');
  fl.innerHTML = '';
  $('#friend-count').textContent = S.friends.length ? String(S.friends.length) : '';
  if (!S.friends.length) {
    const li = document.createElement('div');
    li.className = 'list-empty';
    li.textContent = '还没有好友, 在上方搜索 ID 添加吧';
    fl.appendChild(li);
  }
  for (const f of S.friends) {
    f.online = S.online.has(f.id);
    const li = document.createElement('li');
    li.className = 'list-item' + (S.active === f.id ? ' active' : '');
    const av = avatarEl(f);
    li.appendChild(av);
    const main = document.createElement('div');
    main.className = 'li-main';
    const nm = document.createElement('div');
    nm.className = 'li-name';
    nm.textContent = f.nickname;
    const sub = document.createElement('div');
    sub.className = 'li-sub';
    sub.textContent = f.id;
    main.appendChild(nm);
    main.appendChild(sub);
    li.appendChild(main);
    li.addEventListener('click', () => openChat(f.id));
    li.addEventListener('contextmenu', (ev) => { ev.preventDefault(); openUserCard(f); });
    fl.appendChild(li);
  }
}

function renderSearchResults(results, ref) {
  if (ref !== S.searchSeq) return;
  const ul = $('#search-results');
  ul.innerHTML = '';
  if (!results.length) {
    const li = document.createElement('li');
    li.className = 'list-empty';
    li.textContent = '没有找到相关用户';
    ul.appendChild(li);
  }
  for (const u of results) {
    const li = document.createElement('li');
    li.className = 'list-item';
    const av = avatarEl(u);
    li.appendChild(av);
    const main = document.createElement('div');
    main.className = 'li-main';
    const nm = document.createElement('div');
    nm.className = 'li-name';
    nm.textContent = u.isSelf ? `${u.nickname}(你)` : u.nickname;
    const sub = document.createElement('div');
    sub.className = 'li-sub';
    sub.textContent = u.isFriend ? '好友 · ' + u.id : u.id;
    main.appendChild(nm);
    main.appendChild(sub);
    li.appendChild(main);
    if (!u.isSelf) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm ' + (u.isFriend ? 'btn-outlined' : 'btn-filled');
      btn.textContent = u.isFriend ? '聊天' : '加好友';
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (u.isFriend) openChat(u.id);
        else openUserCard(u);
      });
      li.appendChild(btn);
      li.addEventListener('click', () => openUserCard(u));
    }
    ul.appendChild(li);
  }
  ul.classList.remove('hidden');
  $('#contacts-body').classList.add('hidden');
}

function updateBadges() {
  const chatTotal = S.chats.reduce((n, c) => n + (c.unread || 0), 0);
  const b1 = $('#badge-tab-chat');
  b1.textContent = chatTotal > 99 ? '99+' : String(chatTotal);
  b1.classList.toggle('hidden', chatTotal === 0);
  const b2 = $('#badge-tab-contacts');
  b2.textContent = String(S.incoming.length);
  b2.classList.toggle('hidden', S.incoming.length === 0);
  const incBadge = $('#badge-incoming');
  incBadge.textContent = String(S.incoming.length);
  incBadge.classList.toggle('hidden', S.incoming.length === 0);
}

/* ================= 聊天窗口 ================= */
function friendInfo(id) {
  return S.friends.find((f) => f.id === id);
}

function openChat(id) {
  if (!friendInfo(id)) return;
  S.active = id;
  closeMobileChat();
  document.querySelector('.chat-panel').classList.add('open');
  $('#chat-empty').classList.add('hidden');
  $('#chat-view').classList.remove('hidden');
  renderChatHeader();
  renderMessages();
  renderChatList();
  renderContacts();
  if (!S.msgs[id]) wsSend({ type: 'history', peer: id });
  wsSend({ type: 'mark_read', peer: id });
  const c = S.chats.find((x) => x.peer === id);
  if (c) c.unread = 0;
  updateBadges();
  $('#msg-input').focus();
}

function showChatEmpty() {
  $('#chat-empty').classList.remove('hidden');
  $('#chat-view').classList.add('hidden');
}

function renderChatHeader() {
  const f = friendInfo(S.active);
  if (!f) return;
  const av = $('#chat-peer-avatar');
  av.className = 'avatar';
  av.style.background = f.color;
  av.textContent = f.nickname[0].toUpperCase();
  av.innerHTML = '';
  av.appendChild(avatarDot(f));
  $('#chat-peer-name').textContent = f.nickname;
  $('#chat-peer-sub').textContent = `${f.online ? '在线' : '离线'} · ID ${f.id}`;
}

function avatarDot(f) {
  const d = document.createElement('span');
  d.className = 'dot';
  if (f.online) d.style.background = 'var(--success)';
  return d;
}

function renderMessages() {
  const box = $('#messages');
  const peer = S.active;
  const arr = S.msgs[peer] || [];
  box.innerHTML = '';
  let lastDay = '';
  let lastAt = 0;
  for (const m of arr) {
    const day = fmtDay(m.at);
    if (day !== lastDay) {
      const d = document.createElement('div');
      d.className = 'msg-day';
      d.textContent = day;
      box.appendChild(d);
      lastDay = day;
      lastAt = 0;
    } else if (m.at - lastAt > 5 * 60 * 1000) {
      const d = document.createElement('div');
      d.className = 'msg-day';
      d.textContent = fmtTime(m.at);
      box.appendChild(d);
    }
    lastAt = m.at;
    const div = document.createElement('div');
    const out = m.from === S.me.id;
    div.className = `msg ${out ? 'out' : 'in'}` + (S.pendingMid.has(m.mid) ? ' pending' : '');
    const b = document.createElement('div');
    b.className = 'b';
    b.textContent = m.content;
    const t = document.createElement('div');
    t.className = 't';
    t.textContent = fmtTime(m.at);
    div.appendChild(b);
    div.appendChild(t);
    box.appendChild(div);
  }
  box.scrollTop = box.scrollHeight;
}

/* ================= 用户卡片 ================= */
function openUserCard(info) {
  S.modalFor = info.id;
  const av = $('#m-avatar');
  av.className = 'avatar avatar-xl';
  av.style.background = info.color;
  av.textContent = info.nickname[0].toUpperCase();
  av.innerHTML = '';
  av.appendChild(avatarDot(info));
  $('#m-name').textContent = info.nickname;
  $('#m-id').textContent = info.id;
  const isFriend = !!friendInfo(info.id);
  const inc = S.incoming.find((r) => r.from === info.id);
  const out = S.outgoing.find((r) => r.to === info.id);
  const status = $('#m-status');
  const actions = $('#m-actions');
  const reqBox = $('#m-request-box');
  const notice = $('#m-notice');
  actions.innerHTML = '';
  reqBox.classList.add('hidden');
  notice.classList.add('hidden');
  status.textContent = isFriend
    ? '好友 · ' + (info.online ? '在线' : '离线')
    : inc ? '待你同意' : out ? '已发送申请, 等待对方' : (info.online ? '在线' : '离线');

  if (isFriend) {
    const chat = document.createElement('button');
    chat.className = 'btn btn-filled';
    chat.textContent = '发消息';
    chat.addEventListener('click', () => { closeModal(); openChat(info.id); });
    const del = document.createElement('button');
    del.className = 'btn btn-danger';
    del.textContent = '删除好友';
    del.addEventListener('click', () => {
      if (confirm(`删除好友 ${info.nickname}? 删除后需要重新申请并通过`)) wsSend({ type: 'friend_remove', id: info.id });
      closeModal();
    });
    actions.appendChild(chat);
    actions.appendChild(del);
  } else if (inc) {
    const ok = document.createElement('button');
    ok.className = 'btn btn-filled';
    ok.textContent = '同意申请';
    ok.addEventListener('click', () => { wsSend({ type: 'friend_accept', reqId: inc.id }); closeModal(); });
    const no = document.createElement('button');
    no.className = 'btn btn-outlined';
    no.textContent = '拒绝';
    no.addEventListener('click', () => { wsSend({ type: 'friend_decline', reqId: inc.id }); closeModal(); });
    actions.appendChild(ok);
    actions.appendChild(no);
    if (inc.note) {
      notice.classList.remove('hidden');
      notice.textContent = `申请留言: ${inc.note}`;
    }
  } else if (out) {
    notice.classList.remove('hidden');
    notice.textContent = '你已发送好友申请, 等待对方同意后开始聊天';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-outlined';
    cancel.textContent = '关闭';
    cancel.addEventListener('click', closeModal);
    actions.appendChild(cancel);
  } else {
    const row = document.createElement('div');
    row.className = 'row';
    const send = document.createElement('button');
    send.className = 'btn btn-filled';
    send.textContent = '发送好友申请';
    send.addEventListener('click', () => {
      reqBox.classList.remove('hidden');
      $('#m-note').focus();
    });
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-outlined';
    cancel.textContent = '取消';
    cancel.addEventListener('click', closeModal);
    row.appendChild(send);
    row.appendChild(cancel);
    actions.appendChild(row);
  }
  $('#modal-user').classList.remove('hidden');
}

function sendFriendRequestFromModal() {
  const id = S.modalFor;
  const note = $('#m-note').value.trim();
  wsSend({ type: 'friend_request', to: id, note });
  $('#m-note').value = '';
  closeModal();
}

function closeModal() {
  $('#modal-user').classList.add('hidden');
  S.modalFor = null;
}

/* ================= 启动 ================= */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

boot();
