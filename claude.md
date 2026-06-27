<!-- 본부지침 -->
> 🚨 규칙: 대화의 맨 첫 응답에만 아래 한 줄을 출력한다. 이미 출력한 뒤에는 반복하지 않는다.
> 📋 본부 지침 읽어옴 | 적용 스킬: ponytail-coding, project-log

# CLAUDE.md
Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed. 

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding
- Don't assume. Don't hide confusion. Surface tradeoffs.
- Before implementing:
  - State your assumptions explicitly. If uncertain, ask.
  - If multiple interpretations exist, present them - don't pick silently.
  - If a simpler approach exists, say so. Push back when warranted.
  - If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First
- Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes
- Touch only what you must. Clean up only your own mess.
- When editing existing code:
  - Don't "improve" adjacent code, comments, or formatting.
  - Don't refactor things that aren't broken.
  - Match existing style, even if you'd do it differently.
  - If you notice unrelated dead code, mention it - don't delete it.
- When your changes create orphans:
  - Remove imports/variables/functions that YOUR changes made unused.
  - Don't remove pre-existing dead code unless asked.
- The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution
- Define success criteria. Loop until verified.
- Transform tasks into verifiable goals:
  - "Add validation" → "Write tests for invalid inputs, then make them pass"
  - "Fix the bug" → "Write a test that reproduces it, then make it pass"
  - "Refactor X" → "Ensure tests pass before and after"
- For multi-step tasks, state a brief plan:
  - 1. [Step] → verify: [check]
  - 2. [Step] → verify: [check]
  - 3. [Step] → verify: [check]
- Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## 5. 이 프로젝트 전용 — 치명적 실수 방지 규칙

### 5-1. localStorage 키 이름은 반드시 실제 코드에서 확인하고 쓸 것
- 새 코드에서 localStorage 키를 쓸 때 **grep으로 기존 코드의 실제 키 이름을 확인**한 후 사용
- 이 프로젝트의 확정된 키 이름:
  - Supabase 설정: `gta_supabase_cfg` (url, anonKey 포함 JSON)
  - Supabase syncKey: `gta_settings`.syncKey
  - AI API 키: `gta_gemini_key`
  - 악보 메타: `gta_sheet_meta`
  - 코드차트: `gta_chart_drafts`
  - 셋리스트: `gta_setlists`
- **절대 추측으로 키 이름 쓰지 말 것** — `gta_supabase_url`, `gta_firebase_cfg` 같은 존재하지 않는 키를 쓰면 데이터 유실로 이어짐

### 5-2. 브라우저 캐시 삭제를 사용자에게 안내할 때
- **"캐시 삭제"를 권장할 때는 반드시 경고 포함**:
  > ⚠️ "사이트 데이터" 또는 "쿠키/저장 데이터"는 체크하지 마세요. IndexedDB(악보 파일)가 삭제됩니다. **"캐시된 이미지 및 파일"만** 체크하세요.
- 캐시 삭제 권유 자체를 최소화할 것 — `?v=숫자` 캐시버스팅으로 해결 가능하면 그 방법 우선

### 5-3. 데이터 저장 구조 (변경 금지)
- 악보 파일(Blob): **IndexedDB** `GuitarTheoryApp` — 브라우저 캐시 삭제 시 유실 가능
- 악보 메타/설정: **localStorage** — 캐시 삭제에 영향 없음
- 클라우드 백업: **Supabase** (`gta-sheets` bucket + `gta_sheets` table)
- Supabase 연결이 설정된 경우 파일 업로드 시 **반드시 Supabase에도 push** 되어야 함
- 이 흐름이 끊기면 사용자 데이터가 조용히 유실됨 — 수정 시 반드시 전체 흐름 검증

### 5-4. 구 코드 잔재 (Firebase) 절대 참조 금지
- `firebase-sync.js`는 폐기 파일 — import하거나 참조하지 말 것
- 코드에 "Firebase"라는 문자열이 사용자에게 노출되면 안 됨
- Supabase 관련 코드 수정 시 `supabase-sync.js`만 사용