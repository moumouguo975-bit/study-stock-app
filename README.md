# 📱 学财助手 Pro (Study & Finance Hub)

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android%2010%2B%20(Capacitor%206)-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
  <img src="https://img.shields.io/badge/Music-MusicFree%20Plugin%20Engine-6366F1?style=for-the-badge" alt="MusicFree" />
  <img src="https://img.shields.io/badge/OCR-Web%20OCR%20%2F%20RapidOCR%20%2F%20Umi--OCR-059669?style=for-the-badge" alt="OCR" />
  <img src="https://img.shields.io/badge/AI%20Pet-Panda%20Assistant-F59E0B?style=for-the-badge" alt="Panda AI" />
  <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions%20Auto%20APK-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="Actions" />
</p>

<p align="center">
  <b>零服务器、云端自动编译的全能学习、多周课表、MusicFree 插件化音乐、高精度 OCR、AI 小熊猫桌宠与全球股市 Android 助手</b>
</p>

<p align="center">
  <a href="https://github.com/moumouguo975-bit/study-stock-app/actions/workflows/build_android_apk.yml"><b>⬇️ 前往最新 APK 云端下载页</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/moumouguo975-bit/study-stock-app/releases"><b>📦 Releases 发行版下载</b></a>
  &nbsp;·&nbsp;
  <a href="#-下载与安装"><b>📖 下载教程</b></a>
  &nbsp;·&nbsp;
  <a href="#-musicfree-插件化音乐配置"><b>🧩 MusicFree 插件</b></a>
  &nbsp;·&nbsp;
  <a href="#-ai-小熊猫与-ocr-配置"><b>🐼 小熊猫 & OCR</b></a>
</p>

---

## ⬇️ 下载与安装

本项目全程由 **GitHub Actions** 自动编译打包 Android `.apk`，无需本地安装 Android Studio（支持 Android 10 / API 29 及以上手机）。

