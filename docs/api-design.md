# API 설계

이 문서는 신규 popn.gg 백엔드 API의 기준을 정리합니다. 레거시 endpoint를 그대로 복제하는 것이 아니라, 프론트가 빠르게 화면을 그릴 수 있도록 백엔드가 검색, 필터링, 페이지네이션, 집계, 표시용 응답을 책임지는 방향입니다.

<div class="doc-summary">
  <div class="doc-summary__item">
    <strong>API 설계 기준</strong>
    <p>도메인별 endpoint, 표시 가능한 response, 내부 id와 외부 식별자 분리, 관리자 API 분리를 우선합니다.</p>
  </div>
  <div class="doc-summary__item">
    <strong>중요한 변경</strong>
    <p>playdata는 `versionBest`, `allTimeBest`, `medal`을 함께 내려주고, 곡별 랭킹도 현재 버전/역대 랭킹을 분리합니다.</p>
  </div>
  <div class="doc-summary__item">
    <strong>주의할 점</strong>
    <p>이 문서는 구현 전 계약 초안입니다. 구현이 안정되면 SpringDoc과 OpenAPI YAML을 동기화해야 합니다.</p>
  </div>
</div>

## 원칙

- 모든 경로는 `/api/v1` prefix 아래에 둡니다.
- 프론트가 데이터 가공을 하지 않도록 서버에서 표시 가능한 형태로 내려줍니다.
- 내부 id와 외부 식별자를 분리합니다.
- `rank`, `medal`, `difficulty` 같은 코드는 label과 sort order를 함께 제공합니다.
- 랭크는 score에서 계산하지 않고 원천 데이터에서 받은 값을 저장합니다.
- 기존 API 명칭을 그대로 답습하기보다, 현재 제품의 화면과 행위에 맞는 API를 우선 설계합니다.
- 레거시 `/api/v2`와의 호환/전환이 필요하면 별도 전환 정책으로만 문서화합니다.

## API 문서화 방식

MVP API는 OpenAPI 3.0 문서로 관리하고, MkDocs에서는 Redoc 페이지로 렌더링합니다.

- 사람이 읽는 설계 설명: 이 문서
- 기계가 읽는 API 계약: `docs/openapi/openapi.yaml`
- 렌더링된 API Reference: `api-reference.md`

초기에는 문서 repo의 OpenAPI 초안을 직접 관리합니다. 백엔드 구현이 안정되면 SpringDoc에서 생성되는 `/v3/api-docs`를 기준으로 OpenAPI 파일을 갱신하는 방식을 권장합니다.

## MVP API 목록

아래 경로는 `/api/v1` prefix를 생략해 표기합니다.

### System/Auth

| 공개 | Method | Path | 설명 | MVP 판단 |
| --- | --- | --- | --- | --- |
| Yes | GET | `/` | healthcheck | 포함 |
| Yes | POST | `/auth/login` | 로그인 | 포함 |
| No | GET | `/auth/check` | 인증/어드민 권한 체크 | 후보. 관리자 화면에서 필요하면 포함 |
| Yes | POST | `/auth/password-reset/request` | 비밀번호 복구 메일 요청 | 포함 |
| Yes | POST | `/auth/password-reset/confirm` | 비밀번호 재설정 | 포함 |
| Yes | GET | `/constants` | 랭크/메달/난이도 등 게임 코드/표시 정책 | 포함 |

### Songs/Charts

| 공개 | Method | Path | 설명 | MVP 판단 |
| --- | --- | --- | --- | --- |
| No | POST | `/songs` | 곡/채보 등록 | 포함. 관리자 전용 |
| Yes | GET | `/songs` | 곡 목록/검색 | 포함 |
| Yes | GET | `/songs/recent` | 최신 추가 곡/채보 | 포함 |
| Yes | GET | `/songs/{songId}` | 특정 곡 GroupChart 정보 | 포함 |
| Yes | GET | `/charts/{chartId}` | 특정 채보 정보 | 포함 |
| Yes | GET | `/charts/{chartId}/summary` | 차트 상세 화면 aggregation | 포함 |
| Yes | GET | `/charts/{chartId}/rankings` | 곡별 랭킹 | 포함 |

### Users

