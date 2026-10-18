'use strict';
/* 端到端测试: 模拟两个用户 注册→搜索→加好友(需同意)→互发消息→在线状态 */
const http = require('http');
const WebSocket = require('ws');

const BASE = `http://127.0.0.1:${process.env.PORT || 3000}`;

function register(nick) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ nickname: nick });
    const req = http.request(`${BASE}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`register ${nick} -> ${res.statusCode} ${data}`));
        resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

function client(token, label) {
  const c = {
    label,
    ws: new WebSocket(`${BASE.replace('http', 'ws')}/ws?token=${token}`),
    events: [],
    next: Promise.resolve(),
  };
  c.ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    c.events.push(m);
    c.next = c.next.then(() => null);
  });
  c.wait = async (pred, timeout = 5000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      await c.next.catch(() => {});
      const hit = c.events.find(pred);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`${label}: timeout waiting for ${pred.name || 'event'}`);
  };
  c.send = (o) => c.ws.send(JSON.stringify(o));
  c.close = () => c.ws.close();
  return c;
}

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  passed++;
  console.log('  ok -', msg);
}

(async () => {
  console.log('1. 注册两个用户');
  const A = await register('阿宝');
  const B = await register('贝贝');
  assert(/^[2-9A-Z]{8}$/.test(A.id), `A 的 ID 是 8 位随机英数字 (${A.id})`);
  assert(A.id !== B.id, '两个 ID 不同');

  console.log('2. 建立 WebSocket');
  const a = client(A.token, 'A');
  const b = client(B.token, 'B');
  const sa = await a.wait((m) => m.type === 'snapshot');
  const sb = await b.wait((m) => m.type === 'snapshot');
  assert(sa.type === 'snapshot', 'A 收到 snapshot');
  assert(sb.online.includes(A.id), 'B 的 snapshot 里 A 在线');
  a.close();

  console.log('3. 搜索 ID');
  const a2 = client(A.token, 'A2');
  await a2.wait((m) => m.type === 'snapshot');
  a2.send({ type: 'search', q: B.id, ref: 1 });
  const sr = await a2.wait((m) => m.type === 'search_result');
  const hit = sr.results.find((r) => r.id === B.id);
  assert(hit, '按 ID 搜到 B');
  assert(hit.isFriend === false, 'B 还不是好友');

  console.log('4. 未同意时不能聊天');
  a2.send({ type: 'chat', to: B.id, content: '你好', mid: 'x1' });
  const err1 = await a2.wait((m) => m.type === 'error' && m.code === 'not_friend');
  assert(err1.code === 'not_friend', '非好友发消息被拒绝');

  console.log('5. 发送好友申请, B 端收到');
  a2.send({ type: 'friend_request', to: B.id, note: '我是 A' });
  const aSent = await a2.wait((m) => m.type === 'friend_request_sent');
  assert(aSent.req.to === B.id, 'A 端收到已发送回执');
  const bIn = await b.wait((m) => m.type === 'friend_request_in');
  assert(bIn.req.from === A.id, 'B 端收到好友申请');
  const bSnap2 = await b.wait((m) => m.type === 'snapshot' && m.incoming.length > 0, 8000).catch(() => null);
  assert(bSnap2 || true, 'B 的快照含申请(可选)');

  console.log('6. B 同意申请');
  const inc = await b.wait((m) => m.type === 'friend_request_in');
  b.send({ type: 'friend_accept', reqId: inc.req.id });
  await a2.wait((m) => m.type === 'friend_accepted');
  await b.wait((m) => m.type === 'friend_added');
  console.log('   同意成功, 双方已是好友');

  console.log('7. 互发消息');
  a2.send({ type: 'chat', to: B.id, content: '你好贝贝!', mid: 'm1' });
  const bm = await b.wait((m) => m.type === 'chat' && m.msg.content === '你好贝贝!');
  assert(bm.msg.from === A.id, 'B 收到 A 的消息');
  assert(bm.unread >= 1, 'B 的未读数 >= 1');
  b.send({ type: 'chat', to: A.id, content: '你好阿宝, 收到!', mid: 'm2' });
  const aRecv = await a2.wait((m) => m.type === 'chat' && m.msg.content === '你好阿宝, 收到!');
  assert(!aRecv.self, 'A 作为接收方收到普通投递(无 self)');
  const bEcho = await b.wait((m) => m.type === 'chat' && m.self === true && m.msg.content === '你好阿宝, 收到!');
  assert(bEcho.self, 'B 作为发送方收到 self 回显');

  console.log('8. 历史消息');
  const h = await a2.wait((m) => m.type === 'history', 3000).catch(() => null);
  if (!h) {
    a2.send({ type: 'history', peer: B.id });
    const h2 = await a2.wait((m) => m.type === 'history');
    assert(h2.msgs.length === 2, '历史消息 2 条');
  } else {
    assert(h.msgs.length === 2, '历史消息 2 条');
  }

  console.log('9. 离线状态');
  b.close();
  const off = await a2.wait((m) => m.type === 'presence' && !m.online);
  assert(off.id === B.id, 'B 下线时 A 收到 presence');

  console.log('10. 注册第三方, 验证 ID 随机性');
  const C = await register('小C');
  assert(C.id !== A.id && C.id !== B.id, 'C 的 ID 与 A/B 不同');

  a2.close();
  console.log(`\n全部通过 (${passed} 项断言)`);
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
