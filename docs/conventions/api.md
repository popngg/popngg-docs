# API 컨벤션

API는 프론트가 화면을 빠르게 그릴 수 있도록 필요한 정보를 명확히 내려주는 것을 우선합니다. DB 구조나 Entity 모양을 그대로 노출하지 않고, 화면과 use case 기준으로 endpoint와 response를 설계합니다.

## URL과 Method

| 목적 | Method | 예시 |
| --- | --- | --- |
| 목록 조회 | `GET` | `GET /api/songs` |
| 단건 조회 | `GET` | `GET /api/songs/{songId}` |
| 검색 | `GET` | `GET /api/songs/search?q=rin&limit=10` |
| 생성 | `POST` | `POST /api/renew-jobs` |
| 전체 수정 | `PUT` | MVP에서는 가급적 사용하지 않음 |
| 부분 수정 | `PATCH` | `PATCH /api/users/me/profile` |
| 삭제/숨김 | `DELETE` 또는 `PATCH` | soft delete는 `PATCH` 우선 |

규칙:

- URL은 복수 명사를 사용합니다. 예: `/api/songs`, `/api/charts`
- 동사는 URL보다 method와 use case 이름으로 표현합니다.
- 화면 편의용 aggregation endpoint는 허용하지만 이름에 의도를 드러냅니다. 예: `/api/users/{poptomoId}/profile-summary`
- 관리자 기능은 `/api/admin/...` 아래에 둡니다.
- 인증된 내 정보는 `/api/me/...` 또는 `/api/users/me/...` 중 하나로 통일합니다. 구현 전 최종 선택합니다.

## Request

- request body는 `Request` DTO로 받습니다.
- path variable은 내부 id인지 외부 id인지 이름으로 구분합니다. 예: `songId`, `songHash`, `poptomoId`
- 변경 API는 가능하면 내부 id를 사용합니다. 예: 곡 메타데이터 보정은 `songHash`가 아니라 `songId` 기준으로 처리합니다.
- query parameter가 2개 이상이면 application 계층에서는 `Query` 객체로 변환합니다.
- 빈 문자열과 `null`은 의미를 구분합니다.
- validation은 API 경계에서 먼저 수행하고, 비즈니스 검증은 application/domain에서 다시 수행합니다.

예:

```http
GET /api/songs/search?q=rin&limit=10
```

```java
public record SongSearchRequest(
        String q,
        Integer limit
) {
}
```

## Response

응답은 화면에 필요한 표시 정보를 포함합니다. 프론트가 rank/medal/difficulty label을 다시 계산하지 않게 합니다.

권장 형태:

```json
{
  "items": [],
  "meta": {
    "limit": 10,
    "hasMore": false
  }
}
```

규칙:

- 목록 응답은 가능하면 `items`로 감쌉니다.
- paging 또는 limit 정보는 `meta`에 둡니다.
- code/label/sortOrder가 필요한 값은 객체로 내려줍니다.
- 날짜는 ISO-8601 문자열을 사용합니다.
- 내부 DB id와 외부 식별자가 함께 필요하면 둘 다 명확히 내려줍니다. 예: `songId`, `songHash`
- `songHash`처럼 표시 메타데이터 변경에 따라 바뀔 수 있는 외부 alias는 영속 참조 기준으로 사용하지 않습니다.
- nullable 필드는 `null`의 의미를 API 문서에 설명합니다.

## Error

에러 응답은 모든 API에서 같은 형태를 사용합니다.

```json
{
  "error": {
    "code": "SONG_NOT_FOUND",
    "message": "곡을 찾을 수 없습니다.",
    "traceId": "..."
  }
}
```

규칙:

- `code`는 프론트 분기용 안정 값을 사용합니다.
- `message`는 사용자에게 보여도 되는 문장만 담습니다.
- 비밀번호, token, secret, 외부 응답 원문은 포함하지 않습니다.
- validation 실패는 field 단위 정보를 포함할 수 있습니다.

권장 status:

| 상황 | Status |
| --- | --- |
| request validation 실패 | `400` |
| 인증 필요 | `401` |
| 권한 없음 | `403` |
| 리소스 없음 | `404` |
| 중복/상태 충돌 | `409` |
| rate limit | `429` |
| 외부 시스템 실패 | `502` 또는 `503` |

## Pagination과 Limit

- 무제한 목록 응답은 만들지 않습니다.
- 단순 top N 검색은 `limit`을 사용합니다.
- 정렬 가능한 목록은 cursor pagination을 우선 검토합니다.
- offset pagination은 데이터가 작고 정렬 기준이 안정적일 때만 사용합니다.

검색 API 기준:

- `limit` 기본값은 10입니다.
- 최대 `limit`은 20 또는 30 중 회의에서 확정합니다.
- 빈 query와 한 글자 query 정책은 [곡 검색 API와 라이브서치](../meetings/song-search.md)에서 결정합니다.

## Live Search

라이브서치는 빠른 체감이 우선입니다.

백엔드 기준:

- 매 요청마다 DB join을 수행하지 않습니다.
- 회의에서 검색 엔진이 확정되기 전까지 Redis read model, local memory index, MySQL 검색을 후보로 비교합니다.
- 라이브서치 체감이 중요한 화면에서는 DB 직접 검색보다 검색용 read model을 우선 검토합니다.
- 응답은 top N만 반환합니다.
- query normalization과 ranking rule은 서버에서 관리합니다.
- Redis 장애 시 fallback 정책을 명확히 둡니다.

프론트 기준:

- 120~200ms debounce를 사용합니다.
- 이전 요청은 취소합니다.
- 늦게 도착한 이전 응답은 무시합니다.
- 동일 query는 짧게 cache할 수 있습니다.

## OpenAPI

- API 변경 시 `docs/openapi/openapi.yaml`도 함께 갱신합니다.
- 사람이 읽는 설명은 [API 설계](../api-design.md)에 남기고, schema 수준 계약은 OpenAPI에 남깁니다.
- request/response 예시는 실제 필드명과 타입을 맞춥니다.
- deprecated endpoint는 제거 전까지 OpenAPI에 표시합니다.
