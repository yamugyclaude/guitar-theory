# Guitar Theory App 진행 기록
생성일: 2026-06-23
배포 URL: https://yamugyclaude.github.io/guitar-theory/
저장소: https://github.com/yamugyclaude/guitar-theory
스택: Vanilla JS (ES Modules) · No bundler · GitHub Pages · Google Drive

---

## 반복하면 안 되는 실수
- localStorage 키 이름 추측 금지 — 반드시 grep으로 확인. 확정 키: `gta_settings`, `gta_gemini_key`, `gta_sheet_meta`, `gta_chart_drafts`, `gta_setlists`, `gta_drive_logged_in`, `gta_drive_folder_id`
- `supabase-sync.js` / `firebase-sync.js` 참조 금지 (2026-09-21 삭제됨)
- 캐시 삭제 안내 시 "사이트 데이터" 체크 경고 필수 — IndexedDB(악보 파일) 유실됨
- 브랜치: 작업은 `claude/...` 브랜치 → main 머지 → GitHub Pages 자동 배포
- **동기화 후 화면 갱신 필수** — `pullAll()`은 localStorage만 바꾼다. 갱신하려면 `app.js`의 `refreshCurrentTab()`을 반드시 같이 호출할 것 (2026-09-21 회귀 사고)
- **악보는 메타데이터와 파일이 따로 논다** — `gta_sheet_meta`(목록)와 IndexedDB(실제 파일)는 별개. 목록만 동기화하고 파일을 빠뜨리면 "악보 없음"이 난다
- 실패를 `console.warn`으로만 처리 금지 — 사용자가 모른다. `showToast`로 알릴 것

---

## [2026-09-21] 성공

### 작업 내용
- 사장님 요청: 저장 구조(localStorage + IndexedDB + Supabase)가 복잡하다 → 구글 드라이브 하나로 단순화
- `supabase-sync.js`, `firebase-sync.js` 삭제 → `drive-sync.js` 신규 (GIS OAuth + Drive REST API v3를 fetch로 직접 호출, gapi 미사용)
- scope는 `drive.file` (앱이 만들거나 사용자가 피커로 고른 파일만) — 권한 최소화
- 구글 피커 연동: 드라이브에 올려둔 악보를 **고른 순서대로** 세트리스트에 추가 (사장님 공연 워크플로우)
- 세트리스트는 기존 `gta_setlists` 구조 재사용 (공연별로 여러 개 저장) — 신규 구조 안 만듦
- 악보를 열 때 로컬에 없으면 드라이브에서 즉시 받아옴 (`fetchSheetFromDrive`) — 공연 중 안전장치

### 결과
- 성공: 컴퓨터 → 아이패드 동기화, 악보 다운로드까지 사장님이 실기기로 확인 완료
- 드라이브 폴더 `기타이론`은 앱이 자동 생성, 사장님이 원하는 위치로 옮겨도 폴더 ID 유지되어 계속 동작
- 파일명은 곡 제목 + 확장자. 재조회는 이름이 아니라 `appProperties.sheetId`로 하므로 이름 변경에 안 깨짐

### 배운 것 / 반복하면 안 되는 실수
- **Supabase를 걷어내면서 화면 갱신 기능이 같이 사라진 회귀 발생** — 기능을 제거할 때 그 기능이 제공하던 부수 효과(여기선 `subscribeDataChanges` → UI 갱신)까지 목록으로 확인할 것
- 새 기기는 localStorage가 비어있어 자동 로그인 조건문을 안 타고 **조용히 옛 데이터를 보여줌** — 신규 기기 진입 경로를 항상 따로 테스트할 것
- "지금 동기화" 버튼처럼 **경로가 여러 개인 기능은 전부 같은 일을 하는지 확인** — 동기화 경로 3곳 중 1곳만 악보 파일을 빠뜨려 버그가 됨
- 감사실장이 지적한 `openSheet`의 끊어진 참조(`getFolders`, `renderFolderTree`)는 이번 작업 이전부터 있던 기존 버그였음 — 같이 수정

### 성공 루틴 (재사용 가능한 방법)
- **브라우저 실행 검증**: `python3 -m http.server 8000` + Playwright(`/opt/node22/lib/node_modules/playwright`)로 탭별 `pageerror` 수집 → 배포 전 JS 에러 0건 확인. OAuth가 필요 없는 범위는 이 방법으로 직접 검증 가능
- 자격증명(클라이언트 ID·API 키)은 웹에 공개되는 값이라 하드코딩 가능. 단 콘솔에서 origin 제한 필수

### 배포 이력
- 배포: GitHub Pages (main 자동 배포), 2026-09-21
- 주요 커밋: `b2b1fc1`(드라이브 전환) → `2cfb7b8`(악보 자동 내려받기)

---

