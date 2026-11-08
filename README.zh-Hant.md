# TimeLeft

<p><img src="docs/icon.svg" width="96" height="96" alt="TimeLeft"></p>

[English](README.md) · [简体中文](README.zh-Hans.md) ·
[繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [한국어](README.ko.md)
· [Español](README.es.md)

獨立的本機時間儀表，從所選壽命到當前秒數顯示十個時間範圍。可新增人物、設定出生日期與預期壽命、切換輪廓／數字和剩餘／已過，並選擇各範圍單位、主題、語言與字體。未設定日期不會自動填入個人資料。

## 字型準備

原始碼不含字型。下載 [v0.1.1 網頁版](https://github.com/codingEzio/DeparturePixelZh-OSS/releases/download/v0.1.1/DeparturePixelZh-0.1.1-web.zip)，執行 `python3 scripts/prepare_font.py /path/to/DeparturePixelZh-0.1.1-web.zip`，再執行 `deno task build`。腳本驗證 ZIP 與字型的 SHA-256；缺檔或雜湊不符時建置失敗。字型留在本機並由 Git 忽略；建置後可離線使用。 既有相符的正規檔案會重用；其他既有目標會保留並顯示錯誤。 安全準備需要 Python 支援 `O_NOFOLLOW`、`O_NONBLOCK`，且檔案系統支援硬連結；不支援時會失敗，不覆蓋目標。Termux 與 Windows 尚未測試。

元件聲明見 `assets/fonts/`。Font Logos 與 Material Design 包含標誌；此原始碼及字型發行版未解決個別圖示的權利與商標限制。使用及再散布前須確認各圖示的權利。

## 畫面示例

![TimeLeft — Demo person](docs/demo/timeleft-en.png)

真實應用程式截圖，使用合成資料：Demo person，出生於 2000-01-01，設定壽命為 80
年。顯示的時間隨時鐘變化。此截圖使用英文介面。

## 資料與備份

資料保存在目前瀏覽器和網址。可匯出備份，也可匯入 Prometheus 配置或 TimeLeft
備份；套用前會顯示預覽。Prometheus
人物不會覆蓋相同識別碼的現有人物，備份則在確認後取代本機資料。單次匯入上限 5
MB，最多 1,000 人。首次連線後，支援 Service Worker 的網址可離線重新開啟與編輯。

## 執行與授權

需要支援 `deno bundle` 的 Deno。執行 `deno task build`，再執行
`deno task preview`；`deno task check`
檢查型別、匯入與日曆計算。授權與原始引擎、字體來源見英文 README。專案採
GPL-3.0-only，字體與元件保留各自授權。

建置產物同時包含原樣的專案授權
`dist/LICENSE.txt`，以及完整現有字型聲明與來源記錄 `dist/font-notices.txt`。

## 原始碼與發布

此儲存庫提供原始碼；發布建置產物或託管應用程式需另行決定。
