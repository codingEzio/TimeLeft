# TimeLeft

<p><img src="docs/icon.svg" width="96" height="96" alt="TimeLeft"></p>

[English](README.md) · [简体中文](README.zh-Hans.md) ·
[繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [한국어](README.ko.md)
· [Español](README.es.md)

선택 수명부터 현재 초까지10개 중첩 range의 남은／지난 시간을 보는 독립 local web
instrument입니다. account／remote service가 필요 없으며 개인 날짜 default가
없습니다.

## 화면 예시

![TimeLeft — Demo person](docs/demo/timeleft-en.png)

실제 앱 화면에 합성 데이터인 Demo person, 생년월일 2000-01-01, 목표 수명 80년을
사용했습니다. 표시 시간은 시계에 따라 바뀝니다. 이 화면의 UI는 영어입니다.

## 표시

이름／생일／목표 수명을 설정합니다. 부분 날짜／estimated는 approximate로
남습니다. Contours／Digits、Remaining／Elapsed、각 range unit을 직접 바꿉니다.
UI는 en／번체／간체、theme、System／Pixel입니다. README 번역은 UI 언어를 늘리지
않습니다.

## 저장과 import

browser／origin별 data입니다. site data 삭제나 다른 장치로 이동 전 backup합니다.
family.lifeCountdown、time.display、time.preferences、time.lifeProfile이 있는
Prometheus export를 preview 후 명시 적용합니다. source ID가 같은 기존 인물을
덮지 않고 legacy settings는 backup에 보존합니다. TimeLeft backup은 확인 후
교체합니다.최대1000people／5MB、원 파일／Prometheus data는 바꾸지 않습니다.
첫online후 지원service worker origin에서offline reload／edit하며UI가 가용성을
표시합니다.

## 실행과 제한

deno bundle 지원 Deno、deno task build → preview（loopback URL）입니다. check는
model／locale／calendar fixtures입니다. source／build는 실제
browser저장、device、설치、모든DST환경 증거가 아닙니다. 이번personal data
import、source삭제、service작업 없음.

빌드에는 원본 프로젝트 라이선스 `dist/LICENSE.txt`와 기존 글꼴의 모든 고지 및
출처를 담은 `dist/font-notices.txt`도 포함됩니다.

## Source와 권리

소스는 GPL-3.0-only를 유지합니다. codingEzio가 작성한 코드를 TimeLeft에 맞게 적용하고 달력과 표시를 수정했습니다.
external artwork／runtime service／CDN추가 없음. 선택DeparturePixelZh
Compact의OFL1.1／component notices유지. 빌드 공개와 앱 호스팅은 별도 결정입니다.

Font preparation / 字型準備 / 字体准备: see [README](README.md#font-preparation).
