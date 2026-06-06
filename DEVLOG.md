# Guitar Theory App — 개발 일지

> **배포 URL**: https://yamugyclaude.github.io/guitar-theory/  
> **저장소**: https://github.com/yamugyclaude/guitar-theory  
> **스택**: Vanilla JS (ES Modules) · No bundler · GitHub Pages (Static)

---

## 프로젝트 개요

기타 연주자를 위한 올인원 웹 앱. 서버 없이 브라우저만으로 동작하며,
모든 음악이론 로직은 순수 JS 알고리즘으로 구현.

### 9개 탭 구성

| 탭 | 기능 |
|---|---|
| 🎸 이론 분석 | 코드 진행 입력 → 키 감지, 다이어토닉 분석, 논다이어토닉 설명 |
| 🎼 코드 보이싱 | 80+ 코드 SVG 다이어그램, 복수 보이싱 슬라이드 |
| 🎯 솔로 메이킹 | 12개 스케일 SVG 프렛보드, 스타일별 가중치 |
| 🔍 솔로 분석 | 3곡 정적 분석 (Scarified / Cliffs of Dover / Surfing) |
| 🌟 스타일 라이브러리 | 5 기타리스트 × 6 릭 + ASCII TAB |
| 📂 악보 보관함 | PDF/이미지 업로드, 폴더 관리, 코드 추출 |
| 📝 코드차트 | 섹션별 코드 에디터, PNG 저장, 인쇄 |
| 🎬 라이브 모드 | 풀스크린 셋리스트 재생, 1P/2P 보기, 줌 조절 |
| ⚙️ 설정 | 8개 테마, 폰트, 왼손잡이 모드, 백업/복원, 동기화 |

### 데이터 저장

- **IndexedDB** (`GuitarTheoryApp`): 악보 파일 Blob, 페이지 이미지 Blob
- **localStorage**: 메타데이터, 폴더, 셋리스트, 차트 초안, 설정
- **Supabase** (선택): 클라우드 동기화

---

## 커밋별 작업 기록

---

### `02aaa2d` — Initial commit
- 저장소 생성 및 GitHub Pages 설정

---

### `9da46d6` — Initial commit: Guitar Theory App v1.0
첫 번째 전체 구현.

**생성 파일**
- `index.html` — 앱 셸, 9개 탭 패널, 모바일/PC 반응형 레이아웃
- `css/style.css` — 8개 CSS 테마 (`dark-pro`, `light-clean`, `blue-jazz`, `vintage-amp`, `forest`, `neon-fusion`, `sunset-rock`, `paper`), CSS 변수 기반 테마 시스템
- `js/app.js` — AppState, 이벤트 버스 (`emit`/`on`), `goTo(tab, payload)` 탭 연동, lazy 렌더링
- `js/theory.js` — 키 감지 알고리즘 (24키 점수 채점), 다이어토닉 분석, Secondary Dominant/Borrowed Chord/Tritone Substitution 감지, 스케일 추천
- `js/voicing.js` — 코드 보이싱 DB 40+개, SVG 다이어그램 렌더러, 왼손잡이 미러 모드
- `js/solo.js` — 12개 스케일, 스타일별 우선순위 맵, SVG 프렛보드
- `js/analysis.js` — 3곡 솔로 분석 데이터
- `js/library.js` — 5 기타리스트 프로필 + 릭
- `js/db.js` — IndexedDB 래퍼 (`saveSheet`, `getSheet`, `getAllSheets`, `deleteSheet`)
- `js/sheets.js` — 악보 업로드, PDF 썸네일 생성
- `js/chart.js` — 코드차트 에디터, 실시간 미리보기
- `js/live.js` — 라이브 모드 셋리스트, 풀스크린
- `js/settings.js` — 테마/폰트/왼손잡이, 전체 내보내기/가져오기 (base64 JSON)

---

### `3a62c7e` — Fix: key detection, inline onclick handlers, live fullscreen panel scope

**버그 수정 3건**

1. **키 감지 오류** (`theory.js`)
   - 증상: `Am7-D7-Gmaj7-Cmaj7` 입력 시 E minor로 잘못 감지
   - 원인: G major ↔ E minor가 동점 (4/4 다이어토닉 일치)
   - 수정: 타이브레이커 추가 — 장조 +0.1, 마지막 코드가 I도이면 +0.05

2. **inline onclick CSP 위험** (`solo.js`, `analysis.js`)
   - 원인: 템플릿 리터럴 `onclick="import('./app.js')..."` 형태
   - 수정: 모두 `addEventListener` 방식으로 교체

3. **라이브 풀스크린 panel scope 오류** (`live.js`)
   - 원인: `onclick="startFullscreen(panel, ${idx})"` — panel이 전역 스코프에 없음
   - 수정: `addEventListener('click', () => startFullscreen(panel, idx))`

---

### `3cac6b0` — Add: PNG/print for chart, expand voicing DB, 6+ licks per guitarist

**기능 강화**