| 공개 | Method | Path | 설명 | MVP 판단 |
| --- | --- | --- | --- | --- |
| Yes | GET | `/users/{poptomoId}` | 유저 프로필 페이지 정보 | 포함 |
| No | PATCH | `/users/{poptomoId}` | 유저 프로필 편집 | 포함. 본인/관리자 |
| No | PATCH | `/users/me/password` | 비밀번호 변경 | 포함 |
| No | PATCH | `/users/me/email` | 비밀번호 복구용 이메일 등록/변경 | 포함 |
| Yes | GET | `/users/rankings` | 유저 목록 페이지 | 포함 |
| Yes | GET | `/users/{poptomoId}/playdata` | 유저의 전체 데이터 | 포함 |
| Yes | GET | `/users/{poptomoId}/playdata/counts` | 레벨/난이도별 메달 또는 랭크 개수 | 포함 |
| Yes | GET | `/users/{poptomoId}/playdata/popclass` | 유저 팝클표 | 포함 |
| Yes | GET | `/users/{poptomoId}/playdata/charts/{chartId}/history` | 특정 유저의 특정 채보 히스토리 | 후보. 있으면 상세 페이지가 좋아짐 |

### Playdata/Assets/Admin

| 공개 | Method | Path | 설명 | MVP 판단 |
| --- | --- | --- | --- | --- |
| No | POST | `/playdata/imports` | 플레이데이터 갱신 및 등록. 기존 renew | 포함 |
| Yes | GET | `/playdata/compare` | 여러 유저 플레이데이터 비교 | 후보. 기존 기능 계승 |
| No | POST | `/songs/{songId}/jacket` | 자켓 업로드 | 포함. 관리자 전용 |
| No | POST | `/users/me/image` | 프로필 이미지 업로드 | 포함. 로그인 필요 |
| No | GET | `/admin/migrations/status` | Flyway migration 상태 확인 | 후보. Jenkins/DB 확인으로 충분하면 제외 |
| No | PATCH | `/admin/songs/{songId}` | 곡 메타데이터 보정 | 포함. 관리자 전용 |

## 레거시 API 계승 매핑

레거시 API는 기능 참고용이며, 경로 구조를 그대로 유지하지 않습니다. 계승 대상 기능과 새 경로는 아래 기준으로 정리합니다.

| legacy API | 가져올 기능 | 신규 API 방향 |
| --- | --- | --- |
| `POST /login` | 로그인 | `POST /auth/login` |
| `GET /profile/{poptomoId}` | 유저 프로필 조회 | `GET /users/{poptomoId}` |
| `PATCH /user/profile/{poptomoId}` | 유저 프로필 수정 | `PATCH /users/{poptomoId}` |
| `GET /user/ranking` | 유저 랭킹 | `GET /users/rankings` |
| `POST /renew/playdatas/first` | 첫 등록 | `POST /playdata/imports` |
| `POST /renew/playdatas` | 갱신 | `POST /playdata/imports` |
| `POST /renew/v2/playdatas` | 등록+갱신 통합 | `POST /playdata/imports` |
| `GET /playdata/medal/{poptomoId}` | 메달 집계 | `GET /users/{poptomoId}/playdata/counts?groupBy=medal` |
| `GET /playdata/rank/{poptomoId}` | 랭크 집계 | `GET /users/{poptomoId}/playdata/counts?groupBy=rank` |
| `GET /playdata/popclass/{poptomoId}` | 팝클표 | `GET /users/{poptomoId}/playdata/popclass` |
| `GET /playdata/all/{poptomoId}` | 유저 전체 playdata | `GET /users/{poptomoId}/playdata` |
| `GET /playdata/chart` | 차트 상세 aggregation + 랭킹 | `GET /charts/{chartId}/summary`, `GET /charts/{chartId}/rankings` |
| `POST /vs` | 여러 유저 비교 | `GET /playdata/compare` |
| `GET /history/{songHash}/{poptomoId}` | 특정 채보 히스토리 | `GET /users/{poptomoId}/playdata/charts/{chartId}/history` |
| `GET /charts`, `GET /charts/{level}` | 곡/채보 목록 조회 | `GET /songs` |
| `GET /charts/recent` | 최신 곡/채보 | `GET /songs/recent` |
| `GET /chart/{songHash}/{difficulty}` | 특정 채보 조회 | `GET /charts/{chartId}` |
| `POST /admin/chart` | 곡/채보 등록 | `POST /songs` |
| `POST /jacket/upload/{songHash}` | 자켓 업로드 | `POST /songs/{songId}/jacket` |
| `POST /profile` | 프로필 이미지 업로드 | `POST /users/me/image` |

