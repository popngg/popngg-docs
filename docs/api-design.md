# API 설계

## 원칙

- 모든 경로는 `/api/v1` prefix 아래에 둡니다.
- 프론트가 데이터 가공을 하지 않도록 서버에서 표시 가능한 형태로 내려줍니다.
- 내부 id와 외부 식별자를 분리합니다.
- `rank`, `medal`, `difficulty` 같은 코드는 label과 sort order를 함께 제공합니다.
- 랭크는 score에서 계산하지 않고 원천 데이터에서 받은 값을 저장합니다.
- 기존 `/api/v2`와 신규 API의 호환/전환 정책을 문서화합니다.

## API 문서화 방식

MVP API는 OpenAPI 3.0 문서로 관리하고, MkDocs에서는 Redoc 페이지로 렌더링합니다.

- 사람이 읽는 설계 설명: 이 문서
- 기계가 읽는 API 계약: `docs/openapi/openapi.yaml`
- 렌더링된 API Reference: `api-reference.md`

초기에는 문서 repo의 OpenAPI 초안을 직접 관리합니다. 백엔드 구현이 안정되면 SpringDoc에서 생성되는 `/v3/api-docs`를 기준으로 OpenAPI 파일을 갱신하는 방식을 권장합니다.

## MVP API 목록

아래 경로는 `/api/v1` prefix를 생략해 표기합니다.

| 공개 | Method | Path | 설명 | MVP 판단 |
| --- | --- | --- | --- | --- |
| Yes | GET | `/` | healthcheck | 포함 |
| Yes | POST | `/auth/login` | 로그인 | 포함 |
| No | GET | `/auth/check` | 인증/어드민 권한 체크 | 후보. 관리자 화면에서 필요하면 포함 |
| Yes | POST | `/auth/password-reset/request` | 비밀번호 복구 메일 요청 | 포함 |
| Yes | POST | `/auth/password-reset/confirm` | 비밀번호 재설정 | 포함 |
| Yes | GET | `/constants` | 랭크/메달/난이도 표시 상수 | 포함 |
| No | POST | `/chart` | 차트 업로드 | 포함. 관리자 전용 |
| Yes | GET | `/chart/{songHash}` | 특정 노래 GroupChart 정보 | 포함 |
| Yes | GET | `/chart/{songHash}/{difficulty}` | 특정 채보 정보 | 포함 |
| Yes | GET | `/chart/recent` | 최신 차트. 메인페이지 | 포함 |
| Yes | GET | `/chart/all` | 모든 GroupChart 정보 | 포함 |
| Yes | GET | `/user/{poptomoId}` | 유저 프로필 페이지 정보 | 포함 |
| No | PATCH | `/user/{poptomoId}` | 유저 프로필 편집 | 포함. 본인/관리자 |
| No | PATCH | `/user/password` | 비밀번호 변경 | 포함 |
| No | PATCH | `/user/email` | 비밀번호 복구용 이메일 등록/변경 | 포함 |
| Yes | GET | `/user/ranking` | 유저 목록 페이지 | 포함 |
| No | POST | `/playdata` | 플레이데이터 갱신 및 등록. 기존 renew | 포함 |
| Yes | GET | `/playdata/count/{poptomoId}` | 레벨/난이도별 메달 또는 랭크 개수 | 포함 |
| Yes | GET | `/playdata/popclass/{poptomoId}` | 유저 팝클표 | 포함 |
| Yes | GET | `/playdata/all/{poptomoId}` | 유저의 전체 데이터 | 포함 |
| Yes | GET | `/playdata/main` | 특정 차트 페이지 정보 aggregation | 포함 |
| Yes | GET | `/playdata/history/{poptomoId}/{songHash}` | 특정 유저의 특정 곡 히스토리 | 후보. 있으면 상세 페이지가 좋아짐 |
| Yes | GET | `/playdata/versus` | 여러 유저 플레이데이터 비교 | 후보. 기존 기능 계승 |
| No | POST | `/image/jacket/{songHash}` | 자켓 업로드 | 포함. 관리자 전용 |
| No | POST | `/image/user` | 프로필 이미지 업로드 | 포함. 로그인 필요 |
| No | GET | `/admin/migrations/status` | Flyway migration 상태 확인 | 후보. Jenkins/DB 확인으로 충분하면 제외 |

