# GitHub 시작하기

## 1. 저장소 생성 & 첫 푸시

```bash
cd posting-monitoring
git init
git add .
git commit -m "feat: 인플루언서 포스팅 모니터링 대시보드 초기 구현"
git branch -M main

# GitHub CLI 사용 (권장)
gh repo create posting-monitoring --private --source=. --remote=origin --push

# 또는 웹에서 빈 저장소를 만든 뒤
git remote add origin https://github.com/<계정>/posting-monitoring.git
git push -u origin main
```

## 2. GitHub Pages 배포 켜기

저장소 → **Settings → Pages → Build and deployment → Source: `GitHub Actions`**

`main`에 푸시하면 `.github/workflows/deploy.yml`이 실행되고
`https://<계정>.github.io/posting-monitoring/` 로 배포된다.
(`vite.config.js`의 `base: "./"` 때문에 하위 경로에서도 정상 동작)

> 데이터는 브라우저 `localStorage`에 저장되므로 배포본은 사용자별 로컬 데이터로 동작한다.
> 팀 공유가 필요해지면 `src/lib/storage.js`를 서버 API로 교체할 것.

## 3. 백엔드 연동 시 (선택)

지표 수집 서버를 붙이면 저장소 → **Settings → Secrets and variables → Actions → Variables** 에
`VITE_METRICS_API_URL` 을 추가한다. 배포 워크플로우가 빌드 시 주입한다.

로컬에서는 `.env.local`:
```
VITE_METRICS_API_URL=https://api.example.com
```

## 4. 클로드 코드로 작업

```bash
cd posting-monitoring
claude
```

`CLAUDE.md`에 도메인 규칙과 설계 결정이 정리되어 있어 별도 설명 없이 바로 작업할 수 있다.

권장 브랜치 흐름:
```bash
git checkout -b feat/metrics-api
# 작업 후
gh pr create --fill
```
