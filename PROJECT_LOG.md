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
