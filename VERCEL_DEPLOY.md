# Vercel 배포 가이드

## 🚀 자동 배포 (GitHub Actions) - 권장

### 1. GitHub Repository Secrets 설정

GitHub 저장소의 **Settings > Secrets and variables > Actions**에서 다음 시크릿들을 추가하세요:

#### 환경 변수:
- `SPOTIFY_CLIENT_ID`: 스포티파이 클라이언트 ID
- `SPOTIFY_CLIENT_SECRET`: 스포티파이 클라이언트 시크릿  
- `OPENAI_API_KEY`: OpenAI API 키
- `SESSION_SECRET`: 세션 암호화용 랜덤 문자열

#### Vercel 배포용:
- `VERCEL_TOKEN`: Vercel 개인 액세스 토큰
- `VERCEL_ORG_ID`: Vercel 조직 ID
- `VERCEL_PROJECT_ID`: Vercel 프로젝트 ID

### 2. Vercel 토큰 및 ID 얻기

#### Vercel Token:
1. [Vercel 설정](https://vercel.com/account/tokens)에서 새 토큰 생성
2. 토큰을 복사하여 GitHub Secrets에 `VERCEL_TOKEN`으로 추가

#### Org ID & Project ID:
```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 연결 (한 번만)
vercel link

# ID 확인
vercel env ls
```

또는 Vercel 대시보드 > 프로젝트 > Settings에서 확인 가능

### 3. 배포 실행

이제 `main` 브랜치에 push하면 자동으로 배포됩니다!

```bash
git add .
git commit -m "Deploy to Vercel"
git push origin main
```

---

## 🔧 수동 배포 (Vercel CLI)

### 1. Vercel CLI 설치 및 로그인

```bash
npm i -g vercel
vercel login
```

### 2. 환경 변수 설정

```bash
vercel env add SPOTIFY_CLIENT_ID
vercel env add SPOTIFY_CLIENT_SECRET  
vercel env add SESSION_SECRET
vercel env add OPENAI_API_KEY
```

각 명령어 실행 시 값을 입력하고 **Production** 환경을 선택하세요.

### 3. 배포 실행

#### 첫 배포:
```bash
vercel
```

#### 프로덕션 배포:
```bash
vercel --prod
```

---

## 🎵 Spotify 앱 설정 업데이트

배포 완료 후 [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)에서:

1. 앱 선택 > **Settings**
2. **Redirect URIs**에 추가:
   - `https://your-app-name.vercel.app/auth/spotify/callback`
   - `https://your-domain.com/auth/spotify/callback` (커스텀 도메인 사용시)

---

## ✅ 배포 후 확인사항

1. **사이트 접속**: `https://your-app-name.vercel.app`
2. **Spotify 인증**: `/auth/spotify` 링크 클릭하여 OAuth 테스트
3. **API 테스트**: `/api/spotify/test` 엔드포인트 확인
4. **플레이리스트 생성**: 실제 기능 테스트

---

## 🔧 문제 해결

### 일반적인 문제들:

#### 환경 변수 오류:
```bash
# 환경 변수 확인
vercel env ls

# 환경 변수 재설정
vercel env rm VARIABLE_NAME
vercel env add VARIABLE_NAME
```

#### Spotify 인증 실패:
- Redirect URI가 정확한지 확인
- HTTPS 사용 여부 확인 (로컬은 HTTP, 배포는 HTTPS)

#### 세션 문제:
- `SESSION_SECRET`이 설정되어 있는지 확인
- 쿠키 설정이 프로덕션 환경에 맞는지 확인

#### 빌드 오류:
```bash
# 로컬에서 빌드 테스트
npm run vercel-build
npm run check
```

### 로그 확인:
Vercel 대시보드 > 프로젝트 > Functions 탭에서 서버리스 함수 로그 확인

---

## 📝 커스텀 도메인 설정 (선택)

1. Vercel 대시보드 > 프로젝트 > **Settings** > **Domains**
2. 도메인 추가 및 DNS 설정
3. Spotify 앱에도 새 도메인 추가