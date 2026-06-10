import { on } from './app.js';

// ═══════════════════════════════════════════════════════════════════
//  스타일 라이브러리 — 기타 매거진 피처 수준의 아티스트 분석
//  모든 곡명/앨범/장비는 검증된 사실만 수록
// ═══════════════════════════════════════════════════════════════════

const GUITARISTS = [
  {
    name: 'Stevie Ray Vaughan',
    genre: '텍사스 블루스',
    description: '현대 일렉트릭 블루스의 기준점. 앨버트 킹의 벤딩, 지미 헨드릭스의 리듬 어프로치, 로니 맥의 스피드를 하나로 융합해 1980년대 블루스 부흥을 이끌었다.',
    anatomy: [
      '연주의 핵심은 "리듬과 리드의 비분리"다. 셔플 리듬을 유지하면서 그 틈새에 필인을 끼워 넣는 방식 — 트리오 편성에서 사운드가 비지 않는 이유다. 오른손은 항상 셔플 그루브를 유지하고, 왼손 해머온/풀오프로 리드 라인을 처리하는 경우가 많다.',
      '벤딩은 앨버트 킹 직계다. 1음 반(minor 3rd) 벤딩을 정확한 피치로 도달시키고, 도달 후 비브라토를 거는 것이 시그니처. 얇은 줄이 아니라 .013 게이지의 저항을 손가락 세 개로 밀어내는 물리적 강도가 톤의 본질이다.',
      '더블스탑(2음 동시 연주)을 단순 장식이 아닌 멜로디 전개의 기본 단위로 쓴다. "Pride and Joy"의 인트로, "Lenny"의 코드-멜로디가 대표적.',
    ],
    techniques: [
      { name: '셔플 + 리드 동시 처리', detail: '엄지로 6번현 베이스를 치면서 나머지 손가락으로 상성부 코드/필인. "Pride and Joy" 인트로가 교과서. 연습: 베이스 라인만 메트로놈에 맞춰 자동화될 때까지 → 상성부 추가.' },
      { name: '1음반 벤딩 + 비브라토', detail: '벤딩 도달 피치를 먼저 프렛으로 짚어 귀에 새긴 후 벤딩으로 재현. 도달 후 손목 회전으로 비브라토. 약지 벤딩 시 검지·중지로 보조하는 3-finger 서포트 필수.' },
      { name: '레이크(rake) 어택', detail: '목표 음 직전 뮤트된 저음현들을 쓸어내리며 어택에 무게를 싣는다. 프레이즈 첫 음의 "퍽" 하는 질감이 이것.' },
      { name: '헨드릭스식 R&B 코드 워크', detail: '엄지로 6번현 루트를 잡고 트리플렛 해머온 장식을 넣는 "Little Wing" 스타일. CAGED의 E폼/C폼 주변에서 코드 톤 장식.' },
    ],
    harmony: [
      '화성적으로는 도미넌트 블루스(I7–IV7–V7)가 거의 전부지만, 그 위에서 메이저/마이너 펜타토닉을 한 프레이즈 안에서 섞는 것이 핵심 어법이다. I7에서 메이저 펜타토닉(밝음) → IV7로 갈 때 마이너 펜타토닉(어두움)으로 전환하는 패턴을 의식적으로 들어볼 것.',
      '"Riviera Paradise"는 예외적인 곡 — Em9 중심의 모달 재즈 발라드로, 도리안 어법과 9th/13th 텐션 보이싱을 들을 수 있다. SRV의 재즈 감수성이 드러나는 유일한 트랙에 가깝다.',
      '"Lenny"는 E 메이저 위의 코드-멜로디로, 텐션을 머금은 슬라이딩 보이싱(Emaj9 계열)이 중심. 블루스 연주자가 메이저 7th 사운드를 다루는 법을 배울 수 있다.',
    ],
    tone: 'Number One(1962/63 스트랫, 빈티지 픽업) → Ibanez Tube Screamer(부스트 용도, 게인 낮게) → Fender Vibroverb/Super Reverb + Dumble Steel String Singer. 반음 내림 튜닝 + .013 게이지. 톤의 절반은 픽킹 강도라는 점이 중요 — 장비를 따라해도 어택이 약하면 그 소리가 안 난다.',
    listening: [
      { song: 'Pride and Joy', album: 'Texas Flood (1983)', why: '셔플+리드 동시 처리의 교과서. 인트로 4마디만 완벽히 카피해도 오른손이 바뀐다.' },
      { song: 'Texas Flood', album: 'Texas Flood (1983)', why: '슬로우 블루스 프레이징의 정수. 벤딩 피치와 타이밍 공부.' },
      { song: 'Lenny', album: 'Texas Flood (1983)', why: '메이저 계열 코드-멜로디. 블루스 연주자의 발라드 어법.' },
      { song: 'Tin Pan Alley', album: "Couldn't Stand the Weather (1984)", why: '최소한의 음으로 최대 긴장 — 다이내믹 컨트롤 공부.' },
      { song: 'Riviera Paradise', album: 'In Step (1989)', why: '모달 재즈 발라드. 도리안 + 텐션 보이싱.' },
    ],
    practice: [
      '1단계: "Pride and Joy" 인트로 — 셔플 베이스+상성부 동시 처리 자동화',
      '2단계: 1음반 벤딩 피치 트레이닝 (목표음 짚기 → 벤딩 재현 → 튜너 검증)',
      '3단계: 슬로우 블루스("Texas Flood") 12마디 솔로 전체 카피 — 타이밍까지',
      '4단계: 메이저/마이너 펜타토닉 전환을 I7→IV7 체인지에 맞춰 즉흥 적용',
    ],
    vocabulary: [
      { name: 'Albert King Bend', scale: 'Minor Pentatonic (박스 상단)', tech: '1음반 벤딩' },
      { name: 'Shuffle Comp + Fill', scale: 'Mixolydian + Blues', tech: '하이브리드 리듬/리드' },
      { name: 'Double Stop Slide', scale: 'Major Pentatonic 3도 쌍', tech: '더블스탑' },
      { name: 'Rake Attack Phrase', scale: 'Minor Pentatonic', tech: '레이크' },
      { name: 'Hendrix Chord Embellish', scale: 'CAGED E/C폼 주변', tech: '엄지 베이스 + 해머온' },
    ],
  },
  {
    name: 'John Mayer',
    genre: '블루스 · 팝 · R&B',
    description: 'SRV·헨드릭스 계보의 블루스 어법을 팝 송라이팅 안에 녹인 현 세대 대표 주자. 손가락 하나하나가 독립적으로 움직이는 핑거 컨트롤과 코드-멜로디가 무기.',
    anatomy: [
      '존 메이어 스타일의 본질은 "코드 안에서 노래하기"다. 코드를 잡은 상태에서 일부 손가락만 움직여 멜로디를 만들기 때문에 반주와 멜로디가 분리되지 않는다. 엄지로 6번현을 잡는 thumb-over 그립이 이를 가능하게 하는 물리적 토대.',
      '리드 톤은 SRV에서 왔지만 프레이징은 더 보컬적이다. 음 수를 줄이고, 벤딩의 곡선과 비브라토의 속도로 말한다. "Gravity" 솔로가 대표적 — 거의 모든 음이 노래 멜로디처럼 부를 수 있는 음이다.',
      'R&B/네오소울 어법(트라이어드 임베리시먼트, 6th/9th 장식음)을 블루스에 섞는 것이 후기 스타일. Dead & Company 시기에는 즉흥 전개력이 크게 확장됐다.',
    ],
    techniques: [
      { name: 'Thumb-over 코드-멜로디', detail: '엄지로 6번현 루트, 나머지 4손가락으로 상성부 멜로디 운용. "Neon", "Stop This Train"이 정점. 연습: C폼/G폼 코드에서 엄지 베이스 유지한 채 상성부 add9·sus 장식 넣기.' },
      { name: '보컬형 벤딩 프레이징', detail: '음 수를 줄이고 한 음의 벤딩-비브라토 곡선에 정보를 담는다. "Gravity" 솔로의 첫 벤딩을 100번 들어볼 것 — 도달 속도, 유지, 릴리즈가 전부 의도다.' },
      { name: '핑거스타일 R&B 그루브', detail: '피크 없이 엄지+세 손가락. 고스트 노트(뮤트 탭)를 16분 그리드에 깔아 그루브 생성. "I Don\'t Trust Myself"의 버스 참고.' },
      { name: '펜타토닉 + 크로매틱 패싱', detail: '마이너 펜타토닉 박스 사이를 크로매틱으로 연결. b3→3 해결(블루스 핵심 모션)을 프레이즈 단위로 사용.' },
    ],
    harmony: [
      '팝 구조 속에 블루스 어법을 심는 방식이 핵심. "Gravity"는 G 메이저의 단순한 I–IV 진행이지만 솔로는 메이저/마이너 펜타토닉 혼용 + b3→3 해결로 블루스 긴장을 만든다.',
      '"Slow Dancing in a Burning Room"의 인트로 — 코드 톤 주변 장식(상성부 sus4→3 해결)이 어떻게 후크가 되는지 들어볼 것. 코드 진행 자체보다 보이싱 디테일이 곡의 정체성을 만든다.',
      '"Neon"은 C 마이너 펜타토닉 베이스의 코드-멜로디 곡인데, 엄지 베이스가 5도권 하행(Cm7→F7 모션 등)을 그리며 펑키한 화성 리듬을 만든다. 손이 코드를 "치는" 게 아니라 "걷는" 감각.',
    ],
    tone: 'Fender 스트랫 → 현재 PRS Silver Sky(시그니처). 앰프는 Two-Rock(덤블 계열) + Fender 콤보 조합. 클린~크런치 경계의 터치 반응형 게인이 핵심 — 픽킹 강도로 게인량을 조절하는 세팅. Klon Centaur 계열 부스트 사용으로 유명.',
    listening: [
      { song: 'Gravity (Where the Light Is 라이브)', album: 'Where the Light Is (2008)', why: '보컬형 솔로의 정점. 스튜디오 버전보다 라이브 버전이 교재.' },
      { song: 'Neon', album: 'Room for Squares (2001)', why: 'Thumb-over 핑거스타일의 끝판. 원곡 템포 도달이 하나의 관문.' },
      { song: 'Slow Dancing in a Burning Room', album: 'Continuum (2006)', why: '보이싱 디테일이 곡이 되는 사례. 인트로 더블스탑 분석.' },
      { song: 'Vultures', album: 'Continuum (2006)', why: 'R&B 그루브 + 팔세토 보컬과 기타의 콜앤리스폰스.' },
      { song: 'I Don\'t Trust Myself', album: 'Continuum (2006)', why: '고스트 노트 그루브, 와우 톤 컨트롤.' },
    ],
    practice: [
      '1단계: thumb-over 그립 적응 — C/G폼 코드에서 엄지 6번현 + 상성부 장식',
      '2단계: "Gravity" 솔로 카피 — 벤딩 곡선과 비브라토 속도까지 재현',
      '3단계: "Neon" 인트로/버스 — 원곡 템포의 70%부터 단계적 상승',
      '4단계: 백킹 트랙 위에서 코드-멜로디 즉흥 (반주 끊기지 않게 멜로디 삽입)',
    ],
    vocabulary: [
      { name: 'Thumb-over Add9 Voicing', scale: 'CAGED C/G폼', tech: '썸 그립 코드-멜로디' },
      { name: 'Vocal Bend Phrase', scale: 'Minor Pentatonic', tech: '벤딩 곡선 컨트롤' },
      { name: 'b3→3 Resolution Lick', scale: 'Blues → Major Pentatonic', tech: '블루스 해결 모션' },
      { name: 'Ghost Note Groove', scale: '-', tech: '핑거스타일 뮤트 탭' },
      { name: 'Double Stop Hook', scale: '3도/4도 쌍', tech: 'sus4→3 장식' },
    ],
  },
  {
    name: 'Nick Johnston',
    genre: '멜로딕 인스트루멘탈 록',
    description: '캐나다 출신. 빈티지 스트랫 톤 + 낮은 게인으로 인스트루멘탈 록을 연주하는 역설의 미학. 테크닉을 멜로디 뒤에 숨기는 작곡형 기타리스트.',
    anatomy: [
      '닉 존스턴 스타일의 첫 번째 열쇠는 톤 셋업이다. 하이게인이 표준인 인스트루멘탈 록 장르에서 싱글코일+크런치 게인을 쓰기 때문에 모든 음의 어택과 다이내믹이 노출된다. 결과적으로 레가토·벤딩·비브라토의 "질"이 그대로 드러나는 연주.',
      '프레이징은 보컬 멜로디 구조를 따른다 — 주제 제시, 반복, 변형, 해결. 속주 구간조차 멜로디 주제의 "장식"으로 기능하게 배치한다. 솔로가 곡에서 분리되지 않는 이유.',
      '와이드 인터벌(현 건너뛰기)과 하모닉 마이너 컬러를 즐겨 쓰지만, 가장 구별되는 건 벤딩 비브라토의 표정이다. 게인이 낮아 비브라토 폭과 속도가 감정 표현의 주 수단이 된다.',
    ],
    techniques: [
      { name: '저게인 레가토', detail: '게인의 서스테인 도움 없이 해머온/풀오프 자체의 힘으로 음량 유지. 연습: 클린 톤에서 레가토 프레이즈를 픽킹 버전과 같은 음량으로 — 왼손 힘이 부족하면 바로 들통난다.' },
      { name: '와이드 인터벌 스트링 스키핑', detail: '1↔3번현, 2↔4번현 건너뛰기로 비단계적 멜로디 라인. 아르페지오가 아닌 스케일 음을 넓은 음정으로 재배열하는 방식.' },
      { name: '하모닉 마이너 컬러 노트', detail: '마이너 키에서 ♮7(리딩톤)을 멜로디 정점에 배치해 신고전적 긴장 생성. 스케일 런이 아니라 한두 음의 컬러로 사용하는 게 포인트.' },
      { name: '표정 비브라토', detail: '음마다 비브라토 폭/속도를 다르게 — 좁고 빠르게(긴장), 넓고 느리게(해소). 한 프레이즈에서 두 가지를 의도적으로 대비시킨다.' },
    ],
    harmony: [
      '마이너 키 중심이지만 단순 에올리안이 아니다 — 하모닉 마이너의 V7(b9 컬러), 리디안 IVmaj7#11을 섹션 컬러로 쓴다. 이론 탭에서 그의 곡 진행을 분석해 보면 모달 인터체인지가 빈번하다.',
      '멜로디가 코드 톤에 정확히 착지하는 작곡 방식 — 코드가 바뀌는 순간 멜로디가 새 코드의 3rd나 7th에 도착하는 경우가 많다. 가이드 톤 라인 개념의 실전 사례.',
      '템포 대비 하프타임 멜로디 + 더블타임 장식의 대비 구조. 속주는 "장식"의 위치에만 온다.',
    ],
    tone: 'Schecter Nick Johnston Traditional(시그니처, 싱글코일 3개) → 낮은 게인 크런치. 딜레이/리버브는 공간 표현용으로 깊게. 게인을 낮출수록 그의 사운드에 가까워진다는 점이 카피의 출발점.',
    listening: [
      { song: 'Atomic Mind', album: 'Atomic Mind (2014)', why: '대표곡. 멜로디 주제 전개 방식의 교과서.' },
      { song: 'Poison Touch', album: 'Remarkably Human (2016)', why: '와이드 인터벌 + 하모닉 마이너 컬러.' },
      { song: 'Weightless', album: 'Wide Eyes in the Dark (2019)', why: '발라드 비브라토/벤딩 표정 공부.' },
      { song: 'Young Language', album: 'Young Language (2021)', why: '근작의 톤과 작곡 방향.' },
    ],
    practice: [
      '1단계: 게인을 평소의 절반으로 낮추고 자기 레퍼토리 연주 — 노출되는 약점 확인',
      '2단계: 비브라토 폭/속도 매트릭스 연습 (좁고빠름/좁고느림/넓고빠름/넓고느림)',
      '3단계: "Atomic Mind" 메인 테마 카피 — 멜로디 착지음과 코드의 관계 분석',
      '4단계: 마이너 백킹에서 하모닉 마이너 ♮7을 컬러로만 쓰는 즉흥 (런 금지)',
    ],
    vocabulary: [
      { name: 'Wide Interval Melody', scale: '마이너 스케일 재배열', tech: '스트링 스키핑' },
      { name: 'Harmonic Minor Apex', scale: 'Harmonic Minor', tech: '♮7 컬러 노트' },
      { name: 'Low-gain Legato Run', scale: 'Aeolian/Dorian', tech: '레가토' },
      { name: 'Expressive Vibrato Pair', scale: '-', tech: '비브라토 대비' },
      { name: 'Lydian Section Color', scale: 'Lydian', tech: '#11 활용' },
    ],
  },
  {
    name: 'Guthrie Govan',
    genre: '퓨전 · 올장르',
    description: '영국 출신, The Aristocrats / 한스 짐머 라이브 밴드. 모든 장르의 어법을 즉흥 안에서 자유롭게 전환하는, 현존 최고 수준의 올라운드 즉흥 연주자.',
    anatomy: [
      '거스리의 본질은 테크닉이 아니라 "어휘의 폭과 전환 속도"다. 한 솔로 안에서 블루스 벤딩 → 컨트리 치킨피킹 → 비밥 크로마티시즘 → 레가토 퓨전으로 어법을 전환하는데, 각 어법이 모두 그 장르 전문가 수준이라는 게 핵심.',
      '크로매틱 어프로치(목표음을 반음 위아래로 감싸는 인클로저)를 모든 어법에 깔아 쓴다. 비밥에서 가져온 이 어법이 그의 라인을 "말하는 것처럼" 들리게 만드는 장치.',
      '저서 Creative Guitar 1·2(영국 Guitar Techniques지 칼럼 기반)는 그의 사고방식을 직접 읽을 수 있는 1차 자료다. 테크닉보다 "왜 그 음을 선택하는가"에 집중하는 책.',
    ],
    techniques: [
      { name: '인클로저 (크로매틱 감싸기)', detail: '목표 코드 톤을 반음 위 + 스케일 음 아래(또는 반대)로 감싼 뒤 착지. 연습: 코드 톤 아르페지오의 모든 음에 인클로저 적용 → 템포 상승.' },
      { name: '치킨피킹', detail: '피크+중지/약지 동시 운용. 손가락으로 뜯는 음에 "팝" 어택이 실린다. 컨트리 어법이지만 거스리는 퓨전 라인의 액센트 장치로 쓴다.' },
      { name: '경계 없는 레가토', detail: '픽킹·해머온·슬라이드의 음량 차를 없애 한 줄로 들리는 라인. 핵심은 픽킹을 "줄이는" 게 아니라 모든 어택을 균질화하는 것.' },
      { name: '리듬 변조 (그루핑)', detail: '16분음표를 3·5·7개 단위로 그루핑해 박 위에서 미끄러지는 느낌 생성. The Aristocrats 곡들에서 변박과 결합되어 나타난다.' },
    ],
    harmony: [
      '코드-스케일을 "장르 어법"과 묶어서 선택한다 — 같은 V7에서도 블루스 모드일 땐 믹솔리디안+블루노트, 퓨전 모드일 땐 알터드, 컨트리 모드일 땐 메이저 펜타+크로매틱. 이론 선택이 스타일 선택과 동기화되어 있다.',
      '"Wonderful Slippery Thing"의 솔로 섹션은 정지된 펑크 그루브 위에서 어법 전환만으로 기승전결을 만드는 사례. 화성이 단순할수록 어법 전환이 잘 들린다.',
      '아웃사이드 플레이는 사이드슬리핑(프레이즈를 반음 위/아래로 평행 이동)이 기본 — 나갔다가 돌아오는 지점이 항상 명확하다.',
    ],
    tone: 'Charvel Guthrie Govan 시그니처(HSH). 게인은 중간 — 레가토가 뭉개지지 않는 선. 그의 톤은 장비보다 오른손 어택 균질화가 만든다.',
    listening: [
      { song: 'Wonderful Slippery Thing', album: 'Erotic Cakes (2006)', why: '대표곡. 어법 전환의 교과서. 와우 섹션 리듬 컨트롤.' },
      { song: 'Fives', album: 'Erotic Cakes (2006)', why: '5 그루핑 리듬 변조의 표본.' },
      { song: 'Waves', album: 'Erotic Cakes (2006)', why: '레가토 음량 균질화 — 클린 카피 도전 과제.' },
      { song: 'Bad Asteroid (The Aristocrats)', album: 'The Aristocrats (2011)', why: '변박 위 그루핑 + 트리오 인터플레이.' },
    ],
    practice: [
      '1단계: 인클로저 — 메이저 트라이어드 아르페지오 전 음에 적용, 12키',
      '2단계: 16분 3·5그루핑을 메트로놈 위에서 (액센트 이동 인지)',
      '3단계: 한 백킹에서 어법 4개(블루스→컨트리→비밥→퓨전)를 8마디씩 의도적 전환',
      '4단계: Creative Guitar 1권의 음 선택 챕터 — 읽고 즉흥에 직접 적용',
    ],
    vocabulary: [
      { name: 'Chromatic Enclosure', scale: '비밥 크로매틱', tech: '인클로저' },
      { name: 'Chicken Pickin\' Accent', scale: 'Major Pentatonic + b3', tech: '치킨피킹' },
      { name: 'Side-slip Out Phrase', scale: '평행 반음 이동', tech: '아웃사이드' },
      { name: 'Quintuplet Grouping', scale: '-', tech: '5 그루핑 리듬' },
      { name: 'Uniform Legato Line', scale: 'Melodic Minor 모드', tech: '레가토 균질화' },
    ],
  },
  {
    name: 'Joe Satriani',
    genre: '인스트루멘탈 록',
    description: '인스트루멘탈 록의 아버지격. 스티브 바이·커크 해밋의 스승. "피치 액시스" 이론으로 리디안·믹솔리디안 컬러를 록 문법에 정착시켰다.',
    anatomy: [
      '새치 스타일의 이론적 핵심은 피치 액시스(Pitch Axis) — 베이스 페달음은 고정한 채 그 위의 모드를 교체하는 작곡법이다. 예: E 페달 위에서 E 리디안 → E 에올리안 → E 믹솔리디안으로 섹션마다 색을 바꾼다. "Flying in a Blue Dream"이 대표 사례.',
      '멜로디는 보컬 대체물로 설계된다 — 음역, 호흡, 후렴 구조가 노래와 같다. 테크닉 구간은 곡의 "브리지" 역할로 한정.',
      '레가토는 새치 스타일의 기둥. 거스리식 균질화와 달리 해머온 위주의 부드러운 "흐름"이 목적이며, 와미바 디테일(스쿱, 두입)과 결합해 표정을 만든다.',
    ],
    techniques: [
      { name: '피치 액시스 모드 전환', detail: '한 페달음 위에서 리디안/믹솔리디안/에올리안 교체. 연습: E 드론(페달) 틀어놓고 4마디마다 모드 전환 즉흥 — 모드별 특성음(#4, b7, b6)을 반드시 거칠 것.' },
      { name: '레가토 흐름', detail: '3노트퍼스트링 포지션에서 해머온 중심 상행/풀오프 중심 하행. 픽킹은 현 이동시 최소만.' },
      { name: '와미바 표정', detail: '음 시작 전 스쿱(살짝 내렸다 복귀), 끝에서 두입(내려버리기). "Always with Me…"의 멜로디 디테일이 전부 이것.' },
      { name: '투핸드 태핑 아르페지오', detail: '"Midnight" 스타일 — 양손 태핑으로 어쿠스틱한 아르페지오 직조.' },
    ],
    harmony: [
      '리디안 #4를 "우주적 밝음"의 코드로 쓰는 게 시그니처. "Flying in a Blue Dream" 도입부에서 #4가 멜로디 정점에 오는 순간을 들어볼 것.',
      '피치 액시스는 모달 인터체인지의 작곡적 활용이다 — 이론 탭의 모달 인터체인지 분석과 직결되는 개념. 같은 루트의 다른 모드 = 같은 토닉의 색채 교환.',
      '"Always with Me, Always with You"는 B 메이저 키의 단순한 진행 위에서 멜로디 모티브의 반복·변형만으로 곡을 끌고 가는 작곡 교본.',
    ],
    tone: 'Ibanez JS 시그니처(험버커) + Marshall/Peavey 하이게인. 새치 톤의 특징은 게인보다 미드 부스트된 리드 보이스 — 와우 페달 반열림(cocked wah) 사운드도 자주 쓴다.',
    listening: [
      { song: 'Always with Me, Always with You', album: 'Surfing with the Alien (1987)', why: '멜로디 작곡 + 와미바 표정의 교과서.' },
      { song: 'Satch Boogie', album: 'Surfing with the Alien (1987)', why: '록 부기 + 태핑 브레이크.' },
      { song: 'Flying in a Blue Dream', album: 'Flying in a Blue Dream (1989)', why: '피치 액시스 + 리디안 컬러의 정점.' },
      { song: 'Summer Song', album: 'The Extremist (1992)', why: '에너지 곡 구성과 레가토 흐름.' },
    ],
    practice: [
      '1단계: E 드론 위 리디안/믹솔리디안/에올리안 전환 즉흥 (특성음 의무 사용)',
      '2단계: 3노트퍼스트링 레가토 — 상행 해머온/하행 풀오프 균일 음량',
      '3단계: "Always with Me…" 멜로디 카피 — 와미바 스쿱/두입 포함',
      '4단계: 자작 페달음 위에 모드 교체 구조로 16마디 작곡',
    ],
    vocabulary: [
      { name: 'Pitch Axis Shift', scale: '동일 루트 모드 교체', tech: '모달 작곡' },
      { name: 'Lydian #4 Apex', scale: 'Lydian', tech: '특성음 멜로디 배치' },
      { name: 'Legato Flow Run', scale: '3NPS 포지션', tech: '레가토' },
      { name: 'Whammy Scoop/Doop', scale: '-', tech: '와미바 표정' },
      { name: 'Two-hand Tap Arpeggio', scale: '트라이어드 분산', tech: '태핑' },
    ],
  },
  {
    name: 'Mark Lettieri',
    genre: '펑크 · R&B · 퓨전',
    description: 'Snarky Puppy 기타리스트, 솔로로 그래미 노미네이트(Deep: The Baritone Sessions). 펑크 리듬 기타를 "리드 악기"의 위치로 끌어올린 연주자.',
    anatomy: [
      '레티에리의 중심은 리듬이다 — 16분 그리드에 고스트 노트를 깔고 그 위에 액센트를 배치하는 펑크 기타의 어법을, 단음 리프와 코드 스탭 모두에 적용한다. 솔로조차 리듬 모티브의 전개에 가깝다.',
      '하이브리드 피킹(피크+중지·약지)으로 단음 리프에 팝핑 어택을 싣는다 — 베이스의 슬랩/팝을 기타로 번역한 질감.',
      '바리톤 기타 3부작(Deep/Deeper/Deepest)은 낮은 음역에서 리듬·멜로디·베이스 라인을 동시에 처리하는 그의 어프로치가 가장 잘 드러나는 자료.',
    ],
    techniques: [
      { name: '고스트 노트 그리드', detail: '왼손 뮤트 상태로 16분 스트로크를 유지하고 필요한 박에만 음을 연다. 연습: 메트로놈 2&4 백비트만 듣고 16분 뮤트 스트로크 — 액센트 위치 자유 이동.' },
      { name: '하이브리드 피킹 팝', detail: '단음 리프에서 높은 현을 중지로 뜯어 팝 어택. 옥타브 리프(낮은음 피크 + 높은음 손가락)가 기본형.' },
      { name: '어퍼 스트럭처 트라이어드 스탭', detail: '7th 코드 위 텐션 트라이어드(예: C7 위 D 트라이어드 = 9·#11·13)를 짧은 스탭으로. 보이싱 탭의 어퍼 스트럭처 개념의 리듬화.' },
      { name: '바리톤 리프 레이어링', detail: '바리톤 음역에서 베이스 라인과 코드 스탭을 한 손에서 교차 — 트랙 없이도 그루브가 완성되는 편곡형 연주.' },
    ],
    harmony: [
      '도리안/믹솔리디안 모달 그루브가 기본 캔버스 — 화성 변화가 적은 대신 리듬 변화가 형식을 만든다.',
      '텐션은 코드 진행이 아니라 "보이싱 선택"으로 표현한다 — 같은 m7 그루브에서 11th 스탭, 9th 스탭을 교체하며 색을 바꾸는 식.',
      'Snarky Puppy 컨텍스트에서는 키보드 군과의 보이싱 분담이 흥미로운 청취 포인트 — 기타가 어느 음역/리듬을 맡는지 들어볼 것.',
    ],
    tone: 'PRS Fiore(시그니처) 등 + 컴프레서로 어택 정리한 클린~크런치. 펑크 톤의 본질은 오른손 뮤트 컨트롤이라 장비 의존도가 낮다.',
    listening: [
      { song: 'Naptime', album: 'Spark and Echo (2016)', why: '솔로 대표곡. 리듬 모티브 전개형 솔로.' },
      { song: 'Catbird', album: 'Things of That Nature (2019)', why: '하이브리드 피킹 리프 + 펑크 그루브.' },
      { song: 'What About Me? (Snarky Puppy)', album: 'We Like It Here (2014)', why: '밴드 인터플레이 속 기타 역할 공부.' },
      { song: 'Deep (앨범 전체)', album: 'Deep: The Baritone Sessions (2019)', why: '바리톤 레이어링 — 그래미 노미네이트작.' },
    ],
    practice: [
      '1단계: 16분 고스트 노트 그리드 — 뮤트 스트로크 유지 + 액센트 이동',
      '2단계: 옥타브 리프 하이브리드 피킹 (낮은음 피크/높은음 중지)',
      '3단계: Dm7 원코드 그루브에서 9th/11th 스탭 보이싱 교체 연습',
      '4단계: "Naptime" 테마 카피 — 리듬 모티브가 어떻게 변형되는지 추적',
    ],
    vocabulary: [
      { name: 'Ghost Note 16th Grid', scale: '-', tech: '뮤트 스트로크' },
      { name: 'Hybrid Octave Pop', scale: '옥타브 셰이프', tech: '하이브리드 피킹' },
      { name: 'Upper Structure Stab', scale: '7th 위 텐션 트라이어드', tech: '리듬 보이싱' },
      { name: 'Dorian Funk Riff', scale: 'Dorian', tech: '단음 리프' },
      { name: 'Baritone Layer Groove', scale: 'Mixolydian', tech: '베이스+코드 교차' },
    ],
  },
];

