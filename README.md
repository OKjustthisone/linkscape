# Linkscape

面向 Chrome 的液态玻璃书签管理扩展：鼠标靠近页面左侧（或右侧）边缘的指定高度范围时，自动展开书签面板；支持收藏栏、搜索（含中文拼音）、文件夹浏览与批量管理，并提供完整管理页与设置页。

## 功能

- **边缘悬停展开**：默认左侧 14px 触发区，可切换左右停靠；触发高度范围按视口百分比配置（含预设），范围外悬停不弹出
- **面板尺寸与缩放**：设置面板宽度和高度（默认全高度）；通过 Chrome 标签页缩放因子反向补偿，面板不会随网页缩放改变物理尺寸
- **Shadow DOM 隔离**：面板样式与网页完全隔离，增强 `backdrop-filter` 毛玻璃材质、较高不透明度 + 深色模式适配 + 无玻璃支持时的实色回退
- **书签树 + 收藏栏**：收藏栏保存在 `chrome.storage.local`（书签 id 列表），不改变 Chrome 原生书签层级；书签被外部删除时自动清理失效项
- **列表显示**：书签每行只显示名称和真实网站图标；Chrome favicon 服务不可用时回退到网站 `/favicon.ico`
- **搜索**：标题 / 网址 / 域名 / 文件夹路径 + 中文拼音全拼（开发文档 → kaifawendang）与首字母（→ kfwd），120ms 防抖、结果高亮、键盘导航
- **管理操作**：新建书签 / 文件夹、重命名、移动、复制、删除（含确认），多选批量操作；删除后 8 秒内可撤销；禁止把文件夹移入自身或后代、保护特殊根节点
- **后台打开**：点击书签在后台新建标签页（`active: false`），不抢占当前页面
- **完整管理页**：左侧文件夹树 + 右侧列表 + 全局搜索 + 批量工具栏
- **设置页**：停靠方向、触发高度范围（预设 + 自定义 + 校验）、排除规则（域名 / 网址前缀 / 通配符），即时生效
- **受保护页面**：`chrome://`、应用商店等页面无法注入面板，扩展弹窗提供完整管理页备用入口
- **快捷键**：`Alt+Shift+L` 手动打开 / 收起面板；面板内 `Ctrl+F` 聚焦搜索、`Esc` 收起

## 开发

```bash
npm install          # 安装依赖（若全局 npm 缓存损坏，可加 --cache ./.npm-cache）
npm run icons        # 生成 public/icons 下的图标 PNG
npm run build        # 构建到 dist/
npm run typecheck    # TypeScript 类型检查
npm test             # 单元测试（vitest：拼音搜索 / URL 规则 / 树工具）
```

## 加载扩展（开发模式）

1. 执行 `npm run build`
2. 打开 `chrome://extensions`，开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本目录下的 `dist/` 文件夹
4. 打开任意普通网页，把鼠标移到页面左边缘（默认）即可看到面板

也可以直接选择项目根目录 `Linkscape/` 加载。根目录的 `manifest.json` 是开发加载入口，实际脚本和页面仍来自最新构建的 `dist/`；每次修改源码后先执行 `npm run build`，再在 Chrome 中点击「重新加载」。

## 项目结构

```text
Linkscape/
├── public/
│   ├── manifest.json          # Manifest V3
│   └── icons/                 # 生成的图标
├── scripts/
│   ├── build.mjs              # 两轮构建：内容脚本(IIFE) + 页面/SW(ESM)
│   └── generate-icons.mjs     # 纯 Node PNG 图标生成
├── src/
│   ├── background/service-worker.ts   # 书签 API、收藏栏、消息路由、撤销、广播
│   ├── content/
│   │   ├── content.ts                 # 内容脚本入口
│   │   └── edge-host.ts               # 边缘触发区 + Shadow DOM + 生命周期
│   ├── panel/                          # 悬浮面板 React 应用
│   │   ├── BookmarkPanel.tsx
│   │   ├── panel-state.ts              # 数据层（SW 通信 + 广播订阅）
│   │   ├── panel-mount.tsx             # 挂载进 Shadow DOM
│   │   ├── use-undo.ts                 # 删除撤销
│   │   └── components/                 # 树 / 收藏 / 搜索 / 菜单 / 对话框
│   ├── manager/                        # 完整管理页
│   ├── options/                        # 设置页
│   ├── popup/                          # 扩展弹窗
│   ├── shared/
│   │   ├── messages.ts                 # 消息协议
│   │   ├── bookmark-types.ts
│   │   ├── settings.ts
│   │   ├── search-index.ts             # 拼音搜索索引
│   │   ├── url-matcher.ts              # 域名 / URL / 通配符匹配
│   │   └── tree-utils.ts               # 纯函数树操作（可单测）
│   └── styles/
│       ├── panel.css                   # Shadow DOM 面板样式
│       └── glass.css                   # 扩展页面共享样式
├── manager.html / options.html / popup.html
└── DEVELOPMENT_PLAN.md
```

## 技术要点

- Chrome Manifest V3、TypeScript、React 18、Vite 5
- 内容脚本构建为单个 IIFE 文件（`assets/content.js`），Service Worker 为 ES Module（`assets/background.js`）
- 面板与 SW 通过 `chrome.runtime.sendMessage` 通信（书签 API 仅在 SW 中调用）
- 书签变化（`onCreated/onChanged/onMoved/onRemoved`）广播到所有标签页自动刷新
- 权限最小化：`bookmarks`、`storage`、`tabs`、`favicon`

## 已知边界

- 拖拽排序作为增强功能暂未实现（计划中说明可放到下一版本）
- 千级书签的虚拟列表暂以「搜索结果上限 200」替代，索引已做缓存
- 撤销仅在删除后 8 秒内、且为同一会话内最近一次删除快照
