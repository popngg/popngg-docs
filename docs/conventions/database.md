# DB 컨벤션

## 이름

- 테이블명은 소문자 복수형을 우선합니다. 예: `users`, `songs`, `charts`
- 예약어를 테이블명으로 쓰지 않습니다.
- boolean 컬럼은 `is_hidden`, `is_deleted`처럼 의미가 드러나게 씁니다.
- 코드 컬럼은 `rank_code`, `medal_code`, `difficulty_code`처럼 suffix를 붙입니다.
- 내부 PK는 `{singular}_id` 형태를 사용합니다. 예: `song_id`, `chart_id`
- 외부 식별자는 의미를 드러내는 이름을 사용합니다. 예: `poptomo_id`, `song_hash`
- 외부 식별자가 표시 메타데이터에서 파생되고 변경될 수 있다면 내부 참조 기준으로 쓰지 않습니다. 예: `song_hash` 대신 `song_id`, `chart_id`
- created/updated 컬럼은 `created_at`, `updated_at`으로 통일합니다.
- 상태 컬럼은 `status`를 사용하고, 가능한 값은 문서 또는 enum으로 관리합니다.

## 타입

| 값 | 권장 타입 |
| --- | --- |
| 내부 id | `BIGINT` |
| 코드값 | `TINYINT` 또는 `VARCHAR` enum-like |
| boolean | `BOOLEAN` |
| 점수/popclass | `INT` |
| 날짜/시각 | `DATETIME` |
| hash | 길이가 고정되면 `CHAR(n)` |
| 짧은 이름 | `VARCHAR(64)` 또는 `VARCHAR(128)` |
| 곡명/장르명 | `VARCHAR(255)` |
| URL | `VARCHAR(512)` |

규칙:

- 시간대는 애플리케이션 기준으로 명확히 정합니다. 운영 저장은 UTC 또는 KST 중 하나로 통일합니다.
- 금액/점수처럼 정밀도가 필요한 값은 floating point를 쓰지 않습니다.
- JSON 컬럼은 MVP에서는 남용하지 않습니다. 검색 문서나 외부 원문 보관처럼 목적이 명확할 때만 사용합니다.

## 제약

- DB foreign key constraint는 만들지 않습니다.
- 필요한 unique key와 index는 명시합니다.
- 참조 정합성은 애플리케이션 검증과 정합성 점검 쿼리로 보완합니다.
- 주요 API는 예상 query plan을 기준으로 index를 먼저 설명할 수 있어야 합니다.
- 자주 쓰는 집계가 비싸지면 application query service를 유지한 채 summary table로 승격합니다.

DB FK를 만들지 않는 대신 다음을 지킵니다.

- 참조 id 컬럼은 항상 index 후보로 검토합니다.
- application 저장 전 참조 존재 여부를 검증합니다.
- migration 후 orphan check SQL을 작성합니다.
- 삭제는 기본적으로 soft delete를 우선합니다.

## Index

index 이름:

```text
uk_{table}_{columns}
idx_{table}_{columns}
```

예:

```sql
UNIQUE KEY uk_users_poptomo_id (poptomo_id),
KEY idx_playdata_user_scope_chart (user_id, best_type, target_version, chart_id)
```

규칙:

- unique 제약은 비즈니스 중복 방지 기준을 설명할 수 있어야 합니다.
- 정렬 조건이 있는 API는 정렬 컬럼까지 index에 포함할지 검토합니다.
- boolean 단독 index는 피하고, 조회 조건과 함께 복합 index로 둡니다.
- 새 index 추가 전 해당 API의 where/order by를 문서에 남깁니다.
- 사용하지 않는 index는 쓰기 성능을 떨어뜨리므로 주기적으로 점검합니다.

## Soft Delete

- 삭제 가능성이 있는 주요 테이블은 `is_deleted`를 사용합니다.
- 조회 API는 기본적으로 `is_deleted = false`만 반환합니다.
- unique key에 soft delete를 포함할지 여부는 중복 복구 정책에 따라 정합니다.
- 물리 삭제는 운영 정책과 백업/복구 기준이 정해진 뒤 사용합니다.

## Audit

- 주요 테이블은 `created_at`, `updated_at`을 둡니다.
- 이력 테이블은 `updated_at` 없이 append-only로 둘 수 있습니다.
- 로그인/갱신 로그는 개인정보와 민감정보를 저장하지 않습니다.
- batch/job 테이블은 `started_at`, `finished_at`, `retry_count`, `failure_reason` 후보를 검토합니다.

## Migration

- Flyway를 사용합니다.
- 운영에 적용된 `V*.sql`은 수정하지 않습니다.
- 변경은 새 버전 파일로 추가합니다.
- 대량 데이터 이전은 Flyway보다 별도 job/script를 사용합니다.
- 구조 변경이 큰 마이그레이션은 테이블 단위로 과도하게 쪼개지 않고, schema baseline/data transform/cutover 같은 큰 세션 단위로 관리합니다.
- 신규 스키마는 레거시 테이블 구조를 그대로 복제하지 않고, 현재 제품 기준으로 다시 설계합니다.

대량 갱신, 집계, migration job 기준은 [레거시 문제 대응 전략](../legacy-risk-response.md)을 참고합니다.

파일명 규칙:

```text
V1__baseline_account_and_security.sql
V2__baseline_music_catalog.sql
V3__baseline_playdata_and_logs.sql
V4__add_song_search_index_tables.sql
```

작성 규칙:

- 하나의 migration은 하나의 명확한 목적을 가집니다.
- DDL과 대량 DML을 가능하면 분리합니다.
- 운영 데이터가 큰 DML은 Flyway보다 별도 job으로 실행합니다.
- rollback SQL이 필요한 변경은 별도 runbook에 남깁니다.
- migration 전후 검증 SQL을 문서 또는 PR에 포함합니다.

## Query 작성

- N+1 가능성이 있는 조회는 Querydsl 또는 명시 query로 해결합니다.
- API response shape에 맞춘 조회 projection을 허용합니다.
- Entity 전체를 가져와 application에서 대량 가공하는 방식은 피합니다.
- pagination 없는 전체 조회는 관리자/배치에서도 신중히 사용합니다.
- 라이브서치 API는 DB 직접 검색, Redis read model, local memory index를 비교하되, 매 타이핑마다 무거운 join이 발생하지 않는 구조를 우선합니다.