레거시에서 가져오지 않을 것:

- `/secure/*` 이중 경로. 신규는 같은 경로에서 JWT/권한으로 제어합니다.
- `songHash` path 기반 식별. 신규는 `songId`, `chartId`를 우선 사용합니다.
- `/renew/playdatas/first`, `/renew/playdatas`, `/renew/v2/playdatas`의 분기된 의미. 신규는 하나의 import 계약으로 통합합니다.
- `/playdata/medal`, `/playdata/rank`처럼 응답 구조만 다른 중복 API. 신규는 count API + `groupBy`로 통합합니다.

## 엔드포인트 상세 계약

MVP API는 화면에서 필요한 데이터를 서버가 조합해서 내려주는 방향으로 설계합니다. 단, DB 조회는 항상 큰 join을 먼저 만들지 않고, `playdata` 또는 `charts`에서 대상 row를 줄인 뒤 필요한 메타데이터를 붙이는 방식으로 구현합니다.

### Health

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/` | 서버 상태 확인. 로드밸런서/배포 smoke test용 |

응답 `data`:

| 필드 | 설명 |
| --- | --- |
| `status` | `UP` |
| `version` | 애플리케이션 버전 |
| `serverTime` | 서버 현재 시각. 선택 |

### Auth

| Method | Path | 설명 | 권한 |
| --- | --- | --- | --- |
| POST | `/auth/login` | 팝토모 ID와 비밀번호로 로그인 | 공개 |
| GET | `/auth/check` | 현재 토큰의 인증/권한 확인 | 로그인 |
| POST | `/auth/password-reset/request` | 비밀번호 복구 메일 요청 | 공개 |
| POST | `/auth/password-reset/confirm` | reset token으로 비밀번호 변경 | 공개 |

`POST /auth/login` 요청:

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `poptomoId` | Yes | 로그인 식별자 |
| `password` | Yes | 평문 비밀번호. 서버에서만 검증하고 저장/로그에 남기지 않음 |

`POST /auth/login` 응답 `data`:

| 필드 | 설명 |
| --- | --- |
| `accessToken` | JWT access token |
| `tokenType` | `Bearer` |
| `expiresIn` | 초 단위 만료 시간 |
| `role` | `USER`, `ADMIN`, `BOT` |
| `user` | 로그인한 유저의 최소 프로필. 선택 |

비밀번호 복구 정책:

- `/auth/password-reset/request`는 이메일 존재 여부를 응답으로 노출하지 않습니다.
- reset token 원문은 DB에 저장하지 않고 hash만 저장합니다.
- `/auth/password-reset/confirm` 성공 시 token은 `usedAt` 처리되어 재사용할 수 없습니다.

### Constants

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/constants` | 프론트 표시용 rank, medal, difficulty 코드표 |

여기서 constants는 게임 코드/표시 정책입니다. 예를 들어 rank code `1`의 label이 `S+`인지, difficulty code `1`의 label이 `LIGHT`인지, medal code를 어떤 순서로 정렬할지를 프론트가 같은 기준으로 쓰기 위한 응답입니다.

상수 응답은 code, label, shortLabel, sortOrder를 포함합니다. rank는 참고 점수 구간을 내려줄 수 있지만, 서버와 프론트 모두 score로 rank를 재계산하지 않습니다.

### Songs/Charts

| Method | Path | 설명 | 권한 |
| --- | --- | --- | --- |
| POST | `/songs` | 곡/채보 등록 또는 업로드 | 관리자 |
| GET | `/songs` | 곡 목록/검색 | 공개 |
| GET | `/songs/recent` | 최신 추가 곡/채보 | 공개 |
| GET | `/songs/{songId}` | 곡 단위 상세 | 공개 |
| GET | `/charts/{chartId}` | 특정 채보 상세 | 공개 |
| GET | `/charts/{chartId}/summary` | 차트 상세 화면 aggregation | 공개 |
| GET | `/charts/{chartId}/rankings` | 차트 랭킹 전용 조회 | 공개 |

`GET /songs` query:

