# 데이터 갱신 API 계약

High☆Cheers collector가 사용하는 현재 백엔드 계약입니다. API prefix는 `/api/v1`입니다.

## 인증

- `Authorization: Bearer <token>`과 `access_token` HttpOnly 쿠키를 지원합니다.
- 로그인과 가입 성공 시 JWT 쿠키를 발급합니다.
- 쿠키 인증 브라우저 요청은 CORS credentials를 포함해야 합니다.

## 가입 확인과 가입

- `GET /api/v1/auth/registrations/{poptomoId}`: 가입 계정이면 200, 없으면 404
- `POST /api/v1/auth/register`: `{ "poptomoId": string, "password": string, "hidden": boolean }`
- 중복 ID는 `409 ALREADY_REGISTERED`
- collector 호환 입력 비밀번호는 SHA-256 소문자 hex 64자이며 DB에는 BCrypt로 저장

## 갱신

- `POST /api/v1/renewals`
- 인증 사용자와 `profile.gameId`가 다르면 `403 GAME_ID_MISMATCH`
- 현재 지원 게임은 `popn29`, collector version은 `1`
- 28에서 29로 처음 전환할 때 29 게임기에서 확인된 값을 버전/역대 점수의 기준으로 사용
- 전환 이후에는 버전 점수와 역대 점수 모두 최고점만 반영
- 숫자형 `chartId`를 우선 사용하고, 없으면 곡명·장르·난이도로 매칭
- `versionBestScore`의 숫자/null/누락을 각각 버전 최고점/이번 버전 미플레이/호환 입력으로 구분
- 최대 선언 payload 크기는 4 MiB

난이도 원본은 `l`, `light`, `easy`, `n`, `normal`, `h`, `hyper`, `ex`를 받습니다. 랭크와 메달은 원천값을 서버 내부 코드로 변환하며, `none`은 각각 코드 13으로 저장합니다.

## 오류 형식

```json
{ "code": "INVALID_PAYLOAD", "message": "The request payload is invalid." }
```

주요 오류 코드는 `UNAUTHENTICATED`, `GAME_ID_MISMATCH`, `INVALID_PAYLOAD`, `EMPTY_PAYLOAD`, `UNSUPPORTED_GAME`, `UNSUPPORTED_COLLECTOR_VERSION`, `UNKNOWN_DIFFICULTY`, `UNKNOWN_MEDAL_CODE`, `UNKNOWN_RANK_CODE`, `PAYLOAD_TOO_LARGE`, `MISSING_GAME_VERSION_TRANSITION`입니다.
