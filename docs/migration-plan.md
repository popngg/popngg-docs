# 마이그레이션 계획

## 목표

- 서비스 중단 시간을 최소화하면서 신규 스키마로 전환합니다.
- 기존 플레이데이터, 유저, 차트 데이터를 손실 없이 이전합니다.
- songhash 변경에 따른 매핑 테이블을 남겨 롤백과 추적이 가능하게 합니다.
- 스키마 변경 이력은 Flyway로 관리합니다.

## 원칙

- Flyway는 스키마 생성, 인덱스 생성, 작은 seed 데이터에 사용합니다.
- 기존 운영 데이터의 대량 변환은 별도 migration job 또는 운영 전환 스크립트로 분리합니다.
- 운영 DB에 적용된 Flyway `V` 파일은 수정하지 않습니다.
- 변경이 필요하면 새 버전 파일을 추가합니다.
- destructive migration은 백업, 리허설, 수동 승인 후 수행합니다.

## Flyway 파일 구조

백엔드 저장소 기준 권장 위치:

```text
src/main/resources/db/migration/
  V1__init_users.sql
  V2__create_songs_and_charts.sql
  V3__create_playdata.sql
  V4__create_logs.sql
  V5__create_password_reset_tokens.sql
```

초기 MVP에서는 테이블 단위로 너무 잘게 쪼개기보다, 리뷰 가능한 크기로 나눕니다.

## 단계

### 1. 스키마 설계

- `users`, `songs`, `charts`, `playdata`, `playdata_history` 변경안 확정
- FK constraint 제거 범위 확정
- 인덱스와 unique 제약 확정
- songhash 생성 규칙 확정
- 비밀번호 복구용 `password_reset_tokens` 정책 확정

### 2. Flyway 스키마 생성

- 신규 테이블 생성 SQL을 Flyway `V` 파일로 작성합니다.
- 기존 테이블은 즉시 삭제하지 않습니다.
- 운영 배포 전 로컬/스테이징에서 `flyway_schema_history`를 확인합니다.
- 애플리케이션 시작 시 Flyway migration이 자동 실행되게 하되, 운영 배포에서는 Jenkins 단계에서 상태를 먼저 확인합니다.

### 3. 데이터 이전 준비

- 기존 `chart`에서 `songs`와 `charts`로 분리하는 스크립트 작성
- 기존 `playdata.chart_id`를 신규 `charts.chart_id`로 매핑하는 테이블 또는 파일 작성
- 기존 유저 비밀번호를 salt 정책에 맞춰 재해싱
- old/new songhash 매핑 테이블 또는 산출물 생성
- 실패 row 리포트 형식 정의

대량 데이터 이전은 Flyway에 넣지 않는 것을 권장합니다. 데이터 양, 실행 시간, 실패 복구가 스키마 migration보다 훨씬 민감하기 때문입니다.

### 4. 검증

필수 검증:

- 기존 곡 수와 신규 `songs` 수 비교
- 기존 chart 수와 신규 `charts` 수 비교
- `playdata` row count 비교
- 유저 row count 비교
- songhash 후보별 중복 여부 확인
- 신규 unique 제약 위반 여부 확인
- 비밀번호 복구 이메일 nullable/unique 동작 확인

### 5. 애플리케이션 라우팅 스위치

- 읽기 API를 신규 스키마로 전환
- 쓰기 API를 신규 스키마로 전환
- 필요하면 feature flag 또는 profile 기반 라우팅 사용

### 6. 최종 전환

1. 운영 DB를 백업합니다.
2. Jenkins 배포 job의 동시 실행을 막습니다.
3. 서버를 닫습니다.
4. Docker image를 배포합니다.
5. Flyway 스키마 migration 상태를 확인합니다.
6. 최종 데이터 싱크 job을 수행합니다.
7. 검증 쿼리를 다시 실행합니다.
8. 애플리케이션 설정을 신규 DB/테이블로 고정합니다.
9. 서버를 다시 엽니다.
10. 주요 API smoke test를 실행합니다.

## Jenkins 배포에서의 Flyway 위치

권장 파이프라인:

```text
checkout
→ test
→ build jar
→ build Docker image
→ push Docker image
→ backup DB
→ deploy container
→ Flyway migration
→ health check
→ smoke test
```

운영에서 더 보수적으로 가려면 Flyway를 애플리케이션 시작 자동 실행이 아니라 Jenkins의 명시 단계로 분리합니다.

```text
deploy migration container
→ run flyway migrate
→ deploy app container
```

둘 중 MVP에서는 Spring Boot Flyway 자동 실행으로 시작할 수 있지만, 운영 데이터가 커지면 migration container 분리를 권장합니다.

## 비밀번호 마이그레이션 초안

```text
for each user:
  salt = user.poptomo_id
  migrated_input = user.password + ":" + salt
  user.password_hash = passwordEncoder.encode(migrated_input)
```

로그인 시에는 사용자가 입력한 원문 비밀번호가 아니라 기존 hash를 어떻게 복원/비교할 수 있는지 확인해야 합니다. 현재 저장값이 이미 원문 비밀번호가 아닌 hash라면, 사용자가 입력한 비밀번호로는 `legacy_hash + salt`를 재현할 수 없습니다.

따라서 다음 중 하나를 확정해야 합니다.

| 방식 | 설명 |
| --- | --- |
| A | 기존 저장값이 사실상 로그인 secret이면 그대로 감싼 뒤, 로그인 입력도 같은 secret을 받음 |
| B | 기존 평문 입력을 legacy hash 함수로 먼저 변환한 뒤 salt 적용 |
| C | 전환 후 최초 로그인 때 새 hash로 업그레이드 |
| D | 비밀번호 재설정 플로우로 강제 전환 |

## 롤백 전략

- 기존 테이블은 전환 후 일정 기간 read-only로 보존합니다.
- old/new songhash 매핑을 보존합니다.
- Docker image tag를 배포 단위로 고정합니다.
- 신규 API 배포 후 문제가 생기면 이전 image로 되돌릴 수 있게 합니다.
- Flyway migration은 기본적으로 되돌리지 않고 forward fix를 우선합니다.
- 반드시 되돌려야 하는 변경은 백업 DB 복구 절차를 사용합니다.

## 마이그레이션 산출물

- Flyway SQL
- 데이터 변환 스크립트
- 검증 SQL
- old/new id 매핑 결과
- 실패 row 리포트
- Jenkins 배포 로그
- DB 백업 위치
- 전환 체크리스트
