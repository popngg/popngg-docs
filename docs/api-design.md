# API 설계

## 원칙

- 프론트가 데이터 가공을 하지 않도록 서버에서 표시 가능한 형태로 내려줍니다.
- 내부 id와 외부 식별자를 분리합니다.
- rank, medal, difficulty 같은 코드는 label과 sort order를 함께 제공합니다.
- 기존 `/api/v2`와 신규 API의 호환/전환 정책을 문서화합니다.

## API 문서화 방식

MVP API는 OpenAPI 3.0 문서로 관리하고, MkDocs에서는 Redoc 페이지로 렌더링합니다.

- 사람이 읽는 설계 설명: 이 문서
- 기계가 읽는 API 계약: `docs/openapi/openapi.yaml`
- 렌더링된 API Reference: `api-reference.md`

초기에는 문서 repo의 OpenAPI 초안을 직접 관리합니다. 백엔드 구현이 안정되면 SpringDoc에서 생성되는 `/v3/api-docs`를 기준으로 OpenAPI 파일을 갱신하는 방식을 권장합니다.

## 후보 API

사용자 메모:

```text
/api/v1/constant/{songhash}/{difficulty}/{medal}
```

응답 초안:

```json
{
  "data": []
}
```

## 상수 API 초안

랭크, 메달, 난이도, 버전, 장르 표시 규칙을 내려주는 API를 권장합니다.

```http
GET /api/v1/constants
```

```json
{
  "ranks": [
    { "code": 100, "label": "S+", "sortOrder": 100 },
    { "code": 90, "label": "AA+", "sortOrder": 90 }
  ],
  "medals": [
    { "code": 10, "label": "어시이지", "sortOrder": 10 }
  ],
  "difficulties": [
    { "code": 1, "label": "Easy", "sortOrder": 1 }
  ]
}
```

## 곡 목록 API 초안

```http
GET /api/v1/songs
```

Query:

| 이름 | 설명 |
| --- | --- |
| `keyword` | 곡명, 장르명, 작곡가 검색 |
| `version` | 버전 필터 |
| `level` | 레벨 필터 |
| `difficulty` | 난이도 필터 |
| `tag` | 검색 태그 |

Response:

```json
{
  "songs": [
    {
      "songHash": "abc123",
      "genreName": "Genre",
      "songName": "Song",
      "artistName": "Artist",
      "version": 31,
      "jacketUrl": "https://example.com/jacket.png",
      "charts": [
        {
          "difficulty": 4,
          "level": 49,
          "rankSummary": {},
          "medalSummary": {}
        }
      ]
    }
  ]
}
```

## 플레이데이터 API 초안

```http
GET /api/v1/users/{poptomoId}/playdata
```

Response:

```json
{
  "user": {
    "poptomoId": "123456789",
    "name": "player",
    "popclass": 9000
  },
  "playdata": [
    {
      "songHash": "abc123",
      "difficulty": 4,
      "score": 98000,
      "rank": { "code": 100, "label": "S+" },
      "medal": { "code": 10, "label": "어시이지" },
      "updatedAt": "2026-05-09T00:00:00+09:00"
    }
  ]
}
```

## 검색 태그 기여

한국어 지원을 고려합니다.

- 태그 원문
- 정규화된 태그
- 언어 코드
- 기여자
- 승인 상태

검색은 초기에 MySQL 인덱스와 정규화 컬럼으로 시작하고, 검색 품질이 부족해지면 별도 검색 엔진을 검토합니다.

## 에러 응답

기존 `SuccessResponse` 스타일과 맞춰 공통 응답을 유지하되, 에러는 코드와 필드 단위 detail을 제공합니다.

```json
{
  "code": "INVALID_ARGUMENT",
  "message": "Invalid request.",
  "details": [
    { "field": "difficulty", "reason": "Unknown difficulty code." }
  ]
}
```