| 파라미터 | 설명 |
| --- | --- |
| `keyword` | 곡명, 장르명, 아티스트, 검색 태그/별칭 검색어 |
| `version` | 원곡 수록 버전 필터 |
| `chartVersion` | 채보 등장 버전 필터. Upper 신곡 필터에는 이 값을 사용 |
| `level` | 레벨 필터 |
| `difficulty` | 난이도 코드 |
| `isUpper` | Upper 채보 포함/필터 |
| `hasStrictGauge` | 짠게이지 채보 필터 |
| `hasStrictJudgement` | 짠판정 채보 필터 |
| `page`, `size` | 페이지네이션 |

`GET /songs` 구현 주의:

- 기본 응답은 `GroupedChart` 목록입니다.
- 검색은 `songs`에서 후보를 줄인 뒤 `charts`를 붙입니다.
- 한국어 별칭이나 줄임말은 `song_search_tags`를 통해 검색합니다. 예: `moonchild`를 `문차일드`로 검색.
- 모든 곡 + 모든 차트 + 플레이데이터 집계를 한 번에 join하지 않습니다.
- 트래픽이 늘면 `song_chart_summary` read table 후보입니다.

`POST /songs` 요청:

| 필드 | 설명 |
| --- | --- |
| `genreName` | 장르명 |
| `songName` | 곡명 |
| `artistName` | 아티스트. 없으면 null |
| `version` | 원곡 또는 곡 그룹 최초 수록 버전 |
| `jacketUrl` | 자켓 URL/key |
| `charts[]` | 난이도별 채보 |

`charts[]`:

| 필드 | 설명 |
| --- | --- |
| `difficulty` | 1 LIGHT, 2 NORMAL, 3 HYPER, 4 EX |
| `level` | 레벨 |
| `chartVersion` | 해당 채보가 등장한 버전. Upper는 원곡과 다를 수 있음 |
| `isUpper` | Upper 여부 |
| `hasStrictGauge` | 짠게이지 여부 |
| `hasStrictJudgement` | 짠판정 여부 |

### Users

| Method | Path | 설명 | 권한 |
| --- | --- | --- | --- |
| GET | `/users/{poptomoId}` | 유저 프로필 조회 | 공개. 비공개 유저는 제한 |
| PATCH | `/users/{poptomoId}` | 유저 프로필 수정 | 본인 또는 관리자 |
| PATCH | `/users/me/password` | 비밀번호 변경 | 로그인 |
| PATCH | `/users/me/email` | 비밀번호 복구용 이메일 변경 | 로그인 |
| GET | `/users/rankings` | 유저 랭킹 | 공개 |

`GET /users/rankings` query:

| 파라미터 | 설명 |
| --- | --- |
| `sort` | `displayPopclass`, `potentialPopclass`, `legacyPopclass` |
| `keyword` | 팝토모 ID 또는 유저명 검색 |
| `includeHidden` | 관리자 전용. 비공개 유저 포함 여부 |
| `page`, `size` | 페이지네이션 |

유저 응답은 계정 보안 정보와 공개 프로필을 섞지 않습니다. 이메일, password hash, reset token은 어떤 응답에도 포함하지 않습니다.

DB 기준으로는 `users`가 계정/인증/권한을, `user_profiles`가 공개 프로필과 랭킹 표시 캐시를 담당합니다. 공개 프로필/랭킹 API는 `user_profiles` 중심 projection으로 조회하고, `users`에서는 `poptomo_id`, `role`처럼 필요한 최소 필드만 붙입니다.

### Playdata

| Method | Path | 설명 | 권한 |
| --- | --- | --- | --- |
| POST | `/playdata/imports` | 크롤링한 플레이데이터 갱신/등록 | 로그인 또는 갱신 토큰 |
| GET | `/users/{poptomoId}/playdata/counts` | 레벨/난이도별 rank/medal 집계 | 공개 |
| GET | `/users/{poptomoId}/playdata/popclass` | 유저 팝클표 | 공개 |
| GET | `/users/{poptomoId}/playdata` | 유저 전체 플레이데이터 | 공개 |
| GET | `/charts/{chartId}/summary` | 차트 상세 화면용 aggregation | 공개 |
| GET | `/users/{poptomoId}/playdata/charts/{chartId}/history` | 유저의 특정 채보 성장 이력 | 공개 |
| GET | `/playdata/compare` | 여러 유저 비교 | 공개 |

