// AI 악보 분석 모듈
// AIza... → Gemini API 직접 / sk-or-... → OpenRouter 자동 분기
// 키는 localStorage('gta_gemini_key')에만 저장 — 코드에 하드코딩 금지

export function getApiKey() { return localStorage.getItem('gta_gemini_key') || ''; }
export function saveApiKey(key) { localStorage.setItem('gta_gemini_key', key.trim()); }
export function isConfigured() { return !!getApiKey(); }
export function keyType(key) {
  const k = (key || getApiKey()).trim();
  if (k.startsWith('sk-or-') || k.startsWith('sk-')) return 'openrouter';
  return 'gemini'; // AIza..., AQ..., 기타 Google AI Studio 키 모두 Gemini로 처리
}

// ===== 공통 유틸 =====
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ===== 프롬프트 =====
const ANALYSIS_PROMPT = `이 악보 이미지를 분석해서 아래 JSON 형식으로만 응답해주세요. 설명이나 마크다운 없이 JSON만 반환하세요.

{
  "title": "곡명 (없으면 빈 문자열)",
  "artist": "아티스트명 (없으면 빈 문자열)",
  "key": "조성 예: Am, G, Bb (없으면 빈 문자열)",
  "bpm": "템포 숫자만 예: 120 (없으면 빈 문자열)",
  "time": "박자 예: 4/4 (없으면 4/4)",
  "tags": ["장르나 스타일 키워드"],
  "sections": [
    {
      "type": "섹션 이름 (Intro/Verse/Chorus 등, 악보에 표시된 그대로)",
      "chords": ["코드1", "코드2"],
      "repeatStart": false,
      "repeatEnd": false,
      "startMark": "",
      "endMark": "",
      "memo": "연주 지시어나 메모 (없으면 빈 문자열)"
    }
  ],
  "notes": "기타 분석 메모"
}

규칙:
- chords 배열의 항목 하나 = 마디 하나. 반드시 실제 마디 수와 일치시킬 것
- 같은 코드가 4마디 반복되면 ["Am", "Am", "Am", "Am"] 으로 4개 기재
- 한 마디 안에 코드가 2개면 "Am G" 처럼 공백으로 구분해서 하나의 문자열로
- 코드 이름은 표준 표기 사용 (Am7, Gmaj7, D7, Cadd9 등)
- 섹션이 명시 안 됐으면 코드 흐름으로 구분
- 읽을 수 없는 항목은 빈 값으로
- 오선보라면 각 마디의 주요 코드를 추론
- TAB 악보라면 프렛 위치로 코드 분석
- 도돌이표(||: :||) → repeatStart/repeatEnd: true
- 세뇨(𝄋) → startMark: "𝄋 Segno", 코다(𝄌) → startMark: "𝄌 Coda"
- D.S./D.C./Fine 등 → endMark에 기록`;

// ===== Gemini API 직접 =====
const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash',
];

async function callGemini(apiKey, imageParts, promptText) {
  const errors = [];
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }, ...imageParts] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        errors.push(`[${model}] ${data?.error?.message || res.status}`);
        continue;
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) { errors.push(`[${model}] 빈 응답`); continue; }
      return { text, model };
    } catch (e) { errors.push(`[${model}] ${e.message}`); }
  }
  throw new Error('Gemini 모든 모델 실패:\n' + errors.join('\n'));
}

async function blobToGeminiPart(blob) {
  const mime = blob.type || 'image/jpeg';
  const base64 = await blobToBase64(blob);
  return { inlineData: { mimeType: mime, data: base64 } };
}

// ===== OpenRouter =====
// 고정 fallback (동적 조회 실패 시)
const OPENROUTER_MODELS_FALLBACK = [
  'qwen/qwen2.5-vl-72b-instruct:free',
  'qwen/qwen2-vl-7b-instruct:free',
  'google/gemma-3-27b-it:free',
  'microsoft/phi-4-multimodal-instruct:free',
];

async function getOpenRouterVisionModels(apiKey) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!res.ok) return OPENROUTER_MODELS_FALLBACK;
    const data = await res.json();
    // 무료이고 이미지 입력 지원하는 모델만 필터
    const free = (data.data || []).filter(m =>
      m.id.endsWith(':free') &&
      m.architecture?.input_modalities?.includes('image')
    ).map(m => m.id);
    return free.length ? free.slice(0, 6) : OPENROUTER_MODELS_FALLBACK;
  } catch {
    return OPENROUTER_MODELS_FALLBACK;
  }
}

async function callOpenRouter(apiKey, imageParts, promptText) {
  const models = await getOpenRouterVisionModels(apiKey);
  const errors = [];
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://yamugyclaude.github.io/guitar-theory/',
          'X-Title': 'Guitar Theory App'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: [{ type: 'text', text: promptText }, ...imageParts] }],
          temperature: 0.1,
          max_tokens: 4096
        })
      });
      const data = await res.json();
      if (!res.ok) {
        errors.push(`[${model}] ${data?.error?.message || res.status}`);
        continue;
      }
      const text = data.choices?.[0]?.message?.content || '';
      if (!text) { errors.push(`[${model}] 빈 응답`); continue; }
      return { text, model };
    } catch (e) { errors.push(`[${model}] ${e.message}`); }
  }
  throw new Error('OpenRouter 모든 모델 실패:\n' + errors.join('\n'));
}

async function blobToOpenRouterPart(blob) {
  const mime = blob.type || 'image/jpeg';
  const base64 = await blobToBase64(blob);
  return { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } };
}

