// AI 악보 분석 모듈 (OpenRouter - 무료, 카드 불필요)
// 키는 localStorage('gta_gemini_key')에만 저장 — 코드에 하드코딩 금지

export function getApiKey() {
  return localStorage.getItem('gta_gemini_key') || '';
}

export function saveApiKey(key) {
  localStorage.setItem('gta_gemini_key', key.trim());
}

export function isConfigured() {
  return !!getApiKey();
}

// 이미지 Blob → base64 변환
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 악보 분석 프롬프트
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
      "memo": "연주 지시어나 메모 (없으면 빈 문자열)"
    }
  ],
  "notes": "기타 분석 메모"
}

규칙:
- 코드 이름은 표준 표기 사용 (Am7, Gmaj7, D7, Cadd9 등)
- 섹션이 명시 안 됐으면 코드 흐름으로 구분
- 읽을 수 없는 항목은 빈 값으로
- 오선보라면 각 마디의 주요 코드를 추론해서 채워주세요
- TAB 악보라면 프렛 위치로 코드를 분석해주세요`;

// 메인 분석 함수 (OpenRouter API 사용)
export async function analyzeSheet(imageBlob) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');

  const mimeType = imageBlob.type || 'image/jpeg';
  const base64 = await blobToBase64(imageBlob);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://yamugyclaude.github.io/guitar-theory/',
      'X-Title': 'Guitar Theory App'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.2-11b-vision-instruct:free',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: ANALYSIS_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
        ]
      }],
      temperature: 0.1,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API 오류 (${response.status})`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  // JSON 파싱 (```json ... ``` 래핑 제거 포함)
  const jsonStr = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error('응답 파싱 실패. 다시 시도해주세요.\n\n원본: ' + text.slice(0, 200));
  }
}
