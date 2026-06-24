# BKPLAY-CLUB-FINDER

BKPLAY 지역별 대회에서 입력한 클럽명이 포함된 대진표를 빠르게 조회하는 웹앱입니다.
BKPLAY HTML 수집과 파싱은 GitHub Actions 또는 로컬 `data:refresh`에서 미리 수행하고, 사이트는 `public/data`의 정적 JSON만 읽습니다.
이 프로젝트는 BKPLAY 공식 서비스가 아니며, BKPLAY와 제휴되어 있지 않습니다.

## 실행

```bash
npm install
npm run dev
```

## 환경변수

`.env.example`을 참고해 데이터 수집 범위를 설정합니다. 화면의 지역과 클럽명은 최초 접속 시 비워두며, 사용자가 조회할 때마다 직접 선택하거나 입력합니다.

```bash
BKPLAY_PROVINCE_ORG_IDS=2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18
BKPLAY_LOOKBACK_DAYS=30
BKPLAY_LOOKAHEAD_DAYS=30
BKPLAY_MAX_PAGES=12
BKPLAY_MAX_TOURNAMENTS=120
BKPLAY_MAX_CATEGORIES=10000
BKPLAY_CATEGORY_CONCURRENCY=8
BKPLAY_REQUEST_DELAY_MS=40
BKPLAY_REFRESH_TIMES_KST=10:00,14:00,18:00
```

## 데이터 수집

로컬에서 데이터를 생성하려면 다음 명령을 실행합니다.

```bash
npm run data:refresh
```

생성 파일은 다음 구조로 저장됩니다.

```text
public/data/manifest.json
public/data/club-index.json
public/data/tournaments/{tnmtId}.json
```

GitHub Actions workflow `.github/workflows/refresh-bkplay-data.yml`은 매일 10시, 14시, 18시(KST)에 실행되며, 데이터가 변경되면 `public/data`를 커밋합니다.
기본 수집 범위는 BKPLAY 지역별 대회정보에서 수집일 기준 과거 30일 ~ 미래 30일 대회입니다.

지원 지역 ID는 BKPLAY 지역별 대회정보 기준입니다.

`전체 지역=""`, `서울=2`, `부산=3`, `대구=4`, `인천=5`, `광주=6`, `대전=7`, `울산=8`, `세종=9`, `경기=10`, `강원=11`, `충북=12`, `충남=13`, `전북=14`, `전남=15`, `경북=16`, `경남=17`, `제주=18`, `해외=2283`

## 검증

```bash
npm run data:refresh
npm run lint
npm run test
npm run build
```

## 데이터 소스 및 이용 제한

대회 목록, 대진표, 경기 일정 등 원천 데이터의 출처는 BKPLAY 지역별 대회정보입니다.
이 저장소는 해당 데이터를 더 쉽게 조회하기 위한 개인·비상업 목적의 보조 도구이며, BKPLAY 데이터 자체에 대한 권리를 주장하지 않습니다.

BKPLAY 데이터와 서비스명, 화면, HTML, 대회 정보의 권리는 각 권리자에게 있습니다.
데이터 소스가 BKPLAY에 있으므로 이 프로젝트와 수집 데이터를 활용한 상업적 이용, 유료 서비스 운영, 재판매, 광고·영리 목적 제공은 허용하지 않습니다.

자세한 이용 조건은 [LICENSE](./LICENSE)를 확인하세요.
