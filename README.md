# 📱 学财助手 Pro (Study & Finance Hub)

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android%2010%2B%20(Capacitor%206)-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
  <img src="https://img.shields.io/badge/Music-MusicFree%20Plugin%20Engine-6366F1?style=for-the-badge" alt="MusicFree" />
  <img src="https://img.shields.io/badge/OCR-Umi--OCR%20%2F%20RapidOCR%20Dual%20Engine-059669?style=for-the-badge" alt="OCR" />
  <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions%20Auto%20APK-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="Actions" />
</p>

<p align="center">
  <b>一款零服务器、云端自动编译的个人全能学习、音乐、双模离线 OCR、天气与全球股市 Android 助手</b>
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
  <a href="#-umi-ocr-双模引擎说明"><b>🧠 双模 OCR 配置</b></a>
</p>

---

## ⬇️ 下载与安装

本项目全程通过 **GitHub Actions** 云端自动编译打包 Android `.apk`，无需本地安装 Android Studio（要求 Android 10 / API 29 及以上真机）。

### 方式一：下载最新自动构建版（推荐，实时同步最新代码）
1. 点击直达 👉 [**GitHub Actions · Build Android APK 构建页**](https://github.com/moumouguo975-bit/study-stock-app/actions/workflows/build_android_apk.yml)
2. 点击列表中最新一条带绿色对勾（✅）的构建记录。
3. 滚动到页面底部 **Artifacts** 区域，点击 **`StudyStockApp-Android-APK`** 下载并解压得到 `app-debug.apk`。
4. 传到安卓手机直接安装即可（若系统提示未知来源，允许安装即可）。

### 方式二：前往 Releases 发行页下载
- 点击直达 👉 [**GitHub Releases 发行版本下载页**](https://github.com/moumouguo975-bit/study-stock-app/releases)

> 💡 **提示**：Fork 本仓库后，在自己仓库的 **Actions** 页面点击 **Run workflow** 即可 3 分钟内自动生成专属 APK。

---

## ✨ 核心功能全景

### 1. 🧩 内置 MusicFree 插件化音乐引擎 & 零占用后台播放器
深度兼容开源项目 [**MusicFree**](https://musicfree.catcat.work) 插件协议：
- **完整插件沙箱**：原生内置 `axios`（底层走 `CapacitorHttp` 自动绕过跨域）、`cheerio`、`crypto-js`、`dayjs`、`he`、`qs`、`Buffer` 运行环境。
- **开箱即用 + 无限扩展**：预置 3 个兼容 MusicFree 协议的基础音源，并支持一键安装官方示例订阅源、粘贴第三方 `.json` 订阅源 / `.js` 单插件链接，或直接导入本地 `.js` 插件；支持启用/停用、检查更新与卸载。
- **自定义请求头后台直连**：原生 `MusicService` 前台媒体服务自动透传插件返回的 `Referer` / `User-Agent` / `Cookie`，B站等需鉴权请求头的音源也可锁屏流畅播放。
- **LRC 同步歌词 & 硬件音效**：自动解析并实时滚动高亮同步歌词；支持 5 种硬件 EQ 预设 + 低/中/高三段均衡器 + `0.75x~1.5x` 倍速 + 列表/单曲/随机循环。
- **本地音乐零拷贝 & 白噪音**：通过 Android SAF 持久化 URI 原路径直读本地音频（0MB 复制、加歌不打断当前播放）；内置 4 种离线助眠白噪音与定时关闭。

### 2. 🧠 Umi-OCR 同源离线 / 远程双模高精度 OCR
全面基于 [**Umi-OCR**](https://github.com/hiroi-sora/Umi-OCR) 体系打造双模识别架构：
- **⚡ 默认：本机内置离线引擎（免电脑、断网可用）**：手机端直接集成 Umi-OCR 同源 **RapidOCR（PP-OCR ONNX 离线引擎）**，安装即用、无需任何电脑或服务器配置即可识别图片与多页 PDF。
- **🌐 可选：远程 Umi-OCR HTTP 服务**：支持在设置中一键切换为局域网/自建 Umi-OCR HTTP 服务（支持段落排版模式配置）；远程连接异常时可一键切回本机离线引擎。
- **全场景统一接管**：课表识图导入、考试日程识图导入、资料库图片/PDF识别、翻译页识图翻译全部打通；同时保留 `.docx` / `.xlsx` / `.pptx` / `.txt` 本地直解。

### 3. 🎨 原位透明毛玻璃触控 & 个性化外观
- **100% 跟手原位透明毛玻璃**：取消所有点击悬浮光球与外部浮框；**点击或手指滑动到任意按钮时，该按钮本体即时变为半透明磨砂毛玻璃**，移开即恢复，顶栏滑选按钮松手直达，零延迟、零掉帧。
- **底栏液态毛玻璃胶囊**：底部 6 栏导航支持手指左右连续滑动 1:1 贴手切页与轻震动反馈。
- **自由定制外观**：支持主题配色（预设 + 自由取色器）、黑夜模式（浅色/深色/跟随系统）、全局毛玻璃开关、4 种字体风格与 4 档字号调节。

### 4. 🌤️ 双时区时钟、双源天气与智能建议
- 自动比对设备时区与网络时区（跨国或挂代理时自动同屏展示双时区参考），支持多城市自由添加/切换/删除。
- Open-Meteo + wttr.in 双源天气兜底，支持左右滑动查看 **未来 24 小时逐时预报** 与 **未来 7 天预报**，并结合当日课表与近期考试倒计时自动生成穿衣、带伞与复习建议。

### 5. 📅 智能课表、考试倒计时与系统级闹钟
- 支持按星期管理课表、考试/日程/闹钟倒计时，以及拍照/选图/文档一键识别解析导入。
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
2. 支持 3 种安装方式：
   - 点击 **「⚡ 装官方示例源」** 一键导入官方示例插件合集；
   - 粘贴社区分享的 `.json` 订阅源链接或单个 `.js` 插件链接并点击 **安装**；
   - 点击 **「📁 本地 .js」** 导入手机本地的 MusicFree 插件文件。
3. 更多生态与插件规范请访问 👉 [MusicFree 官网](https://musicfree.catcat.work)。

---

## 🧠 Umi-OCR 双模引擎说明

打开 App 右上角 **「🎨 设置」→「7. Umi-OCR 双模引擎设置」**：

- **模式一：⚡ 本机内置离线引擎（默认推荐）**
  - 内置 Umi-OCR 同源 RapidOCR / PP-OCR 离线模型，**无需电脑、无需填 IP、断网也能用**。
  - 点击 **「🔌 检测引擎」** 提示已就绪后即可直接使用全 App 所有识图/识 PDF 功能。
- **模式二：🌐 远程 Umi-OCR HTTP 服务（进阶可选）**
  1. 在电脑或服务器启动 [**Umi-OCR**](https://github.com/hiroi-sora/Umi-OCR/releases)，进入「全局设置 → 高级 → HTTP 服务」，将主机设为 **`任何可用地址`**（端口 `1224`）。
  2. 在手机端填入电脑的**局域网 IP**（如 `http://192.168.1.100:1224`，**注意：手机上不要填 `127.0.0.1`**），点击 **「🔌 检测引擎」** 连通即可。

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
│   └── app.js                             # 核心业务源码（MusicFree + 双模 OCR + 全模块）
└── .github/
    └── workflows/
        ├── update_stocks.yml              # 定时任务：每天自动更新全球股市数据
        └── build_android_apk.yml          # 云端编译：注入原生服务与 RapidOCR 生成 APK
```

---

## 🙏 开源致谢

- [MusicFree](https://musicfree.catcat.work) — 插件化、定制化、无广告的免费音乐播放器协议设计
- [Umi-OCR](https://github.com/hiroi-sora/Umi-OCR) — 免费开源的高精度离线 OCR 识别软件与 HTTP 接口规范
- [RapidOCR4j-Android](https://github.com/hzkitty/RapidOCR4j-Android) — 基于 RapidOCR / PP-OCR ONNX 的 Android 离线文字识别库
- [Capacitor](https://capacitorjs.com/) — 跨平台原生移动应用运行时