공통 query:

| 파라미터 | 기본값 | 설명 |
| --- | --- | --- |
| `gameVersion` | 현재 버전 | 현재 버전 점수/팝클/랭킹을 조회할 게임 버전 |
| `difficulty` | 없음 | 난이도 필터 |
| `isUpper` | 없음 | Upper 필터 |

`POST /playdata/imports` 요청은 유저 프로필 snapshot과 playdata row 목록을 함께 받습니다.

`playdata[]` matching 후보:

| 필드 | 설명 |
| --- | --- |
| `chartId` | 있으면 가장 우선 사용 |
| `songId`, `difficulty`, `isUpper` | chartId가 없을 때 매칭 후보 |
| `songHash` | 외부 alias fallback. 변경될 수 있으므로 내부 참조 기준으로 사용하지 않음 |
| `genreName`, `songName`, `artistName` | songHash도 없을 때 보조 매칭 후보 |
| `version` | 원곡 수록 버전 |
| `chartVersion` | 채보 등장 버전 |
| `difficulty` | 난이도 |
| `isUpper` | Upper 여부 |

`playdata[]` record:

| 필드 | 설명 |
| --- | --- |
| `score` | 원천 score |
| `rankCode` | 원천 rank. 서버 계산 금지 |
| `medalCode` | 원천 medal |
| `gameVersion` | 점수가 관측된 게임 버전. 생략 시 서버 현재 버전 |

`POST /playdata/imports` 처리 결과:

| 필드 | 설명 |
| --- | --- |
| `renewLogId` | 갱신 로그 ID |
| `receivedCount` | 입력 row 수 |
| `matchedChartCount` | chart 매칭 성공 수 |
| `updatedPlaydataCount` | 현재 상태 row 변경 수 |
| `historyCreatedCount` | history 생성 수 |
| `skippedCount` | 매칭 실패 또는 저장 제외 수 |
| `displayPopclass`, `potentialPopclass` | 갱신 후 유저 팝클 |
| `unmatched[]` | 매칭 실패 row 요약 |

`GET /users/{poptomoId}/playdata/popclass`:

- 서버가 마킹한 `isDisplayPopclassTarget = true` row를 우선 조회합니다.
- 응답은 `versionBestTop50`와 각 row의 `allTimeBest`를 함께 내려줍니다.
- `versionBestTop50`는 `CURRENT_VERSION`, `OLD_VERSION` bucket별로 나눠 내려줍니다.
- 프론트는 상위 20/40 선정 로직을 다시 수행하지 않습니다.

`GET /charts/{chartId}/summary`:

- 차트 상세 페이지에서 필요한 `chart`, `versionBestRankings`, `allTimeBestRankings`, `myVersionBest`, `myAllTimeBest`, 히스토리 요약을 한 번에 내려주는 aggregation API입니다.
- 현재 버전 랭킹은 `chart_id`, `currentVersion`, `versionScore`로 먼저 줄이고, 역대 랭킹은 `chart_id`, `allTimeScore`로 줄인 뒤 상위 N명에 대해서만 유저 프로필을 붙입니다.

`GET /playdata/compare`:

- 비교 화면도 `versionBestUsers[]`, `allTimeBestUsers[]`를 함께 내려줍니다.
- 같은 chart에 대해 사용자별 현재 버전 기록과 역대 최고 기록을 나란히 비교할 수 있어야 합니다.

### Assets

| Method | Path | 설명 | 권한 |
| --- | --- | --- | --- |
| POST | `/songs/{songId}/jacket` | 자켓 업로드 | 관리자 |
| POST | `/users/me/image` | 내 프로필 이미지 업로드 | 로그인 |

MVP 응답은 업로드된 이미지 URL/key만 반환합니다. 이미지 조회는 별도 API보다 정적 URL 또는 object storage URL을 우선 사용합니다.

## 추가로 필요할 가능성이 높은 API

### 검색/필터

초기에는 `GET /songs`에 query parameter를 붙여 처리합니다.

후속 분리 후보:

```http
GET /search/charts
GET /search/users
```

분리 시점:

- 검색 옵션이 늘어남
- 한국어 태그 검색이 본격적으로 확장됨
- MySQL index 기반 검색이 부족해짐