## [2026-09-05] 성공

### 작업 내용
- 모바일 화면 UX 개선 요청: 하단 탭바가 불편하다는 피드백 → 첫 화면을 카테고리 버튼 그리드로 변경
- 모바일 전용(max-width:767px)으로 하단 탭바(`#tab-nav`) 숨기고, 대신 첫 화면에 10개 카테고리 버튼 그리드(`#mobile-home`) 표시
- 카테고리 버튼 클릭 시 해당 페이지가 전체화면으로 열림
- 각 페이지 우측 상단에 "🏠 첫 화면" 버튼 추가 → 클릭 시 카테고리 그리드로 복귀
- PC/태블릿 화면(사이드바 방식)은 변경 없음

### 결과
- 헤드리스 브라우저(390x844 모바일 뷰포트)로 동작 확인: 첫 화면 그리드 표시 → 버튼 클릭 시 페이지 전환 → 홈 버튼으로 복귀, 모두 정상
- `claude/mobile-category-navigation-tosqqe` 브랜치 → main 머지 → GitHub Pages 자동 배포

### 수정 파일
- `index.html` — 모바일 홈 그리드(`#mobile-home`), 홈 복귀 버튼(`#mobile-back-btn`) 추가
- `css/style.css` — 모바일 미디어쿼리 내 하단 탭바 숨김 + 홈 그리드/홈 버튼 스타일
- `js/app.js` — `switchTab`에 `mobile-tab-open` 클래스 토글 추가, `goHome()` 함수 추가

### 후속 수정 (같은 날)
- 버그: 첫 화면 버튼(플로팅, top:8px right:8px)이 페이지 자체 헤더 버튼(예: 악보 보관함의 ☁️/업로드 버튼)과 겹침
- 수정: 플로팅 버튼 → 전체 폭 상단 바(`#mobile-back-bar`)로 변경, `#main-content`에 padding-top 38px 부여해 항상 페이지 콘텐츠 아래로 내려서 겹침 방지

### 후속 수정 2 (같은 날) — 진짜 원인 발견
- 원인: 모바일에서 하단 탭바(`#tab-nav`)를 통째로 숨기면서, 그 안에 있던 기존 "강력 새로고침" 버튼도 같이 사라짐 → 사장님이 폰에서 새로고침해도 캐시된 구버전 css/js가 계속 로드됨
- 수정: 첫 화면(`#mobile-home`)에 새로고침 버튼 추가, `css/style.css`·`js/app.js`에 버전 쿼리(`?v=`) 부여해 새로고침 시 최신 파일 확실히 받도록 함

### 후속 수정 3 (같은 날) — 동기화 범위 전체 확장
- 요청: "데이터는 모두 동기화가 되어야" → 곡진행/셋리스트/악보목록 3개만 자동 동기화되던 것을 설정·테마·Gemini API 키·라이브 줌 값까지 전부 자동 동기화되게 확장
- 악보 실물 파일(PDF/이미지)도 기존엔 새 기기에서 ☁️ 버튼을 수동으로 눌러야 받아졌는데, 앱 시작 시 자동으로 백그라운드에서 받아오도록 변경
- 수정 파일: `js/supabase-sync.js`(DATA_KEYS 확장, JSON/원시값 구분 처리), `js/sheets.js`(`pullMissingSheetFiles()`로 분리), `js/app.js`(시작 시 자동 호출)

---

## [2026-06-23] 성공

### 작업 내용
- Supabase 설정(URL·anon key·동기화 키) 코드 내장 → 기기마다 수동 입력 불필요
- 사이드바 하단에 날짜 기반 버전 표시 추가 (`v2026.06.23`)
- AI API 무료 대안 안내 (Gemini 한국 차단 이슈 → OpenRouter/Groq 권장)

### 결과
- 어느 기기에서 접속해도 Supabase 자동 연결 (설정 입력·저장·연결 테스트 불필요)
- 강력 새로고침 버튼 아래 `v2026.06.23` 표시 — 캐시 구버전 여부 즉시 확인 가능
- AI API: 현재 Gemini 키 작동 안 됨(한국 IP 차단 추정) → OpenRouter(`sk-or-` 키) 권장

### 수정 파일
- `js/supabase-sync.js` — DEFAULT_CFG, DEFAULT_SYNC_KEY 내장
- `js/app.js` — Supabase 자동 연결 조건 제거 (항상 연결)
- `js/settings.js` — 설정 탭 입력칸 기본값 표시
- `js/sheets.js` — 업로드 시 cfg 없어도 자동 연결
- `index.html` — 버전 표시 `v2026.06.23` 추가

### 배포 이력
- 배포 일시: 2026-06-23
- 브랜치: `claude/optimistic-goldberg-lcusrn` → main 머지 → GitHub Pages 자동 배포
