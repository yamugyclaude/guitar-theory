// AI 악보 분석 모듈 (Google Gemini API 직접 연동)
// 키는 localStorage('gta_gemini_key')에만 저장 — 코드에 하드코딩 금지

export function getApiKey() { return localStorage.getItem('gta_gemini_key') || ''; }
export function saveApiKey(key) { localStorage.setItem('gta_gemini_key', key.trim()); }
export function isConfigured() { return !!getApiKey(); }

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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

// Gemini 모델 (순서대로 fallback)
const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
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
        const msg = data?.error?.message || `HTTP ${res.status}`;
        errors.push(`[${model}] ${msg}`);
        continue;
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) { errors.push(`[${model}] 빈 응답`); continue; }
      return text;
    } catch (e) { errors.push(`[${model}] ${e.message}`); }
  }
  throw new Error('모든 모델 실패:\n' + errors.join('\n'));
}

function parseJson(text) {
  const jsonStr = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(jsonStr); }
  catch { throw new Error('응답 파싱 실패. 다시 시도해주세요.\n\n원본: ' + text.slice(0, 300)); }
}

async function blobToGeminiPart(blob) {
  const mime = blob.type || 'image/jpeg';
  const base64 = await blobToBase64(blob);
  return { inlineData: { mimeType: mime, data: base64 } };
}

// raw 호출 (프롬프트 직접 지정)
export async function callAiRaw(imageBlob, promptText) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');
  const imageParts = [await blobToGeminiPart(imageBlob)];
  return callGemini(apiKey, imageParts, promptText);
}

// 단일 이미지 분석
export async function analyzeSheet(imageBlob) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');
  const imageParts = [await blobToGeminiPart(imageBlob)];
  return parseJson(await callGemini(apiKey, imageParts, ANALYSIS_PROMPT));
}

// 복수 이미지 일괄 분석 (같은 곡의 여러 페이지)
export async function analyzeSheets(imageBlobs) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');
  const imageParts = await Promise.all(imageBlobs.map(blobToGeminiPart));
  const prompt = ANALYSIS_PROMPT + `\n\n이 악보는 같은 곡의 ${imageBlobs.length}페이지입니다. 전체를 하나의 곡으로 분석해주세요.`;
  return parseJson(await callGemini(apiKey, imageParts, prompt));
}
