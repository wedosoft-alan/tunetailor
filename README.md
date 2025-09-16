# 🎵 TuneTailor

AI 기반 개인화 플레이리스트 생성 서비스입니다. 사용자의 취향과 상황을 분석하여 Spotify에서 맞춤형 플레이리스트를 자동으로 생성합니다.

## ✨ 주요 기능

- 🤖 **AI 분석**: OpenAI GPT를 통한 음악 취향 분석
- 🎼 **Spotify 연동**: 실제 Spotify 플레이리스트 생성
- 🔐 **OAuth 인증**: 안전한 Spotify 계정 연동
- 📱 **반응형 UI**: 모든 디바이스에서 최적화된 경험
- ⏰ **예약 생성**: 원하는 시간에 플레이리스트 자동 생성

## 🛠️ 기술 스택

### Frontend
- **React 18** + TypeScript
- **Vite** (빌드 도구)
- **Tailwind CSS** (스타일링)
- **shadcn/ui** (UI 컴포넌트)
- **Framer Motion** (애니메이션)

### Backend
- **Node.js** + Express
- **TypeScript**
- **Spotify Web API SDK**
- **OpenAI API**
- **Express Session** (세션 관리)

### 배포 & 인프라
- **Vercel** (호스팅)
- **GitHub Actions** (자동 배포)

## 🚀 시작하기

### 1. 저장소 클론

```bash
git clone https://github.com/wedosoft-alan/tunetailor.git
cd tunetailor
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env.example`을 참고하여 `.env` 파일을 생성하세요:

```bash
cp .env.example .env
```

필요한 환경 변수들:
- `SPOTIFY_CLIENT_ID`: Spotify Developer Dashboard에서 발급
- `SPOTIFY_CLIENT_SECRET`: Spotify Developer Dashboard에서 발급
- `OPENAI_API_KEY`: OpenAI API 키
- `SESSION_SECRET`: 세션 암호화용 랜덤 문자열

### 4. Spotify 앱 설정

[Spotify Developer Dashboard](https://developer.spotify.com/dashboard)에서:
1. 새 앱 생성
2. **Redirect URIs**에 `http://localhost:5001/auth/spotify/callback` 추가
3. Client ID와 Secret을 `.env`에 추가

### 5. 개발 서버 실행

```bash
npm run dev
```

http://localhost:5001에서 앱을 확인할 수 있습니다.

## 📦 배포

상세한 배포 가이드는 [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)를 참고하세요.

### 빠른 배포 (GitHub Actions)

1. GitHub Repository Secrets 설정
2. `main` 브랜치에 push
3. 자동 배포 완료!

### 수동 배포 (Vercel CLI)

```bash
npm i -g vercel
vercel login
vercel --prod
```

## 🔧 개발

### 스크립트

```bash
npm run dev          # 개발 서버 시작
npm run build        # 프로덕션 빌드
npm run vercel-build # Vercel용 빌드
npm run check        # TypeScript 타입 체크
npm start            # 프로덕션 서버 실행
```

### 프로젝트 구조

```
├── client/           # React 프론트엔드
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── lib/
├── server/           # Express 백엔드
│   ├── routes.ts     # API 라우터
│   ├── spotifyService.ts
│   ├── aiService.ts
│   └── index.ts
├── shared/           # 공유 타입/스키마
├── api/              # Vercel 서버리스 함수
└── .github/workflows/ # GitHub Actions
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.

## 🙏 감사의 말

- [Spotify Web API](https://developer.spotify.com/documentation/web-api/)
- [OpenAI API](https://openai.com/api/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Vercel](https://vercel.com/)