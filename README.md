# 📱 学财助手 Pro (Study & Finance Hub)

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android%20(Capacitor%206)-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
  <img src="https://img.shields.io/badge/Music-MusicFree%20Plugin%20Engine-6366F1?style=for-the-badge" alt="MusicFree" />
  <img src="https://img.shields.io/badge/OCR-Umi--OCR%20HTTP%20API-059669?style=for-the-badge" alt="Umi-OCR" />
  <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions%20Auto%20APK-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="Actions" />
</p>

<p align="center">
  <b>一款零服务器、云端自动编译的个人全能学习、音乐、OCR、天气与全球股市 Android 助手</b>
</p>

<p align="center">
  <a href="https://github.com/moumouguo975-bit/study-stock-app/actions/workflows/build_android_apk.yml"><b>⬇️ 前往云端最新 APK 下载页</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/moumouguo975-bit/study-stock-app/releases"><b>📦 Releases 历史版本</b></a>
  &nbsp;·&nbsp;
  <a href="#-下载与安装"><b>📖 安装教程</b></a>
  &nbsp;·&nbsp;
  <a href="#-musicfree-插件化音乐配置"><b>🧩 MusicFree 插件</b></a>
  &nbsp;·&nbsp;
  <a href="#-umi-ocr-服务对接指南"><b>🧠 Umi-OCR 对接</b></a>
</p>

---

## ⬇️ 下载与安装

本项目全程通过 **GitHub Actions** 自动编译打包 Android `.apk`，无需本地安装 Android Studio。

