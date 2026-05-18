# 테스트 컨벤션

테스트는 계층 책임을 확인하는 용도입니다. 모든 테스트가 Spring context를 띄우지 않게 하고, 빠른 단위 테스트와 필요한 통합 테스트를 분리합니다.

## 테스트 피라미드

| 계층 | 목적 | 권장 방식 |
| --- | --- | --- |
| Domain | 값 객체, enum, 계산식, 정책 검증 | plain JUnit |
| Application | use case 흐름, port 호출, 예외 변환 | mock/fake port |
| API | validation, status, response shape | `@WebMvcTest` 또는 MockMvc |
| Infra | JPA query, mapper, 외부 adapter contract | slice/integration test |
| End-to-end | 주요 사용자 흐름 smoke | 최소 개수 |

## 이름 규칙

테스트 클래스:

```text
ScoreTest
RenewPlaydataServiceTest
SongSearchControllerTest
PlaydataQueryAdapterTest
```

테스트 메서드는 한국어 또는 영어 중 팀이 읽기 쉬운 방식을 사용하되, 조건과 기대 결과가 드러나야 합니다.

예:

```java
@Test
void returnsTopResultsWhenQueryMatchesSongPrefix() {
}
```

## Domain 테스트

도메인 테스트는 Spring 없이 실행합니다.

검증 대상:

- 값 범위: `Score`, `RankCode`, `MedalCode`, `DifficultyCode`
- 동등성: 같은 값 객체 비교
- 계산식: popclass, bucket 선정, history event 판정
- 정책: rank는 score에서 계산하지 않는다는 제약

## Application 테스트

Application service는 port를 mock 또는 fake로 대체합니다.

검증 대상:

- command/query가 올바르게 처리되는지
- 실패한 port 호출을 의미 있는 application 예외로 바꾸는지
- transaction 안에서 처리해야 하는 상태 변경 순서가 맞는지
- 긴 작업은 job 생성과 processing use case가 분리되는지

규칙:

- JPA Entity를 application 테스트 fixture로 사용하지 않습니다.
- HTTP Request/Response DTO를 application 테스트에 넣지 않습니다.
- 외부 system adapter는 fake로 대체합니다.

## API 테스트

API 테스트는 HTTP 경계만 검증합니다.

검증 대상:

- path/query/body validation
- 인증/권한 status
- error response shape
- response DTO field 이름과 nullable 정책
- Controller가 올바른 command/query로 변환하는지

Controller 테스트에서 DB query나 계산식을 검증하지 않습니다.

## Infra 테스트

Infra 테스트는 실제 기술과의 계약을 확인합니다.

검증 대상:

- Querydsl/JPA query 결과
- index가 필요한 조회 조건
- Entity와 domain/view mapper
- Redis 같은 cache/search adapter가 도입될 경우 key 생성과 TTL
- S3 같은 object storage adapter가 도입될 경우 key 생성과 content type

DB query 테스트는 가능한 작은 fixture로 작성하되, 정렬/중복/비공개/BOT 제외 같은 edge case를 포함합니다.

## Fixture

- fixture 이름은 의도를 드러냅니다. 예: `hiddenUser()`, `songWithUpperCharts()`
- 테스트 데이터는 필요한 필드만 채웁니다.
- 공유 fixture가 너무 커지면 테스트별 builder를 둡니다.
- 랜덤 값은 피하고, 필요하면 seed를 고정합니다.

## 검색 테스트

곡 검색은 체감 품질이 중요하므로 별도 테스트 query set을 둡니다.

포함할 케이스:

- 곡명 exact/prefix/contains
- 장르명 검색
- 아티스트 검색
- 공백/특수문자 normalization
- 일본어 원문
- 한국어 별칭/태그
- 한 글자 query
- 결과 limit과 ranking tie-break

Redis 기반 검색을 선택하면 index build 테스트와 query 테스트를 분리합니다.

## 마이그레이션 테스트

- Flyway migration은 빈 DB에서 전체 적용되어야 합니다.
- 운영에 적용된 `V*.sql`은 수정하지 않습니다.
- 대량 데이터 이전 job은 샘플 old DB fixture로 dry-run 결과를 검증합니다.
- migration 후 row count, orphan reference, duplicate key 검증 SQL을 남깁니다.

## CI 기준

PR에서 최소로 확인할 것:

- unit test
- application test
- API contract test
- migration validation 또는 관련 문서 확인

느린 통합 테스트는 별도 stage로 분리할 수 있지만, main merge 전에는 실패가 보여야 합니다.
