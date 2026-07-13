# 인스타 실측 지표 수집 설정 (Business Discovery)

동기화 버튼을 누르면 `/api/metrics`(Vercel 서버리스, `api/metrics.js`)가 인스타그램
**Graph API Business Discovery**로 각 포스팅의 **좋아요·댓글**과 계정 **팔로워 수**를 수집해 반영한다.

## 수집 범위 / 한계
- ✅ **좋아요(Like), 댓글(Comment), 팔로워(Follower)** — 대상 인플루언서의 허락 없이 username으로 조회.
- ❌ **조회수(View)** — Business Discovery가 타인 게시물의 조회수를 제공하지 않음 → 기존(수동 입력) 값 유지.
- ⚠️ 대상은 **비즈니스/크리에이터 계정**이어야 함. 개인 계정은 조회되지 않음.
- ⚠️ 인스타 포스팅(피드/릴스)만 대상. 스토리·유튜브·블로그는 실측 수집 안 함.
- 팔로워가 갱신되면 Impression/Reach도 자동 재계산된다.

## 준비 (한 번만)
1. **Meta 개발자 앱 생성** — [developers.facebook.com](https://developers.facebook.com) → 앱 만들기(비즈니스 유형).
2. **인스타 비즈니스 계정 + 페이스북 페이지 연결** — 내 인스타를 비즈니스/크리에이터로 전환하고 FB 페이지에 연결.
3. 앱에 **Instagram Graph API** 제품 추가.
4. **권한**: `instagram_basic`, `pages_show_list`, (경우에 따라) `business_management`, `pages_read_engagement`.
   - 내 계정만 쓰는 초기(개발 모드)에는 앱 심사 없이 동작한다. 외부 배포 규모가 커지면 앱 검수 필요.
5. **IG User ID 확인** — Graph API Explorer에서
   `GET /me/accounts` → 페이지 id → `GET /{page-id}?fields=instagram_business_account` 로 IG User ID 획득.
6. **장기 토큰 발급** — 단기 토큰을 long-lived로 교환(약 60일 유효, 만료 전 갱신 필요):
   `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN`

## Vercel 환경변수 (서버 전용)
프로젝트 → Settings → Environment Variables 에 등록(‑ `VITE_` 접두사 없음 → 클라이언트에 노출 안 됨):
```
IG_USER_ID        = <IG User ID>
IG_ACCESS_TOKEN   = <장기 토큰>
GRAPH_VERSION     = v21.0   (선택)
```
등록 후 재배포하면 동기화가 실측값을 채운다. 값이 없으면 함수는 빈 결과를 반환하고
동기화는 파생 지표 재계산만 수행한다(에러 없음).

## 동작 방식 (요약)
- 프론트 `syncRows` → 인스타 포스팅의 `{username, shortcode}` 목록을 `/api/metrics`로 POST.
- 함수가 username별로 Business Discovery를 호출(미디어 최대 150건 탐색)해 shortcode를 매칭.
- 응답 `{ "<shortcode>": { like, comment, follower } }` → 행에 반영 후 파생 지표 재계산.

## 주의
- 이 앱은 로그인이 없어 `/api/metrics`도 공개다. 토큰 자체는 서버에만 있어 노출되지 않지만,
  외부인이 이 엔드포인트로 임의 username을 조회해 **토큰 사용량을 소모**시킬 수 있다.
  트래픽이 문제되면 엔드포인트에 허용 오리진/간단한 키 검증을 추가한다.
- Graph API에는 호출 한도(rate limit)가 있다. 포스팅이 매우 많으면 나눠서 동기화한다.