### 方式一：下载最新自动构建版（推荐，实时同步最新代码）
1. 点击直达 👉 [**GitHub Actions · Build Android APK 构建页**](https://github.com/moumouguo975-bit/study-stock-app/actions/workflows/build_android_apk.yml)
2. 点击列表中最新一条带绿色对勾（✅）的构建记录。
3. 拉到页面最底部的 **Artifacts** 区域，点击 **`StudyStockApp-Android-APK`** 下载压缩包并解压得到 `app-debug.apk`。
4. 传到安卓手机直接安装即可（若提示未知来源，允许安装即可）。

### 方式二：前往 Releases 发行页下载
- 点击直达 👉 [**GitHub Releases 发行版本下载页**](https://github.com/moumouguo975-bit/study-stock-app/releases)

> 💡 **提示**：如果你 Fork 了本仓库，只需在自己仓库的 **Actions** 页面点击 **Run workflow** 即可 3 分钟内生成属于你自己的专属 APK。

---

## ✨ 核心功能全景

### 1. 🧩 内置 MusicFree 插件化音乐引擎 & 零占用后台播放器
深度兼容开源项目 [**MusicFree**](https://musicfree.catcat.work) 插件协议：
- **标准插件沙箱**：原生实现 `axios`（底层走 `CapacitorHttp` 自动绕过跨域）、`cheerio`、`crypto-js`、`dayjs`、`he`、`qs`、`Buffer` 运行环境。
- **开箱即用 + 无限扩展**：内置 3 个兼容 MusicFree 协议的基础音源，并支持一键安装官方示例订阅源、粘贴任意第三方 `.json` 订阅源 / `.js` 单插件链接，或直接导入本地 `.js` 插件；支持启用/停用、检查更新与卸载。
- **自定义请求头后台直播**：原生 `MusicService` 前台媒体服务自动透传插件返回的 `Referer` / `User-Agent` / `Cookie`，B站等需要校验请求头的音源也可锁屏流畅后台播放。
- **LRC 同步歌词 & 硬件音效**：自动解析并实时滚动高亮同步歌词；支持 5 种硬件 EQ 预设 + 低/中/高三段均衡器 + `0.75x~1.5x` 倍速 + 列表/单曲/随机循环。
- **本地音乐零拷贝 & 白噪音**：通过 Android SAF 持久化 URI 原路径直读本地音乐（0MB 复制、添加新歌不打断播放）；内置 4 种离线助眠白噪音与定时关闭。

### 2. 🧠 全模块 Umi-OCR 高精度文字识别
全面采用开源项目 [**Umi-OCR**](https://github.com/hiroi-sora/Umi-OCR) 驱动全应用 OCR 能力（彻底移除笨重的第三方闭源 SDK）：
- **全场景统一接管**：课表识图导入、考试日程识图导入、资料库图片/PDF识别、翻译页识图翻译，全部统一由 Umi-OCR 引擎处理。
- **原生多页 PDF 渲染**：安卓底层 `PdfRenderer` 自动将 PDF 渲染为高清图像（可配识别前 1~10 页）并提交至 Umi-OCR 批量识别；同时保留 `.docx` / `.xlsx` / `.pptx` / `.txt` 本地直解。
- **排版与连通管理**：支持在「🎨 设置」中配置 Umi-OCR 服务地址、切换段落排版模式（多栏自然段/按行/单栏等），并提供一键连通测试。

### 3. 🎨 原位透明毛玻璃触控 & 个性化外观
- **100% 跟手原位透明毛玻璃**：取消所有悬浮小球与外框浮层；**点击按钮或手指滑动到任意按钮时，该按钮本体即时变为半透明磨砂毛玻璃**，移开即恢复，顶栏滑选按钮松手直达，零延迟、零掉帧。
- **底栏液态毛玻璃胶囊**：底部 6 栏导航支持手指左右连续滑动 1:1 贴手切页与轻震动反馈。
- **自由定制外观**：支持主题配色（预设 + 自由取色器）、黑夜模式（浅色/深色/跟随系统）、全局毛玻璃开关、4 种字体风格与 4 档字号调节。

### 4. 🌤️ 双时区时钟、双源天气与智能建议
- 自动比对设备时区与网络时区（挂代理或跨国时自动同屏展示双时区参考），支持多城市自由添加/切换/删除。
- Open-Meteo + wttr.in 双源天气兜底，支持左右滑动查看 **未来 24 小时逐时预报** 与 **未来 7 天预报**，并结合当日课表与近期考试倒计时自动生成穿衣、带伞与复习建议。

### 5. 📅 智能课表、考试倒计时与系统级闹钟
- 支持按星期管理课表、考试/日程/闹钟倒计时，以及 Umi-OCR 识图或文本批量解析导入。
- **关掉 App 依然准时响**：支持一键写入手机底层 **系统时钟闹钟**（支持每周循环）与 **系统原生日历**，同时提供 App 内置 15 秒响铃闹钟与震动横幅提醒。

### 6. 📈 A股专区、全球股市行情与交互走势图
- GitHub Actions 每天北京时间 `08:30` 与 `22:30` 自动抓取 **A股 6 大指数 + 港/美/欧亚 18 大股指 + 25 只全球龙头股** 与每日财经头条。
- 东方财富 + Yahoo Finance 双引擎全网任意搜股；支持 `5日分时 / 1月 / 3月 / 1年` 切换与**手指左右滑动十字准星精读价位**。

### 7. 🌐 词典级多语言翻译与双击跳译
- 聚合有道词典 + FreeDictionary + Google + MyMemory，支持 9 种语言互译，展示英/美音标、词性释义、常用短语与双语例句。
- **零位移双击跳译**：双击例句中任意英文单词直接跳转查词；支持读原文、读译文与 **🗣️ 中外双语连读**。

---

## 🧩 MusicFree 插件化音乐配置

1. 打开 App 底部 **「🎵 音乐」** 页面，点击右上角 **「🔌 插件管理」**。
2. 你可以选择以下任意一种方式添加音源插件：
   - 点击 **「⚡ 装官方示例源」** 一键导入 MusicFree 官方示例插件合集；
   - 粘贴社区分享的任意 `.json` 订阅源链接或单个 `.js` 插件链接并点击 **安装**；
   - 点击 **「📁 本地 .js」** 导入手机本地保存的 MusicFree 插件文件。
3. 更多插件编写规范与生态说明请访问 👉 [MusicFree 官方文档](https://musicfree.catcat.work)。

---

## 🧠 Umi-OCR 服务对接指南

由于 Umi-OCR 是桌面/服务端高性能离线 OCR 引擎，手机端通过 HTTP 接口与其直连：

1. 在电脑或服务器上下载并启动 [**Umi-OCR**](https://github.com/hiroi-sora/Umi-OCR/releases)。
2. 打开 Umi-OCR 的 **「全局设置 → 高级 → 允许 HTTP 服务」**，将主机设为 **`任何可用地址`**（端口默认 `1224`），并确保局域网防火墙放行 `1224` 端口（手机与电脑在同一 Wi-Fi，或通过内网穿透/自建服务器访问）。
3. 打开本 App 右上角 **「🎨 设置」**，拉到底部 **「7. Umi-OCR 引擎接口设置」**：
   - 填入电脑局域网 IP 或公网服务地址（例如 `http://192.168.1.100:1224`）；
   - 点击 **「🔌 测试连通性」** 显示连接成功即可在全 App 任意 OCR 入口使用。

---

## 📂 仓库目录结构

```text
study-stock-app/
├── package.json                           # 前端与 Capacitor / MusicFree 运行库依赖
├── capacitor.config.json                  # App 名称、包名与插件配置
├── stocks.json                            # 自定义关注的 A股与全球股指/个股清单
├── README.md                              # 项目说明文档与下载导航
├── data/
│   └── market_data.json                   # Actions 每日自动生成的股市与新闻汇总
├── scripts/
│   └── fetch_stocks.py                    # 东方财富 + Yahoo + Google News 抓取脚本
├── www/
│   └── index.html                         # 移动端 UI、原位透明毛玻璃样式与页面结构
├── src/
│   └── app.js                             # 核心业务源码（MusicFree 引擎 + Umi-OCR + 全模块）
└── .github/
    └── workflows/
        ├── update_stocks.yml              # 定时任务：每天自动更新全球股市数据
        └── build_android_apk.yml          # 云端编译：注入原生服务并生成 Android APK
```

---

## ❓ 常见问题 (FAQ)

- **Q：不装任何外部 MusicFree 插件能听歌吗？**
  - 可以。App 已预置 3 个标准 MusicFree 协议基础音源，开箱即可搜索播放；安装社区插件后可解锁更多曲库、无损音质与完整歌词。
- **Q：手机提示“无法连接 Umi-OCR”怎么办？**
  - 请检查三点：① 电脑端 Umi-OCR 是否开启且主机设为“任何可用地址”；② 手机和电脑是否在同一个局域网（或服务端公网地址可访问）；③ 地址是否包含 `http://` 和端口号（如 `http://192.168.1.10:1224`）。
- **Q：如何自定义关注自己的股票？**
  - 直接修改仓库根目录的 `stocks.json` 并提交，GitHub Actions 会自动抓取更新；也可以在 App 内直接点「🔍 全网搜」实时搜索任意股票。

---

## 🙏 开源致谢

- [MusicFree](https://musicfree.catcat.work) — 插件化、定制化、无广告的免费音乐播放器协议设计
- [Umi-OCR](https://github.com/hiroi-sora/Umi-OCR) — 免费开源的高精度离线 OCR 识别引擎与 HTTP 接口
- [Capacitor](https://capacitorjs.com/) — 跨平台原生移动应用运行时
