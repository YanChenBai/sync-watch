# Sync Watch

基于 WebRTC 的点对点同步观影：房主在本机播放视频，观看者用浏览器实时收看。
播放 / 暂停 / 进度 / 倍速由房主统一控制，而**音量、全屏、投屏都是每个观看者自己的本地设置**，
调节它们不会影响房主和其他观看者。

## 快速开始

```bash
vp install     # 安装依赖
vp run dev     # 启动开发服务器（bun --watch src/index.ts）
```

打开 http://localhost:3000 。

- **房主端**：需要支持 File System Access API 的桌面版 Chrome / Edge。
- **观看端**：任意现代浏览器，包括手机。

## 目录结构

```
public/                  浏览器端（由 Bun 全栈打包）
  index.html             HTML 入口
  index.tsx              挂载入口
  global.css             设计变量 + 响应式布局
  app/
    App.tsx              应用编排：房间、会话、播放器组合
    types.ts             播放列表 / 播放状态 / 信令协议类型
    globals.d.ts         File System Access API、webkit 全屏 / AirPlay 等声明
    components/          AppHeader、ConnectionPanel、HostPlayer、ViewerPlayer、CastControls…
    hooks/               useHostPlayer、useMediaVolume、useRemotePlayback、useKeyboardShortcuts…
    lib/                 random-id、file-system、media、ice、encoding、fullscreen、webrtc-session
src/                     服务端（Elysia + Bun）
  index.ts               入口：创建应用并监听
  app.ts                 路由组合：/api/ice + 信令 + 静态资源
  config.ts              环境变量与默认值
  ice.ts                 STUN / Cloudflare TURN / OpenRelay 配置
  rooms.ts               房间与 peer 注册表
  signaling.ts           WebSocket 信令逻辑（join / forward / leave）
  types.ts               服务端类型与消息校验
  logger.ts              日志出口
```

## 键盘快捷键

房主端与观看端都支持。

| 按键              | 功能              |
| ----------------- | ----------------- |
| 空格 / K          | 播放 / 暂停       |
| ← / →（或 J / L） | 后退 / 前进 10 秒 |
| ↑ / ↓             | 调整音量          |
| M                 | 静音              |
| F                 | 全屏              |
| , / .             | 降低 / 提高倍速   |

输入框 / 下拉框聚焦时会自动让路，不会误触发。

## 全屏与音量

- 房主端和观看端都有**全屏按钮 + `F` 键**，只影响自己的屏幕。
  桌面走标准 `requestFullscreen()`，iOS Safari 自动退到
  `webkitEnterFullscreen()`。
- 观看端有独立的**音量滑块与静音按钮**（`M`、`↑`、`↓`），
  同样只作用于本地播放，不会改到别人。

## 投屏

两端都会在浏览器支持时显示投屏按钮，走标准 **Remote Playback API**：
Chrome / Edge 弹出 Cast 设备选择器，Safari 弹出 AirPlay 列表；连接成功后按钮高亮。

需要了解的限制（由浏览器规范决定）：

- 接收设备（Chromecast / Apple TV）必须**自己能够访问视频地址**。而本项目
  - 观看端播放的是 WebRTC 实时流（`srcObject`），
  - 房主端播放的是本地文件的 `blob:` 地址，

  两者都无法被接收设备拉取，因此点击投屏会给出明确提示。

- 想在大屏观看，推荐使用**系统投屏 / 屏幕镜像**（镜像整个屏幕，任何画面都能上屏）：
  - Chrome / Edge：地址栏右侧「投放」→「投放标签页」
  - iOS：控制中心 →「屏幕镜像」
  - Android：快捷设置 →「投屏 / Smart View / Cast」
  - Windows：`Win + K`；macOS：菜单栏「屏幕镜像」

## 移动端布局

- **加入房间后播放器置顶**：房间卡片自动收缩成一行（只剩「离开房间」），
  视频紧跟顶部信息栏，不用再往下滑。
- **视频留在卡片内**：播放器沿用卡片的内边距与圆角，不贴屏幕边缘；
  容器高度跟随片源宽高比，不再固定 16:9 留出多余黑边。
- **控制条只排两行**：手机原生控件已经有播放/暂停、静音、时间、全屏，
  所以自定义控制条在手机上只保留原生没有的 **±10s、音量、倍速、画质、投屏**。
- **点击目标放大**：触摸设备上按钮 40px、输入框 44px 且字号 16px
  —— 字号小于 16px 时 iOS Safari 聚焦输入框会自动放大页面。
- **快捷键卡片自动隐藏**：手机没有键盘，说明卡片不显示。
- **横屏**：隐藏房间卡片与快捷键卡片，把高度尽量留给视频。
- **不能当房主时**：手机 / Safari 没有 File System Access API，
  「作为房主」整组会被隐藏，只留加入观看和一句说明。

## 手机与局域网

- 手机只能作为**观看端**：手机浏览器没有 File System Access API，无法选择本地文件夹。
- `crypto.randomUUID()` 只在安全上下文（HTTPS / localhost）中存在。用
  `http://192.168.x.x:3000` 打开时它是 `undefined`，因此
  `public/app/lib/random-id.ts` 提供了 `crypto.getRandomValues()`（含
  `Math.random` 兜底）的降级实现，手机加入房间不会再崩。
- 自动播放策略可能拦截带声音的播放：观看端会先静音播放并显示「点击开启声音」，
  点击后即恢复正常音量。
- 建议把服务放到 HTTPS 或反向代理后，手机端体验最完整。

## 画质

房主可在工具栏切换「高清 1080p / 均衡 720p / 省流量 480p」，切换后立即对所有观看者生效。

发送端会显式设置码率上限、**分辨率上限**、`maxFramerate`、`degradationPreference`
与 `contentHint`（视频 `motion`、音频 `music`）。

**分辨率上限是刚需**：WebRTC 默认不做缩放，如果按片源原始分辨率编码，
4K60 片源会让浏览器直接编码 3840×2160，吃掉大量显存并可能把 GPU 进程打崩
（Windows 上表现为 `STATUS_BREAKPOINT`）。所以：

- 片源分辨率直接从播放器元素读取，换算成 `scaleResolutionDownBy`
  （4K → 1080p 即 `2`），并且**只采样一次后缓存**，避免重算回 `1`。
- 切换片源时会重新采样，不会沿用上一部的分辨率。
- 工具栏下方会写清降采样前后尺寸，例如 `源 3840×2160 → 编码 1920×1080`。

## 环境变量

复制 `.env.example` 为 `.env` 后填写：

| 变量                                       | 说明                                    |
| ------------------------------------------ | --------------------------------------- |
| `CF_TURN_KEY_ID` / `CF_TURN_KEY_API_TOKEN` | 可选，Cloudflare Realtime TURN 凭证     |
| `PUBLIC_OPENRELAY`                         | 默认 `true`，公共 OpenRelay 兜底        |
| `HOST` / `PORT`                            | 监听地址与端口，默认 `0.0.0.0` / `3000` |

> TURN Key 只在服务端使用，浏览器只会拿到临时 credentials。

## 校验

```bash
vp check           # 格式化 + lint + 类型检查
vp check --fix     # 自动修复
```
