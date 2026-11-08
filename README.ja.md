# TimeLeft

<p><img src="docs/icon.svg" width="96" height="96" alt="TimeLeft"></p>

[English](README.md) · [简体中文](README.zh-Hans.md) ·
[繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [한국어](README.ko.md)
· [Español](README.es.md)

選んだ寿命から現在の秒まで、10個の入れ子 range の残り／経過時間を見る独立 local
web instrument。account／remote service は不要で、個人日付の default
はありません。

## 画面例

![TimeLeft — Demo person](docs/demo/timeleft-en.png)

実際のアプリ画面です。合成データとして Demo person、2000-01-01 生まれ、目標寿命
80 年を使用しています。表示時間は時計に応じて変わります。この画像の UI
は英語です。

## 表示

名前／誕生日／目標寿命を設定。部分日付／estimated は approximate
のままです。Contours／Digits、Remaining／Elapsed、各 range unit を直接切替。UI
は en／繁体字／簡体字、theme と System／Pixel。README翻訳は UI
言語を増やしません。

## 保存と import

browser／origin ごとの data。backup 後に site data
消去や他端末へ移ります。family.lifeCountdown、time.display、time.preferences、time.lifeProfile
を含む Prometheus export を preview して明示適用。source
ID一致の既存人物は上書きせず、legacy settings は backup保持。TimeLeft backup
は確認後置換。最大1000people／5MB、原ファイル／Prometheus data
を変えません。初回online後、対応service worker originでoffline
reload／editを提供しUIが可用性を表示。

## 実行と限界

deno bundle 対応 Deno、deno task build → preview（loopback URL）。check は
model／locale／calendar fixtures。source／build は実 browser
保存、device、導入、DST等全環境の証明ではありません。今回は personal data
import、source削除、service操作なし。

ビルドには、変更していないプロジェクトのライセンス `dist/LICENSE.txt`
と、既存フォントの全通知・来歴をまとめた `dist/font-notices.txt` も含まれます。

## Source と権利

ソースは GPL-3.0-only を保持。codingEzio 作のコードを TimeLeft 向けに適応し、
カレンダーと表示を変更しています。external artwork／runtime
service／CDN追加なし。任意DeparturePixelZh CompactのOFL1.1／component
notices保持。ビルドの公開とアプリのホスティングは別判断。

Font preparation / 字型準備 / 字体准备: see [README](README.md#font-preparation).