### 方式一：下载最新云端自动构建版（推荐）
1. 点击直达 👉 [**GitHub Actions · Build Android APK 下载页**](https://github.com/moumouguo975-bit/study-stock-app/actions/workflows/build_android_apk.yml)
2. 点击列表中最新一条带 **绿色对勾（✅ Success）** 的构建记录。
3. 点击页面顶部信息栏 **`Artifacts` 下方的数字 `1`**（或直接把页面拉到最底部）。
4. 点击 **`StudyStockApp-Android-APK`** 下载 `.zip` 压缩包，解压得到 `app-debug.apk` 并安装到手机即可。

### 方式二：前往 Releases 页面下载
- 点击直达 👉 [**GitHub Releases 发行版页面**](https://github.com/moumouguo975-bit/study-stock-app/releases)

> 💡 **Fork 自用**：Fork 本仓库后，在自己仓库的 **Actions** 页面点击 **Run workflow**，约 1~2 分钟即可生成专属 APK。

---

## ✨ 核心功能全景

### 1. 📅 多周次智能课表、考试倒计时 & 批量导入
- **学期周次管理**：支持设置学期总周数与第 1 周开课日期，自动计算当前周次；顶部支持 `◀ / 第 N 周 / 全部周 / ▶` 秒切。
- **不同周不同课**：每门课程支持自由配置 **起始周～结束周**、**每周 / 仅单周 / 仅双周 / 自定义周次（如 `1,3,5,8-12`）**，同一时段不同周次互不冲突。
- **多条批量导入**：课表与考试/日程页面均提供 **「📋 批量导入」**（一次粘贴多行文本自动解析周次、节次、时间与地点）以及 **「📷 识图导入」**（拍照/选图一次勾选导入多门课程或多条日程）。
- **关掉 App 依然准时响**：支持一键写入手机底层 **系统时钟闹钟**（支持周期循环）与 **系统原生日历**，并内置 15 秒连续响铃界面与震动提醒。

### 2. 🐼 内置可对话 AI 小熊猫桌宠
- **贴边自动吸附隐藏**：可爱悬浮矢量小熊猫支持自由拖拽；拖近手机左/右侧边松手时，**自动贴边并收起半身隐藏**，不遮挡内容；轻点一下滑出展开，再点打开 AI 对话窗口。
- **自定义大模型 API Key**：支持 DeepSeek、硅基流动（含免费额度）、通义千问、智谱 GLM、OpenAI 及任意 OpenAI 兼容接口，Key 仅安全存储在手机本地。
- **懂你日程的学习搭子**：支持读取当日课表、近期考试与天气作为对话上下文，内置快捷提问；可在 **「🎨 设置」** 中随时开关是否显示小熊猫。

### 3. 🧩 内置 MusicFree 插件化音乐引擎 & 零占用播放器
深度兼容开源项目 [**MusicFree**](https://musicfree.catcat.work) 插件协议：
- **标准插件沙箱**：原生内置 `axios`（底层走 `CapacitorHttp` 绕过跨域）、`cheerio`、`crypto-js`、`dayjs`、`he`、`qs`、`Buffer`。
- **开箱即用 + 无限扩展**：内置 3 个兼容 MusicFree 协议的基础音源；支持一键装官方示例订阅源、粘贴任意 `.json` 订阅源 / `.js` 单插件链接，或本地导入 `.js` 插件；支持启用/停用、更新与卸载。
- **后台丝滑直连 & 同步歌词**：原生 `MusicService` 前台媒体服务自动透传插件自定义 `Referer` / `User-Agent` / `Cookie`；支持 LRC 实时滚动歌词、5 种硬件 EQ 预设、3 段均衡器、倍速、列表/单曲/随机循环。
- **零复制本地音乐 & 白噪音**：Android SAF 持久化 URI 原路径直读本地音乐（0MB 复制）；内置 4 种离线助眠白噪音与定时关闭。

### 4. 🧠 三模高精度 OCR（免费网页版默认 + 离线/Umi-OCR 备选）
- **🌐 免费网页版 OCR（默认推荐）**：接入免费网页接口（OCR.space Engine 2/3），支持中英混排、表格结构还原与手写体增强，前端自动将高清图压缩至 `<820KB` 提升成功率；内置免费公共 Key 开箱即用，也可免费领取个人专属 Key（2.5 万次/月）。
- **⚡ 本机离线 OCR（断网兜底）**：手机本地集成 Umi-OCR 同源 RapidOCR / PP-OCR 离线引擎，无网环境照常识别。
- **🖥️ 远程 Umi-OCR 服务**：支持对接电脑局域网/自建 [**Umi-OCR**](https://github.com/hiroi-sora/Umi-OCR) HTTP 接口。
- 全场景覆盖：课表识图、日程识图、资料库图片/PDF（支持多页）识别、翻译页识图翻译；同时保留 `.docx` / `.xlsx` / `.pptx` / `.txt` 本地直解。

### 5. 🎨 原位透明毛玻璃触控 & 个性化外观
- **100% 跟手原位透明毛玻璃**：取消悬浮点击小球与延迟外框；点击或手指滑动到任意按钮时，**该按钮本体即时变透明磨砂**，移开即恢复，顶栏滑选按钮松手直达。
- **底栏液态毛玻璃胶囊**：底部 6 栏导航支持手指左右连续滑动 1:1 贴手切页与震动反馈。
- **自由定制外观**：支持主题配色（预设 + 自定义取色器）、黑夜模式（浅色/深色/跟随系统）、全局毛玻璃开关、4 种字体风格与 4 档字号调节。

### 6. 🌤️ 双时区时钟、双源天气与智能建议
- 自动比对设备时区与网络时区（挂代理或跨国时同屏展示双时区参考），支持多城市自由添加、切换与删除。
- Open-Meteo + wttr.in 双源天气兜底，支持左右滑动查看 **未来 24 小时逐时预报** 与 **未来 7 天预报**，自动结合当前周次课表与近期考试给出穿衣、带伞与复习建议。

### 7. 📈 A股专区、全球股市行情与交互走势图
- GitHub Actions 每天北京时间 `08:30` 与 `22:30` 自动抓取 **A股 6 大指数 + 港/美/欧亚 18 大股指 + 25 只全球龙头股** 与每日财经头条。
- 东方财富 + Yahoo Finance 双引擎全网任意搜股；支持 `5日分时 / 1月 / 3月 / 1年` 切换与**手指左右滑动十字准星精读价位**。

### 8. 🌐 词典级多语言翻译 & 例句双击跳译
- 聚合有道词典 + FreeDictionary + Google + MyMemory，支持 9 种语言互译，展示英/美音标、词性释义、常用短语与双语例句。
- **容错双击跳译**：连续点击例句中任意英文单词两下直接跳转查词（带邻近词吸附容错，手指微偏也能稳稳命中）；支持读原文、读译文与 **🗣️ 中外双语连读**。

---

## 🧩 MusicFree 插件化音乐配置

1. 打开底部 **「🎵 音乐」** 页面，点击右上角 **「🔌 插件管理」**。
2. 支持 3 种添加方式：
   - 点击 **「⚡ 装官方示例源」** 一键安装示例插件合集；
   - 粘贴社区分享的 `.json` 订阅源或 `.js` 单插件链接点击 **安装**；
   - 点击 **「📁 本地 .js」** 导入手机本地插件文件。
3. 插件生态与编写规范详见 👉 [MusicFree 官网](https://musicfree.catcat.work)。

---

## 🐼 AI 小熊猫与 OCR 配置

### 配置小熊猫 API Key
1. 轻点屏幕侧边吸附的小熊猫唤出，再点打开对话窗 → 点击 **「🔑 设API Key」**（或在右上角 **「🎨 设置 → 5. 显示可对话 AI 小熊猫」** 进入）。
2. 选择服务商预设（如 DeepSeek、硅基流动、智谱 GLM、通义千问、OpenAI 或自定义接口），粘贴你的 `API Key` 保存即可开始对话。
3. 不需要时，可在 **「🎨 设置」** 里关闭小熊猫显示开关。

### 配置 OCR 引擎
1. 默认已开启 **🌐 免费网页版 OCR（OCR.space Engine 2）**，装好即可直接使用。
2. 若偶尔触发公共 Key 限流，可打开 **「🎨 设置 → 8. OCR 文字识别引擎设置」**，点击右上角 **「领免费 Key ↗」** 免费领取个人专属 Key（2.5 万次/月）填入保存，或随时切换至 **Engine 3（手写增强）** / **本机离线 OCR** / **远程 Umi-OCR**。

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
│   └── index.html                         # 移动端 UI、原位透明毛玻璃与小熊猫桌宠样式
├── src/
│   ├── app.js                             # 核心主入口（外观/触控/天气/音乐/股市/翻译）
│   ├── schedule-pro.js                    # 多周次课表（单双周/自定义周）与批量导入模块
│   ├── ocr-web.js                         # 免费网页版 OCR（自动压缩）+ 三模识别桥接模块
│   └── panda-pet.js                       # 可吸附隐藏 AI 对话小熊猫桌宠模块
└── .github/
    └── workflows/
        ├── update_stocks.yml              # 定时任务：每天自动更新全球股市数据
        └── build_android_apk.yml          # 云端编译：配置镜像源、注入原生服务并输出 APK
```

---

## 🙏 开源致谢

- [MusicFree](https://musicfree.catcat.work) — 插件化、无广告的免费音乐播放器插件规范
- [Umi-OCR](https://github.com/hiroi-sora/Umi-OCR) — 开源高精度离线 OCR 工具与 HTTP 接口规范
- [RapidOCR4j-Android](https://github.com/hzkitty/RapidOCR4j-Android) — 基于 RapidOCR / PP-OCR ONNX 的 Android 离线识别库
- [OCR.space](https://ocr.space/) — 免费高精度多语言网页 OCR API
- [Capacitor](https://capacitorjs.com/) — 跨平台原生移动应用运行时