### playdata 전용 조회

playdata를 보여주는 화면이 늘어나면 다음 API를 분리하는 편이 좋습니다.

```http
GET /charts/{chartId}/rankings
GET /users/{poptomoId}/playdata/summary
GET /users/{poptomoId}/playdata/charts/{chartId}
```

권장 역할:

- `GET /charts/{chartId}/rankings`: `versionBestRankings`, `allTimeBestRankings`를 독립 조회
- `GET /users/{poptomoId}/playdata/summary`: 프로필/대시보드에서 필요한 version best/all-time best 요약, 카운트, 최근 갱신 요약 제공
- `GET /users/{poptomoId}/playdata/charts/{chartId}`: 한 유저의 특정 채보에 대한 `myVersionBest`, `myAllTimeBest`, 히스토리 요약 제공

### 이미지 조회

이미지는 URL을 응답에 포함하는 쪽을 우선합니다. 그래도 프록시가 필요하면 다음 API를 고려합니다.

```http
GET /songs/{songId}/jacket
GET /users/{poptomoId}/image
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
PATCH /admin/songs/{songId}
PATCH /admin/charts/{chartId}
POST /admin/game-version-transitions
GET /admin/game-version-transitions
POST /admin/game-version-transitions/{transitionId}/apply
```

곡 메타데이터 변경은 `songHash`가 아니라 `songId`로 대상을 지정합니다. 장르명, 제목, 작곡가, 버전, 자켓 정보는 표시/검색 메타데이터이므로 보정될 수 있고, 이 값에 기반한 `songHash`도 바뀔 수 있습니다.

`PATCH /admin/songs/{songId}` 기준:

- 입력 후보: `genreName`, `songName`, `artistName`, `version`, `jacketUrl`
- 검색 태그/별칭은 `song_search_tags`로 관리합니다.
- 변경 전후 `songHash`가 달라지면 old/new mapping 또는 alias를 남깁니다.
- `songHash`가 달라지고 자켓이 기존 hash 기반 S3 key를 사용 중이면, 기존 object를 rename하지 않고 신규 `songHash` key로 copy/upload한 뒤 `jacketUrl` 또는 `jacketKey`를 전환합니다.
- 검색 read model, Redis cache, jacket/image key, 외부 URL cache를 무효화하거나 재빌드합니다.
- `playdata`, `history`, `charts` 같은 영속 데이터는 `songHash`가 아니라 `songId`/`chartId`를 기준으로 연결되어야 합니다.

MVP에서는 로그 테이블과 Jenkins 로그로 충분하면 일부 관리자 조회 API는 제외할 수 있습니다. 다만 곡 메타데이터 보정 API는 songhash 변경 가능성 때문에 별도 구현 후보로 유지합니다.

### 게임 버전 전환 API

버전이 올라갈 때 점수가 항상 초기화되는 것은 아닙니다. 예를 들어 `28 -> 29`에서는 기록이 초기화되어 `version_score`가 0부터 시작했지만, `29 -> 30`에서는 기록이 유지될 수 있습니다. 따라서 서버 현재 버전을 올리기 전에 운영자가 전환 정책을 명시해야 합니다.

```http
POST /admin/game-version-transitions
GET /admin/game-version-transitions
POST /admin/game-version-transitions/{transitionId}/apply
```

`POST /admin/game-version-transitions` 요청 후보:

```json
{
  "fromVersion": 29,
  "toVersion": 30,
  "scorePolicy": "CARRY_OVER",
  "memo": "29 -> 30 전환에서 KONAMI 기록 초기화 없음 확인"
}
```

`scorePolicy`:

| 값 | 의미 |
| --- | --- |
| `RESET` | 신규 버전의 `version_score`를 0 또는 첫 관측 점수로 시작 |
| `CARRY_OVER` | 이전 버전의 `version_score`를 신규 버전 시작 점수로 유지 |

적용 API 동작:

- `DRAFT` 정책만 적용할 수 있습니다.
- `playdata.current_version = fromVersion`인 row를 chunk 단위로 `toVersion`으로 전환합니다.
- `RESET`이면 `version_score = 0`, `version_rank_code = null`, `popclass = 0`을 기본값으로 두고 메달과 역대 최고 기록은 유지합니다.
- `CARRY_OVER`이면 기존 `version_score`, `version_rank_code`, `popclass`를 유지한 채 `current_version`만 바꿉니다.
- 두 정책 모두 `all_time_score`, `all_time_score_version`, `all_time_rank_code`, `medal_code`는 유지합니다.
- `RESET`은 `playdata_history.event_type = VERSION_INITIALIZED`, `CARRY_OVER`는 `VERSION_CARRIED_OVER`를 남깁니다.
- 적용 후 유저별 `display_popclass`와 팝클 산정 대상 마킹을 재계산합니다.

응답 후보:

```json
{
  "transitionId": 1,
  "fromVersion": 29,
  "toVersion": 30,
  "scorePolicy": "CARRY_OVER",
  "status": "APPLIED",
  "affectedPlaydataCount": 120000,
  "historyCreatedCount": 120000,
  "appliedAt": "2026-05-21T10:00:00+09:00"
}
```

전환 정책이 등록되지 않은 상태에서 서버 현재 버전만 올라간 경우, 갱신 API는 임의로 초기화/승계하지 않습니다. 운영자가 정책을 등록해야 한다는 에러를 남기고, Jenkins 또는 모니터링 알림으로 드러나게 합니다.

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

## API DTO 설계

API DTO는 HTTP 계층의 계약입니다. application command/query/result와 분리합니다.

```text
Controller
  Request DTO
    -> Command 또는 Query
    -> UseCase
    -> Result 또는 View
  Response DTO
```

예:

```text
POST /auth/login
  LoginRequest
    -> LoginCommand
    -> AuthenticateUserUseCase
    -> LoginResult
  LoginResponse
```

```text
GET /songs/{songId}
  path songHash
    -> FindGroupChartQuery
    -> FindGroupChartUseCase
    -> GroupChartView
  GroupChartResponse
```

`songHash` 기반 조회는 외부 URL 호환을 위한 alias 조회입니다. 응답에는 반드시 `songId`와 `chartId`를 포함하고, 이후 변경/이미지/히스토리 API는 내부 id를 기준으로 호출하게 합니다.

규칙:

- `Request`/`Response`는 `popngg-api`에 둡니다.
- `Command`/`Query`/`Result`/`View`는 `popngg-application`에 둡니다.
- `Entity`는 `popngg-infra` 밖으로 내보내지 않습니다.
- Controller는 request validation과 mapping만 담당합니다.
- API response는 프론트 표시를 위해 label, sortOrder, displayName을 포함할 수 있습니다.
- application result/view는 특정 HTTP status나 JSON 필드명에 묶이지 않게 설계합니다.

## GroupChart 응답

`song`과 `chart`는 DB에서 분리하지만, API에서는 프론트가 곡 단위로 렌더링하기 쉽게 GroupChart를 제공합니다.

```json
{
  "songId": 1001,
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
      "chartVersion": 29,
      "isUpper": true,
      "hasStrictJudgement": false,
      "hasStrictGauge": true,
      "isDeleted": false
    }
  ]
}
```

## 플레이데이터 정책

`POST /playdata/imports`는 기존 renew 역할을 합니다.

중요:

- 입력에는 `score`, `rankCode`, `medalCode`가 함께 들어와야 합니다.
- credit은 High☆Cheers 기준 4종 `normalCredit`, `extraCredit`, `timePlay10Credit`, `timePlay16Credit`로 받습니다.
- 이전 API의 `battleCredit`, `localCredit`은 신규 API에서 사용하지 않습니다.
- 서버는 score로 rank를 계산하지 않습니다.
- 크롤링한 score는 무조건 현재 게임 버전에서 나온 점수로 저장합니다.
- `playdata`는 `userId + chartId`당 하나의 현재 상태 row로 유지합니다.
- 현재 버전 점수는 `versionScore`, 역대 최고 점수는 `allTimeScore`, 유지 메달은 `medalCode`로 응답합니다.
- 서버는 chart level, 현재 버전 `versionScore`, 유지 `medalCode`를 기반으로 현재 버전 popclass를 계산해 저장합니다.
- `allTimeScore`가 변경되면 `potentialPopclass`를 반드시 재계산합니다.
- 현재 버전 `versionScore`가 변경되면 `displayPopclass`를 반드시 재계산합니다.
- 현재 버전 `versionScore`가 변경되면 서버는 `charts.chart_version` 기준으로 이번 버전 채보 20개, 구버전 채보 40개를 다시 선정해 playdata의 `popclassBucket` 마킹을 갱신합니다.
- 기록 갱신, 메달 변경, 버전 초기화/승계가 발생하면 `playdataHistory`를 append합니다.
- 크롤러는 `popclassBucket`을 보내지 않습니다. bucket은 서버 계산값입니다.
- 매칭되지 않은 chart는 실패 row로 기록하거나 `skippedCount`로 반환합니다.
- LONG POP ON/OFF 상태는 메달로 파악합니다.
- 실험 결과 LONG POP OFF `95000` 후 LONG POP ON `90000`을 기록하면 점수는 `95000`이 유지되고 메달만 바뀔 수 있습니다.
- 따라서 서버는 LONG POP ON/OFF를 이유로 score나 medal을 임의 보정하지 않고, 원천에서 보이는 score/rank/medal 조합을 저장합니다.
- popclass에 이 조합을 어떻게 반영할지는 추가 실험으로 확정합니다.

