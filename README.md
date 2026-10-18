# M3 Chat

一个 Material Design 3 风格的类微信聊天网站: Node.js + WebSocket, 无需数据库, 开箱即用。

## 功能

- **随机 ID**: 注册时输入昵称, 系统自动生成 8 位随机英数字 ID (如 `9K7SMNFH`)
- **搜索添加**: 在「联系人」中搜索 ID 或昵称, 找到对方后发送好友申请
- **需对方同意**: 好友申请必须对方点击「同意」后才能开始聊天, 拒绝/删除好友均已实现
- **实时聊天**: 基于 WebSocket 的即时消息, 支持历史消息、未读计数、在线/离线状态
- **M3 风格 UI**: 遵循 Material Design 3 设计规范 (色彩/圆角/组件形态), 响应式适配移动端

## 运行

```bash
# 安装依赖
npm install

# 启动服务 (默认 3000 端口)
npm start
```

浏览器打开 `http://localhost:3000`, 输入昵称即可进入。

自定义端口:

```bash
PORT=8080 npm start
```

## 测试

```bash
# 需要先启动服务, 然后运行端到端测试 (模拟两个用户完整流程)
node test/e2e.js
```

## 架构

```
server.js      HTTP 静态服务 + REST 注册/校验 + WebSocket 服务端
public/        前端页面 (原生 JS, 无框架)
  index.html   登录 / 聊天 / 联系人 / 我的 四大区域 + 用户卡片弹窗
  css/style.css Material Design 3 设计令牌与组件样式
  js/app.js    状态管理、WS 协议、渲染
data/db.json   运行时数据 (用户/好友/申请/消息), 自动持久化
test/e2e.js    端到端测试
```

### 核心流程

1. `POST /api/register` 创建用户, 分配随机 ID 与会话 token
2. 浏览器以 token 建立 `ws://host/ws` 连接, 服务端推送 `snapshot`
3. `search` 指令按 ID/昵称查找用户 → `friend_request` 发起申请
4. 对方 `friend_accept` 同意后双方进入好友关系, `chat` 指令互发消息
5. `presence` 指令广播上下线, `history` 拉取历史消息, `mark_read` 消除未读