- `chart.js`: PNG 저장 (html2canvas CDN 동적 import), 인쇄 기능
- `voicing.js`: 코드 보이싱 DB 80+개로 확장 (#/b 변형, maj/min/7/maj7/m7/sus2/sus4/dim/dim7/aug/9/maj9 포함)
- `library.js`: 각 기타리스트 릭 6개 이상으로 확장

---

### `c7712d4` — Add: folder management for sheet library

**악보 보관함 폴더 기능 추가**

- `sheets.js`:
  - 폴더 생성/삭제 (`gta_folders` localStorage)
  - 악보 업로드 시 폴더 지정
  - 폴더 탭 필터링
  - 악보 → 폴더 이동
  - 백업 경고 배너 (7일 이상 미백업 시)

---

### `7969534` — Fix: live fullscreen nav buttons, 1P/2P toggle, PDF canvas rendering, chord extraction

**라이브 모드 전면 재작성 + 코드 추출 기능 신설**

**라이브 모드 (`live.js`)**
- iOS iframe 터치 이벤트 차단 문제 → PDF.js canvas 렌더링으로 교체
- 1장/2장 보기 토글 버튼 추가 (`pagesPerView` 모듈 변수)
- 페이지 이전/다음, 곡 이전/다음 버튼 정상 동작
- 헤더 자동 숨김 (3초 후), 터치/마우스무브 시 복원
- 좌우 스와이프 (dx>60, dy<40) → 곡 이동
- Wake Lock API (화면 꺼짐 방지)

**코드 추출 기능 (`sheets.js`)**
- `CHORD_RE` 정규식으로 PDF 텍스트에서 코드 자동 감지
- PDF: PDF.js `getTextContent()` → 페이지별 코드 추출
- 이미지/스캔 악보: 수동 입력 fallback UI
- 추출 결과 미리보기 → "라이브 차트로 저장" 버튼

---

### `013dff9` → `e3bc008` — Fix: PDF.js loading (2 commits)

**PDF.js 로딩 방식 근본 수정**

- 증상: "PDF 렌더링 실패: Cannot read properties of undefined (reading 'workerSrc')"
- 원인: `dynamic import()`로 UMD 빌드를 불러오면 `GlobalWorkerOptions`가 undefined
- 시도 1 (`013dff9`): jsdelivr ESM(.mjs) 사용 → 실패
- **최종 수정 (`e3bc008`)**:
  - `index.html`에 `<script src>` 태그로 UMD 빌드 로드
  - `window.pdfjsLib` 전역으로 workerSrc 설정
  - `live.js`, `sheets.js` 모두 `window.pdfjsLib` 참조

```html
<!-- index.html -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
</script>
```

---

### `d8587cb` — Fix: PDF pre-render to JPEG blobs at upload

**2장 보기 렌더링 실패 근본 해결**

- 원인: 런타임에 PDF.js 캔버스 2개 동시 생성 → 모바일 메모리 한계
- 수정 방향: 업로드 시점에 전 페이지를 JPEG blob으로 변환해서 IndexedDB에 저장

**변경 파일**
- `db.js`: `updateSheet(id, updates)` 함수 추가 (기존 레코드 부분 업데이트)
- `sheets.js`:
  - `prerenderPdfPages(file)` — PDF.js로 전 페이지 → canvas → JPEG blob 배열 (scale 1.8)
  - `uploadSheet()` 에서 업로드 후 페이지 변환 실행, "PDF 변환 중..." 진행 표시
  - `updateSheet(id, { pages })` 로 IndexedDB에 저장
- `live.js`:
  - `renderContent()` — `record.pages` 배열 있으면 `<img>` 태그 사용 (PDF.js 불필요)
  - 이전 업로드 파일(pages 없음)은 PDF.js 폴백으로 처리

---

### `6c22d8d` — Feat: live mode auto-fit + zoom control

**라이브 모드 이미지 크기 문제 해결**

- 증상: PDF/이미지가 `width:100%` 적용으로 화면보다 크게 확장됨
- 수정:
  - 기본값: 화면 높이 기준 자동 맞춤 (`height: calc(100dvh - 140px)`, `object-fit: contain`)
  - 차트 콘텐츠: 블록 레이아웃 + 스크롤 유지
  - PDF.js 폴백: 화면 높이에서 스케일 계산

**줌 컨트롤 추가**
- 하단 네비게이션에 `−` / `맞춤` / `+` 버튼
- 9단계 배율: 40% → 50% → 60% → 75% → **맞춤(100%)** → 125% → 150% → 200% → 250%
- `live-img` 클래스로 줌 일괄 적용
- 곡 이동/페이지 이동 후에도 줌 유지

**네비게이션 레이아웃**: 6열 그리드 (이전곡 / ◀페이지 / ▶페이지 / 줌 그룹 / 다음곡)

---

### `a3407a6` — Feat: sub-folders, multi-file upload, Firebase cloud sync

**악보 보관함 3가지 기능 추가**

**① 하위폴더**
- `sheets.js`:
  - `gta_folders` 포맷 변경: `string[]` → `[{id, name, parentId}]`
  - 구버전 자동 마이그레이션 (첫 로드 시 1회)
  - `rootFolders()`, `subFolders(pid)`, `folderById(id)`, `folderLabel(id)` 헬퍼
  - 루트 폴더 선택 시 하위폴더 행 표시
  - `+ 하위폴더` 버튼으로 생성 (id: `ParentName/ChildName`)
  - 루트 폴더 필터 시 하위폴더 파일 포함
  - 폴더 삭제 시 하위폴더도 일괄 삭제 (파일 유지)

**② 복수 파일 업로드**
- `<input type="file" multiple>` 적용
- 2개 이상 선택 시 파일명 → 자동 곡명 (아티스트/키/태그 공통 적용)
- 진행 표시: "저장 중... (2/5)" → "PDF 변환 중..." → "☁️ 업로드 중..."

**③ Firebase 클라우드 동기화** (다음 커밋에서 Supabase로 교체)
- `firebase-sync.js` 신규 생성 (나중에 폐기)
- 업로드 시 자동 push, 삭제 시 자동 remove
- `☁️ 동기화` 버튼 → `syncFromCloud()` 원격 파일 다운로드

---

### `2c69220` — Refactor: replace Firebase sync with Supabase

**Firebase → Supabase 교체**

| | Firebase | Supabase |
|---|---|---|
| 설정 입력 | JSON 9개 필드 | URL + anon key 2개 |
| 저장소 | Firestore + Storage | PostgreSQL + Storage |
| 오픈소스 | ✗ | ✓ |
| 무료 비활성 | 유지 | 1주 미사용 시 일시정지 |

**변경 파일**
- `supabase-sync.js` 신규 생성:
  - `connect()` — `@supabase/supabase-js@2` (esm.sh CDN) 동적 import
  - `pushSheet(id, file, pages, meta)` — Storage(`gta-sheets`) + Table(`gta_sheets`)
  - `pullAll()` — sync_key 필터로 원격 메타 전체 조회
  - `fetchBlob(url, mime)` — 파일 다운로드
  - `removeSheet(id)` — DB + Storage 파일 삭제
- `settings.js`: Supabase URL/Key 입력 UI, SQL 셋업 가이드 내장 (접기/펼치기)
- `sheets.js`: import 경로 `firebase-sync.js` → `supabase-sync.js`

**Supabase 초기 설정 (최초 1회)**
```sql
create table if not exists gta_sheets (
  id text primary key, sync_key text not null,
  title text, artist text, key text, bpm text,
  tags jsonb default '[]', folder text default '', type text,
  file_url text, pages_urls jsonb default '[]',
  created_at bigint, synced_at bigint
);
alter table gta_sheets enable row level security;
create policy "allow_all" on gta_sheets for all using (true) with check (true);
```
Storage 버킷: `gta-sheets` (Public)

---

## 계정 정보

| 서비스 | 계정 | 비고 |
|---|---|---|
| Supabase | yamugy@gmail.com | ⚠️ 다른 프로젝트 계정과 다름 |
| GitHub | yamugyclaude | 저장소: yamugyclaude/guitar-theory |

---

## 아키텍처 메모

### PDF.js 로딩 방식
```html
<!-- index.html: <script> 태그로 UMD 로드 → window.pdfjsLib 전역 등록 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = '...pdf.worker.min.js';
</script>
```
Dynamic import나 ESM 방식은 `GlobalWorkerOptions` 접근 불가 문제로 폐기.

### PDF 페이지 렌더링 파이프라인
```
업로드 시: PDF → PDF.js → Canvas × N → JPEG Blob × N → IndexedDB record.pages[]
라이브 시: record.pages[n] → URL.createObjectURL() → <img> 태그 (PDF.js 불필요)
폴백    : record.pages 없음 → PDF.js 런타임 렌더링
```

### 탭 간 연동
```js
// 발신 (예: 이론분석 탭 → 코드보이싱 탭)
goTo(2, { chord: 'Am7' });

// 수신 (코드보이싱 탭)
on('route-payload', payload => {
  if (payload?.chord) { input.value = payload.chord; search(); }
});
```

### Supabase 동기화 플로우
```
[기기 A] 업로드 → pushSheet() → Storage + DB
[기기 B] ☁️ 동기화 클릭 → pullAll() → 로컬에 없는 항목 fetchBlob() → saveSheet()
```

---

## 알려진 제약사항

| 항목 | 내용 |
|---|---|
| iOS Safari 저장소 | 7일 미사용 시 IndexedDB 삭제 가능 → 설정에서 정기 백업 권장 |
| Supabase 무료 | 1주 미사용 시 프로젝트 일시정지 (접속 즉시 재개) |
| PDF 코드 추출 | 텍스트 레이어 없는 스캔 PDF는 자동 추출 불가 → 수동 입력 fallback |
| 구 업로드 파일 | `record.pages` 없음 → 라이브에서 PDF.js 폴백 사용 (2장 보기 불안정 가능) |
| Cross-origin | Supabase Storage public URL은 fetch로 직접 다운로드 가능 |
