# TimeLeft

<p><img src="docs/icon.svg" width="96" height="96" alt="TimeLeft"></p>

[English](README.md) · [简体中文](README.zh-Hans.md) ·
[繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [한국어](README.ko.md)
· [Español](README.es.md)

独立的本地时间仪表，从所选寿命到当前秒数显示十个时间范围。可新增人物、设置出生日期与预期寿命、切换轮廓／数字和剩余／已过，并选择各范围单位、主题、语言与字体。未设置日期不会自动填入个人数据。

## 字体准备

源代码不含字体。下载 [v0.1.1 网页版](https://github.com/codingEzio/DeparturePixelZh-OSS/releases/download/v0.1.1/DeparturePixelZh-0.1.1-web.zip)，运行 `python3 scripts/prepare_font.py /path/to/DeparturePixelZh-0.1.1-web.zip`，再运行 `deno task build`。脚本验证 ZIP 和字体的 SHA-256；缺文件或哈希不符时构建失败。字体留在本机并由 Git 忽略；构建后可离线使用。 已有匹配的普通文件会重用；其他现有目标会保留并显示错误。 安全准备需要 Python 支持 `O_NOFOLLOW`、`O_NONBLOCK`，且文件系统支持硬链接；不支持时会失败，不覆盖目标。Termux 与 Windows 尚未测试。

组件声明见 `assets/fonts/`。Font Logos 和 Material Design 包含标志；此源代码及字体发行版未解决各图标的权利和商标限制。使用及再分发前须确认各图标的权利。

## 可选 macOS 工作区服务

`scripts/service.ts` 需要现有工作区运行环境及登记项目，不会分配端口。用 `deno run -A scripts/service.ts --prepare` 生成本地设置；`--install` 检查登记后安装新 LaunchAgent，不覆盖现有生成文件、符号链接或 LaunchAgent。使用已登记端口，不自动切换。`TIMELEFT_WORKSPACE` 指定工作区根目录（默认上层）、`TIMELEFT_PROJECT` 指定登记名称（默认 `X-TimeLeft`）、`TIMELEFT_SERVICE_LABEL` 指定服务标签（默认 `org.timeleft.web`）、`TIMELEFT_PROCESS_COMPOSE` 指定执行文件（默认 `/opt/homebrew/bin/process-compose`）。名称无效或缺少运行环境、构建、管理程序、匹配登记时会报错。生成文件不纳入 Git；浏览器数据仍绑定原网址与端口。

## 界面示例

![TimeLeft — Demo person](docs/demo/timeleft-en.png)

真实应用截图，使用合成数据：Demo person，出生于 2000-01-01，设定寿命为 80
年。显示的时间随时钟变化。此截图使用英文界面。

## 数据与备份

数据保存在当前浏览器和网址。可导出备份，也可导入 Prometheus 配置或 TimeLeft
备份；应用前会显示预览。Prometheus
人物不会覆盖相同标识的现有人物，备份则在确认后替换本地数据。单次导入上限 5
MB，最多 1,000 人。首次联网后，支持 Service Worker 的网址可离线重新打开与编辑。

## 运行与授权

需要支持 `deno bundle` 的 Deno。运行 `deno task build`，再运行
`deno task preview`；`deno task check`
检查类型、导入与日历计算。授权与原始引擎、字体来源见英文 README。项目采用
GPL-3.0-only，字体与组件保留各自授权。

构建产物同时包含原样的项目许可证
`dist/LICENSE.txt`，以及完整现有字体声明和来源记录 `dist/font-notices.txt`。

## 源码与发布

此仓库提供源码；发布构建产物或托管应用需另行决定。