## 추가로 필요할 가능성이 높은 API

### 검색/필터

초기에는 `/chart/all`에 query parameter를 붙여 처리합니다.

후속 분리 후보:

```http
GET /search/charts
GET /search/users
```

분리 시점:

- 검색 옵션이 늘어남
- 한국어 태그 검색이 들어감
- MySQL index 기반 검색이 부족해짐

### 이미지 조회

이미지는 URL을 응답에 포함하는 쪽을 우선합니다. 그래도 프록시가 필요하면 다음 API를 고려합니다.

```http
GET /image/jacket/{songHash}
GET /image/user/{poptomoId}
```

### 이메일 인증

MVP 1차에서 이메일 인증을 엄격히 넣는다면 다음 API가 필요합니다.

```http
POST /auth/email-verification/request
POST /auth/email-verification/confirm
```

### 관리자 검수

곡 데이터 수동 보정과 크롤링 실패 row 검수를 위해 후속 관리자 API가 필요할 수 있습니다.

```http
GET /admin/renew-logs
GET /admin/renew-logs/{renewLogId}
GET /admin/unmatched-playdata
PATCH /admin/charts/{chartId}
```

MVP에서는 로그 테이블과 Jenkins 로그로 충분하면 제외합니다.

## 응답 설계

기본 응답:

```json
{
  "code": "SUCCESS",
  "message": "Success",
  "data": {}
}
```

에러 응답:

```json
{
  "code": "INVALID_ARGUMENT",
  "message": "Invalid request.",
  "details": [
    { "field": "difficulty", "reason": "Unknown difficulty code." }
  ]
}
```

## GroupChart 응답

`song`과 `chart`는 DB에서 분리하지만, API에서는 프론트가 곡 단위로 렌더링하기 쉽게 GroupChart를 제공합니다.

```json
{
  "songHash": "2302440c63cbe103703f3de51ac205da",
  "genreName": "Genre",
  "songName": "Song",
  "artistName": "Artist",
  "version": 29,
  "jacketUrl": "https://example.com/jacket.png",
  "isUpper": false,
  "charts": [
    {
      "chartId": 1,
      "difficulty": { "code": 4, "label": "EX", "shortLabel": "EX", "sortOrder": 4 },
      "level": 49,
      "hasStrictJudgement": false,
      "hasStrictGauge": true,
      "isDeleted": false
    }
  ]
}
```

## 플레이데이터 정책

`POST /playdata`는 기존 renew 역할을 합니다.

중요:

- 입력에는 `score`, `rankCode`, `medalCode`가 함께 들어와야 합니다.
- 서버는 score로 rank를 계산하지 않습니다.
- 서버는 chart level, score, medal을 기반으로 popclass를 계산해 저장합니다.
- 매칭되지 않은 chart는 실패 row로 기록하거나 `skippedCount`로 반환합니다.
- LONG POP ON/OFF 상태는 메달로 파악하되, score와 popclass 적용 방식은 실기 검증 전까지 서버가 임의 보정하지 않습니다.

## 인증/권한

| API | 권한 |
| --- | --- |
| `POST /auth/login` | 공개 |
| `POST /auth/password-reset/*` | 공개 |
| `PATCH /user/{poptomoId}` | 본인 또는 관리자 |
| `PATCH /user/password` | 로그인 필요 |
| `PATCH /user/email` | 로그인 필요 |
| `POST /chart` | 관리자 |
| `POST /image/jacket/{songHash}` | 관리자 |
| `POST /image/user` | 로그인 필요 |
| `POST /playdata` | 로그인 필요 또는 갱신 토큰 필요 |

`GET /auth/check`는 관리자 화면이 필요하면 유지합니다. 단순 권한 확인만 필요하면 JWT claim으로 대체할 수 있습니다.
