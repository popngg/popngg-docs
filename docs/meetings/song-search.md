# 곡 검색 API와 라이브서치

곡 검색은 사용자가 입력하는 즉시 반응해야 하는 기능입니다. 기존 서비스는 전체 곡 데이터를 프론트에 내려주고 클라이언트에서 직접 검색해 빠른 체감을 만들었습니다. 새 프로젝트에서는 검색 책임을 백엔드로 옮기되, 같은 수준의 빠른 경험을 유지해야 합니다.

Redis 도입이 가능하므로, DB 직접 검색, 서버 인메모리 검색, Redis 검색 read model 중 어떤 방식을 MVP 기준으로 선택할지 회의에서 결정합니다.

## 목표

- 라이브서치에서 사용자가 타이핑할 때 지연이 크게 느껴지지 않아야 합니다.
- 매 입력마다 무거운 DB join/search가 발생하지 않아야 합니다.
- 검색 결과는 곡 상세 이동에 필요한 최소 데이터만 반환합니다.
- 일본어, 영어, 한국어 태그/별칭 검색 확장을 고려합니다.
- 추후 OpenSearch/Elasticsearch로 확장할 수 있도록 API와 application query 경계를 분리합니다.

## 후보

| 옵션 | 구조 | 장점 | 단점 |
| --- | --- | --- | --- |
| Option 1 | MySQL 직접 검색 | 구현 단순, source of truth만 사용 | 라이브서치에서 DB 부하와 latency가 커질 수 있음 |
| Option 2 | 백엔드 local memory index | 매우 빠름, Redis 없이도 MVP 가능 | 서버가 여러 대면 index 동기화와 warm-up 고려 필요 |
| Option 3 | Redis search read model | 빠름, 여러 API 인스턴스가 공유 가능, 재시작 후 warm-up 유리 | index build/rebuild 정책과 Redis 장애 대응 필요 |
| Option 4 | OpenSearch/Elasticsearch | 오타 허용, 복잡한 랭킹, 고급 검색에 강함 | MVP 기준 운영 부담이 큼 |

초기 추천은 Option 3입니다. DB를 source of truth로 두고, Redis에는 검색용 read model과 prefix index를 저장합니다. 백엔드 local memory cache는 Redis 앞의 hot cache로만 검토합니다.

## Redis 사용 초안

Redis는 source of truth가 아닙니다. DB의 `songs`, `charts`, `song_search_tags` 데이터를 기반으로 검색 문서를 만들고 Redis에 반영합니다.

예상 key:

```text
song_search:doc:{songId}
song_search:prefix:{normalizedPrefix}
song_search:rank
song_search:index:version
```

검색 흐름:

```text
GET /api/songs/search?q=...
  -> query normalize
  -> Redis prefix index에서 후보 songId 조회
  -> Redis doc batch get
  -> backend ranking score 계산
  -> top 10~20 반환
```

index build 흐름:

```text
songs/charts/search tags 변경
  -> SearchDocument 생성
  -> prefix/alias/tag index 생성
  -> Redis에 versioned index 반영
  -> old index cleanup
```

## 검색 문서 후보

| 필드 | 용도 |
| --- | --- |
| `songId` | 내부 식별자 |
| `songHash` | 외부/API 식별자 후보 |
| `songName` | 표시와 검색 |
| `genreName` | 표시와 검색 |
| `artistName` | 표시와 검색 |
| `version` | 표시, 정렬 보정 |
| `jacketThumbUrl` | 검색 결과 미리보기 |
| `levels` | 난이도별 레벨 표시 |
| `searchTerms` | normalized 곡명/장르/아티스트/태그/별칭 |
| `popularityScore` | 동률 정렬 보정 후보 |
| `createdAt` | 최근 추가곡 보정 후보 |

검색 태그 예시:

| song | tag | type | 설명 |
| --- | --- | --- | --- |
| `moonchild` | `문차일드` | `KOREAN_ALIAS` | 한국어 검색 별칭 |
| `凛として咲く花の如く` | `린토시테` | `KOREAN_ALIAS` | 사용자가 자주 입력하는 한국어 표기 |
| `凛として咲く花の如く` | `rin` | `ROMANIZED` | 로마자 검색 별칭 |

`song_search_tags`는 공식 표시명이 아니라 검색 후보 확장용입니다. Redis 검색 문서에는 active tag만 반영합니다.

## 정규화 정책 후보

검색 품질은 정규화 규칙에 크게 의존합니다. 다음 항목을 어디까지 MVP에 포함할지 결정해야 합니다.

| 항목 | 예시 |
| --- | --- |
| 대소문자 통일 | `RIN` -> `rin` |
| 공백 제거 | `High Cheers` -> `highcheers` |
| 특수문자 제거/치환 | `High☆Cheers` -> `highcheers` |
| 전각/반각 정규화 | 전각 알파벳/숫자와 반각 알파벳/숫자 통일 |
| 일본어 원문 검색 | 곡명/장르명 원문 |
| 로마자/영문 별칭 | `凛として咲く花の如く` -> `rin` 같은 별칭 |
| 한국어 별칭/태그 | `song_search_tags`에 저장한 한국어 검색어 |