function yt(q) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export function render(panel) {
  let selectedIdx = 0;

  function renderAll() {
    const g = GUITARISTS[selectedIdx];
    panel.innerHTML = `
      <h1 class="page-title">🌟 스타일 라이브러리</h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${GUITARISTS.map((x, i) => `
          <button class="btn ${i === selectedIdx ? 'btn-primary' : 'btn-secondary'}" data-idx="${i}">${x.name}</button>
        `).join('')}
      </div>

      <div class="card">
        <div style="font-size:1.2rem;font-weight:700">${g.name}</div>
        <div style="color:var(--text2);font-size:0.85rem;margin-top:4px">${g.genre}</div>
        <p style="margin-top:10px;font-size:0.88rem;line-height:1.65">${g.description}</p>
      </div>

      <div class="card">
        <div class="section-label">스타일 해부</div>
        ${g.anatomy.map(p => `<p style="font-size:0.85rem;line-height:1.7;margin:8px 0">${p}</p>`).join('')}
      </div>

      <div class="card">
        <div class="section-label">시그니처 테크닉</div>
        ${g.techniques.map(t => `
          <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:11px 13px;margin-top:8px">
            <div style="font-weight:700;font-size:0.88rem;color:var(--accent)">${t.name}</div>
            <div style="font-size:0.8rem;line-height:1.65;margin-top:5px">${t.detail}</div>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <div class="section-label">화성 어법 분석</div>
        ${g.harmony.map(p => `<p style="font-size:0.85rem;line-height:1.7;margin:8px 0">${p}</p>`).join('')}
      </div>

      <div class="card">
        <div class="section-label">톤 & 장비</div>
        <p style="font-size:0.85rem;line-height:1.7;margin-top:6px">${g.tone}</p>
      </div>

      <div class="card">
        <div class="section-label">필수 청취</div>
        ${g.listening.map(l => `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
            <a href="${yt(g.name + ' ' + l.song)}" target="_blank" rel="noopener"
               style="flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--bg3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:0.7rem"
               title="YouTube에서 검색">▶</a>
            <div style="min-width:0">
              <div style="font-size:0.86rem;font-weight:600">${l.song}</div>
              <div style="font-size:0.7rem;color:var(--text2)">${l.album}</div>
              <div style="font-size:0.76rem;color:var(--text2);margin-top:3px;line-height:1.5">${l.why}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <div class="section-label">연습 로드맵</div>
        <ol style="margin:8px 0 0;padding-left:20px">
          ${g.practice.map(p => `<li style="font-size:0.83rem;line-height:1.7;margin-bottom:6px">${p.replace(/^\d+단계:\s*/, '')}</li>`).join('')}
        </ol>
      </div>

      <div class="card">
        <div class="section-label">시그니처 보캐뷸러리</div>
        <p style="font-size:0.74rem;color:var(--text2);margin:4px 0 8px">카피할 때 채집해야 할 어휘 — 각 항목을 실제 트랜스크립션에서 찾아 자기 것으로 만드세요.</p>
        ${g.vocabulary.map((l, i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="font-weight:600;font-size:0.84rem">${i+1}. ${l.name}</span>
            <span class="badge">${l.tech}</span>
            <span style="font-size:0.72rem;color:var(--text2);width:100%">스케일 컨텍스트: ${l.scale}</span>
          </div>
        `).join('')}
      </div>
    `;

    panel.querySelectorAll('[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => { selectedIdx = Number(btn.dataset.idx); renderAll(); });
    });
  }

  renderAll();

  // 탭3/4 연동
  on('route-payload', payload => {
    if (payload?.artist) {
      const idx = GUITARISTS.findIndex(g => g.name === payload.artist);
      if (idx !== -1) { selectedIdx = idx; renderAll(); }
    }
  });
}