### 현재 상태와 성장 이력

High☆Cheers에서 처음으로 기존 점수 초기화가 확인되었지만, 이후 버전에서는 초기화가 없을 수도 있습니다. 따라서 API는 점수와 메달의 생명주기가 다르다는 점과, 버전 전환 정책이 `RESET`/`CARRY_OVER`로 달라질 수 있다는 점을 명확히 드러냅니다.

API 응답은 프론트가 구분할 수 있도록 각 플레이데이터에 다음 구조를 포함하는 것을 권장합니다.

| 필드 | 설명 |
| --- | --- |
| `versionBest` | 현재 게임 버전의 점수, 랭크, 팝클. 버전 전환 정책에 따라 초기화 또는 승계 |
| `allTimeBest` | 역대 최고 점수, 점수가 나온 버전, 랭크 |
| `medal` | 버전을 넘어 유지되는 현재 클리어 메달 |
| `history` | 기록 갱신, 메달 변경, 버전 초기화/승계 이벤트 |

조회 API 기준:

- `/users/{poptomoId}/playdata/popclass`는 display popclass 계산을 현재 버전 `versionScore` 기준으로 하고, 각 row에 `allTimeBest`도 함께 내려줍니다.
- `/users/{poptomoId}/playdata/counts`는 현재 버전 `versionRankCode`와 유지 `medalCode` 기준 count를 내려줍니다.
- `/users/{poptomoId}/playdata`는 각 row에 `versionBest`, `allTimeBest`, `medal`을 함께 내려줍니다.
- `/charts/{chartId}/summary`는 기본적으로 `myVersionBest`, `myAllTimeBest`, `versionBestRankings`, `allTimeBestRankings`를 함께 내려주는 방향을 우선합니다.
- `/users/{poptomoId}/playdata/charts/{chartId}/history`는 `gameVersion`을 포함한 이벤트 목록을 내려줍니다.
- `/playdata/compare`는 기본적으로 `versionBestUsers[]`와 `allTimeBestUsers[]`를 함께 내려줍니다.
- 곡별 랭킹을 보여주는 모든 API는 현재 버전 랭킹과 역대 랭킹을 분리해 함께 응답해야 합니다.
- `/users/{poptomoId}/playdata/popclass`는 서버가 미리 마킹한 `isDisplayPopclassTarget = true` row를 우선 조회합니다.

## 인증/권한

| API | 권한 |
| --- | --- |
| `POST /auth/login` | 공개 |
| `POST /auth/password-reset/*` | 공개 |
| `PATCH /users/{poptomoId}` | 본인 또는 관리자 |
| `PATCH /users/me/password` | 로그인 필요 |
| `PATCH /users/me/email` | 로그인 필요 |
| `POST /songs` | 관리자 |
| `PATCH /admin/songs/{songId}` | 관리자 |
| `POST /songs/{songId}/jacket` | 관리자 |
| `POST /users/me/image` | 로그인 필요 |
| `POST /playdata/imports` | 로그인 필요 또는 갱신 토큰 필요 |

`GET /auth/check`는 관리자 화면이 필요하면 유지합니다. 단순 권한 확인만 필요하면 JWT claim으로 대체할 수 있습니다.