// ===== 통합 호출 =====
async function callAi(apiKey, blobs, promptText) {
  const type = keyType(apiKey);
  if (type === 'gemini') {
    const parts = await Promise.all(blobs.map(blobToGeminiPart));
    return callGemini(apiKey, parts, promptText);
  } else {
    const parts = await Promise.all(blobs.map(blobToOpenRouterPart));
    return callOpenRouter(apiKey, parts, promptText);
  }
}

function parseJson(text) {
  const jsonStr = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(jsonStr); }
  catch { throw new Error('응답 파싱 실패. 다시 시도해주세요.\n\n원본: ' + text.slice(0, 300)); }
}

// ===== 공개 API =====
export async function callAiRaw(imageBlob, promptText) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');
  const { text } = await callAi(apiKey, [imageBlob], promptText);
  return text;
}

// ===== 화성 심층 해석 (이론 탭용 — 텍스트 전용) =====
const DEEP_HARMONY_PROMPT = `당신은 버클리 음대에서 화성학과 즉흥연주를 가르치는 교수이며, 동시에 투어 경력이 있는 프로 재즈/퓨전 기타리스트입니다.
학생은 프로급 기타리스트로, 기초 설명은 필요 없습니다. 아래 코드 진행과 1차 기능 분석을 바탕으로 심층 해석을 작성하세요.

응답 형식 (마크다운, 한국어):
## 화성적 서사
이 진행이 만들어내는 긴장-해결의 드라마를 흐름으로 설명. 어디서 떠나고 어디로 돌아오는지, 각 전환점의 의미.

## 핵심 포인트 (2~4개)
프로 연주자가 주목해야 할 화성적 장치들. 1차 분석이 놓친 더 깊은 해석이 있으면 제시 (예: 콜트레인 체인지 단편, 컨스턴트 스트럭처, 베이스 라인 클리셰, 모달 프레임).

## 즉흥연주 전략
스케일 나열이 아니라 *접근법*: 어느 코드에서 아웃사이드로 나갈지, 가이드 톤 라인 설계, 모티브 개발 지점, 리듬적 텐션 포인트.

## 리하모니제이션 제안 (2~3개)
실제 적용 가능한 구체적 코드 대체 — 원래 코드 → 대체 코드와 그 이유. 트라이톤 서브, 패싱 디미니시, 모달 인터체인지, 어퍼 스트럭처 등.

## 참고 레퍼토리
이 진행 또는 유사한 화성 장치를 쓰는 실제 곡 2~3개 (곡명 — 아티스트, 어느 부분인지).

규칙: 추측으로 곡을 지어내지 말 것. 확실한 곡만 언급. 전문 용어는 한국어 관용 표기 사용 (예: 트라이톤 서브, 가이드 톤).`;

export async function deepHarmonyAnalysis(progressionText, engineSummary) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다. 설정 탭에서 AI API 키를 등록해주세요.');
  const prompt = `${DEEP_HARMONY_PROMPT}\n\n--- 코드 진행 ---\n${progressionText}\n\n--- 1차 기능 분석 (앱 엔진) ---\n${engineSummary}`;
  const { text } = await callAi(apiKey, [], prompt);
  return text;
}

export async function analyzeSheet(imageBlob) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');
  const { text } = await callAi(apiKey, [imageBlob], ANALYSIS_PROMPT);
  return parseJson(text);
}

export async function analyzeSheets(imageBlobs) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');
  const prompt = ANALYSIS_PROMPT + `\n\n이 악보는 같은 곡의 ${imageBlobs.length}페이지입니다. 전체를 하나의 곡으로 분석해주세요.`;
  const { text } = await callAi(apiKey, imageBlobs, prompt);
  return parseJson(text);
}

// ===== 연결 테스트 (설정 탭용) =====
export async function testConnection(onStatus) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키를 입력해주세요.');
  const type = keyType(apiKey);

  if (type === 'gemini') {
    for (const model of GEMINI_MODELS) {
      onStatus(`🔄 Gemini ${model} 테스트 중...`);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 5 } })
        });
        const data = await res.json();
        if (res.ok) return `✅ 연결 성공! (Gemini · ${model})`;
        if (res.status === 429) continue; // rate limit → 다음 모델
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      } catch (e) {
        if (e.message.includes('quota') || e.message.includes('rate')) continue;
        throw e;
      }
    }
    throw new Error('모든 Gemini 모델이 한도 초과입니다. 잠시 후 다시 시도하거나 OpenRouter 키를 사용해주세요.');
  } else if (type === 'openrouter') {
    onStatus('🔄 사용 가능한 모델 조회 중...');
    const models = await getOpenRouterVisionModels(apiKey);
    for (const model of models) {
      onStatus(`🔄 OpenRouter ${model.split('/')[1]} 테스트 중...`);
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://yamugyclaude.github.io/guitar-theory/',
            'X-Title': 'Guitar Theory App'
          },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 })
        });
        const data = await res.json();
        if (res.ok) return `✅ 연결 성공! (OpenRouter · ${model.split('/')[1]})`;
        if (res.status === 429) continue;
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      } catch (e) {
        if (e.message.includes('rate') || e.message.includes('429')) continue;
        throw e;
      }
    }
    throw new Error('모든 OpenRouter 모델이 한도 초과입니다. 잠시 후 다시 시도해주세요.');
  } else {
    // unknown → Gemini로 시도
    for (const model of GEMINI_MODELS) {
      onStatus(`🔄 Gemini ${model} 테스트 중...`);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 5 } })
        });
        const data = await res.json();
        if (res.ok) return `✅ 연결 성공! (Gemini · ${model})`;
        if (res.status === 429) continue;
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      } catch (e) {
        if (e.message.includes('quota') || e.message.includes('rate')) continue;
        throw e;
      }
    }
    throw new Error('모든 Gemini 모델이 한도 초과입니다. 잠시 후 다시 시도해주세요.');
  }
}
