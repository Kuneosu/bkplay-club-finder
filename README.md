# QUICK-BK

BKPLAY 지역별 대회에서 입력한 클럽명이 포함된 대진표를 빠르게 조회하는 웹앱입니다.
BKPLAY HTML 수집과 파싱은 GitHub Actions 또는 로컬 `data:refresh`에서 미리 수행하고, 사이트는 `public/data`의 정적 JSON만 읽습니다.

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