## 랭킹 규칙 후보

단순 포함 검색만으로는 결과가 흔들릴 수 있으므로 match type별 우선순위를 정합니다.

권장 초안:

```text
1. 곡명 exact match
2. 곡명 prefix match
3. 장르명 exact/prefix match
4. 별칭/태그 exact/prefix match
5. 곡명 contains match
6. 장르명/아티스트 contains match
7. popularity/version/recent 보정
```

응답에는 디버깅과 UI 개선을 위해 `matchType`을 포함할 수 있습니다. 단, 화면에서 그대로 노출할지는 프론트 정책으로 결정합니다.

## API 초안

```http
GET /api/songs/search?q={query}&limit=10
```

응답 초안:

```json
{
  "query": "rin",
  "items": [
    {
      "songId": 123,
      "songHash": "abc...",
      "songName": "凛として咲く花の如く",
      "genreName": "撫子ロック",
      "artistName": "紅色リトマス",
      "version": 15,
      "jacketThumbUrl": "...",
      "levels": {
        "LIGHT": 12,
        "NORMAL": 24,
        "HYPER": 39,
        "EX": 46
      },
      "matchType": "SONG_PREFIX"
    }
  ]
}
```

정책 후보:

- `limit` 기본값은 10, 최대값은 20 또는 30으로 제한합니다.
- 빈 query는 인기곡/최근곡을 반환할지, 빈 배열을 반환할지 결정합니다.
- 한 글자 query는 결과가 많으므로 limit을 더 작게 두거나 prefix index를 별도로 제한합니다.
- 응답은 검색 결과 카드에 필요한 최소 필드만 포함합니다.

## 프론트 연동 기준

백엔드 검색을 쓰더라도 프론트 체감 최적화는 필요합니다.

- 입력 debounce는 120~200ms 범위에서 시작합니다.
- 이전 요청은 `AbortController`로 취소합니다.
- 늦게 도착한 이전 응답은 무시합니다.
- 같은 query는 짧은 시간 client cache를 둡니다.
- IME 조합 중에는 요청을 과도하게 보내지 않도록 `compositionstart/end`를 고려합니다.
- 로딩 표시는 즉시 띄우지 않고 일정 시간 이상 지연될 때만 보여줍니다.

## Redis 장애와 fallback

회의에서 결정해야 할 장애 정책:

| 상황 | 후보 대응 |
| --- | --- |
| Redis unavailable | DB fallback, local memory fallback, 검색 일시 불가 중 선택 |
| Redis index missing | rebuild job 실행 후 degraded 응답 |
| index version mismatch | 새 index build 완료 전까지 이전 version 사용 |
| prefix 결과 과다 | 상위 N개만 저장하거나 score 기준으로 trim |

MVP에서는 Redis 장애 시 DB fallback을 둘지 신중히 결정해야 합니다. fallback이 DB를 과도하게 때리면 장애가 확산될 수 있습니다.

## 회의에서 결정할 질문

1. MVP 검색 엔진은 MySQL, local memory, Redis 중 무엇을 기준으로 할 것인가?
2. Redis를 도입한다면 prefix index 방식으로 충분한가, Redis Stack/Search까지 고려할 것인가?
3. 검색 결과에 `jacketThumbUrl`, `levels`, `matchType`을 포함할 것인가?
4. 빈 query와 한 글자 query는 어떤 결과를 반환할 것인가?
5. 한국어 별칭/태그는 MVP에 포함할 것인가, 추후 기능으로 둘 것인가?
6. 검색 index rebuild는 수동 admin API, Jenkins job, scheduler 중 무엇으로 실행할 것인가?
7. Redis 장애 시 DB fallback을 허용할 것인가, 검색 일시 불가로 제한할 것인가?
8. 검색 품질 평가용 테스트 query set을 어떤 기준으로 만들 것인가?

## 검증 항목

- 곡 수 기준 Redis 메모리 사용량 추정
- prefix 생성 길이별 key 수 추정
- 한 글자/두 글자 query의 후보 수 분포
- 일본어/영어/한국어 별칭 검색 성공률
- p95/p99 latency 목표
- DB fallback 시 최대 QPS와 DB 부하
- index rebuild 시간과 무중단 교체 방식

## 임시 결론 후보

확정 전까지 문서상 기본 후보는 다음으로 둡니다.

- DB는 source of truth입니다.
- Redis에 검색용 read model과 prefix/tag index를 둡니다.
- API는 top 10~20개만 반환합니다.
- 백엔드는 Redis 결과를 기반으로 ranking score를 계산합니다.
- 프론트는 debounce, request cancel, 짧은 query cache로 라이브서치 체감을 보완합니다.
- OpenSearch/Elasticsearch는 검색 요구가 커진 뒤 검토합니다.
