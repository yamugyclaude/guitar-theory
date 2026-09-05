# Guitar Theory App 진행 기록
생성일: 2026-06-23
배포 URL: https://yamugyclaude.github.io/guitar-theory/
저장소: https://github.com/yamugyclaude/guitar-theory
스택: Vanilla JS (ES Modules) · No bundler · GitHub Pages · Supabase

---

## 반복하면 안 되는 실수
- localStorage 키 이름 추측 금지 — 반드시 grep으로 확인. 확정 키: `gta_supabase_cfg`, `gta_settings`.syncKey, `gta_gemini_key`, `gta_sheet_meta`, `gta_chart_drafts`, `gta_setlists`
- `firebase-sync.js` 참조 금지 (폐기 파일)
- 캐시 삭제 안내 시 "사이트 데이터" 체크 경고 필수 — IndexedDB(악보 파일) 유실됨
- 브랜치: 작업은 `claude/...` 브랜치 → main 머지 → GitHub Pages 자동 배포

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
