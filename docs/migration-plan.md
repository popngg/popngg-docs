# 마이그레이션 계획

## 목표

- 서비스 중단 시간을 최소화하면서 신규 스키마로 전환합니다.
- 기존 플레이데이터, 유저, 차트 데이터를 손실 없이 이전합니다.
- songhash 변경에 따른 매핑 테이블을 남겨 롤백과 추적이 가능하게 합니다.
- 스키마 변경 이력은 Flyway로 관리합니다.
- 레거시 DB는 입력 데이터와 비교 기준으로만 사용하고, 새 운영/배포 기준은 신규 문서에 맞춥니다.

## 원칙

- Flyway는 스키마 생성, 인덱스 생성, 작은 seed 데이터에 사용합니다.
- 기존 운영 데이터의 대량 변환은 별도 migration job 또는 운영 전환 스크립트로 분리합니다.
- 운영 DB에 적용된 Flyway `V` 파일은 수정하지 않습니다.
- 변경이 필요하면 새 버전 파일을 추가합니다.
- destructive migration은 백업, 리허설, 수동 승인 후 수행합니다.
- 이번 리팩토링은 DB 구조 변화가 크므로 마이그레이션을 작은 테이블 단위가 아니라 큰 세션 단위로 관리합니다.
- 각 세션은 목표, 입력 데이터, 산출물, 검증 SQL, 롤백/중단 기준을 함께 가집니다.

## 마이그레이션 세션 전략

이번 마이그레이션은 다음처럼 큰 세션으로 나눕니다.

| 세션 | 목적 | 실행 방식 | 주요 산출물 |
| --- | --- | --- | --- |
| Session 1. Schema Baseline | 신규 스키마와 보조 테이블 생성 | Flyway | 신규 테이블, 인덱스, seed 상수 |
| Session 2. Identity Mapping | song/chart/user/playdata 매핑 기준 생성 | migration job/script | old/new id mapping, songhash mapping, 실패 row |
| Session 3. Data Transform | 실제 데이터 변환 및 적재 | migration job/script | users, songs, charts, playdata, history 적재 결과 |
| Session 3-1. Jacket Asset Migration | 기존 S3 자켓을 신규 songHash key로 재저장 | migration job/script | old/new jacket key mapping, 실패 object |
| Session 4. Verification | row count, unique, 정합성 검증 | SQL/script | 검증 리포트, diff 리포트 |
| Session 5. Cutover | 애플리케이션 라우팅 전환과 최종 싱크 | Jenkins/manual approval | 전환 로그, smoke test 결과 |
| Session 6. Stabilization | 전환 후 보정과 관찰 | 운영 job/query | 오류 row 보정, 모니터링 결과 |

세션을 크게 두는 이유:

- `chart -> songs/charts` 분리, `playdata` 버전 베스트 분리, 비밀번호 전환 정책처럼 서로 연결된 변경이 많습니다.
- 작은 Flyway 파일로만 쪼개면 “어떤 단위가 검증 완료되었는지” 추적하기 어렵습니다.
- 운영 전환 시에는 파일 개수보다 세션별 성공/중단 기준이 더 중요합니다.
- 데이터 변환은 재실행 가능성과 실패 row 추적이 필요하므로 schema migration과 같은 단위로 묶지 않습니다.

## Flyway 파일 구조

백엔드 실행 classpath 기준 위치:

```text
db/migration/
  V1__baseline_account_and_security.sql
  V2__baseline_music_catalog.sql
  V3__baseline_playdata_and_logs.sql
  V4__baseline_support_tables.sql
  V5__seed_constants.sql
```

실제 저장 위치는 Flyway 의존성과 datasource 설정을 어느 모듈이 소유하는지 결정한 뒤 확정합니다. 현재 멀티모듈 구조에서는 `popngg-infra/src/main/resources/db/migration/`, 애플리케이션 실행 모듈의 `src/main/resources/db/migration/`, 또는 별도 migration 모듈 중 하나를 선택해야 합니다.

초기 MVP에서는 테이블 하나당 파일 하나로 너무 잘게 쪼개지 않습니다. 대신 리뷰 가능한 큰 세션 단위로 묶습니다.

권장 묶음:

| Flyway 파일 | 포함 |
| --- | --- |
| `V1__baseline_account_and_security.sql` | `users`, `password_reset_tokens`, 인증/계정 관련 인덱스 |
| `V2__baseline_music_catalog.sql` | `songs`, `charts`, 곡/채보 인덱스 |
| `V3__baseline_playdata_and_logs.sql` | `playdata`, `game_version_transitions`, `playdata_history`, `renew_logs`, `login_logs` |
| `V4__baseline_support_tables.sql` | mapping/검증 보조 테이블이 DB에 필요할 경우 |
| `V5__seed_constants.sql` | rank/medal/difficulty seed를 DB로 둘 경우. MVP에서 코드 상수면 생략 가능 |

주의:

- Flyway 파일은 schema baseline을 만드는 데 집중합니다.
- 기존 운영 데이터 변환 SQL을 Flyway `V*.sql`에 직접 넣지 않습니다.
- 대량 데이터 변환은 재실행 가능한 job/script로 분리하고, 세션 단위 로그를 남깁니다.

## 단계

### 1. 스키마 설계

- `users`, `songs`, `charts`, `playdata`, `playdata_history` 변경안 확정
- FK constraint 제거 범위 확정
- 인덱스와 unique 제약 확정
- songhash 생성 규칙 확정
- 비밀번호 복구용 `password_reset_tokens` 정책 확정

### 2. Flyway 스키마 생성

- 신규 테이블 생성 SQL을 Flyway `V` 파일로 작성합니다.
- 테이블 단위보다 큰 baseline 세션 단위로 파일을 구성합니다.
- 기존 테이블은 즉시 삭제하지 않습니다.
- 운영 배포 전 로컬/스테이징에서 `flyway_schema_history`를 확인합니다.
- 운영 배포에서는 Jenkins 단계에서 상태를 먼저 확인하고, 필요하면 migration container를 별도로 실행합니다.

### 3. 데이터 이전 준비

- 기존 `chart`에서 `songs`와 `charts`로 분리하는 스크립트 작성
- `songs.version`은 원곡 또는 곡 그룹의 최초 수록 버전으로 적재하고, Upper처럼 나중에 추가된 채보의 버전은 `charts.chart_version`으로 분리해 적재
- 기존 `playdata.chart_id`를 신규 `charts.chart_id`로 매핑하는 테이블 또는 파일 작성
- 기존 `playdata`를 28버전 기록으로 변환하는 스크립트 작성
- `playdata.current_version`, `version_score`, `all_time_score`, `all_time_score_version`, `medal_code` 적재 정책 반영
- 초기 seed로 `28 -> 29` 전환은 `RESET` 정책을 등록하고, 이후 버전은 운영자가 `RESET` 또는 `CARRY_OVER`로 확정합니다.
- 기존 `"user"`를 `users`와 `user_profiles`로 분리 적재하는 스크립트 작성
- 기존 playdata를 28버전 current state로 적재한 뒤 `user_profiles.potential_popclass`를 계산하는 스크립트 작성
- 기존 credit/코인수는 신규 High☆Cheers credit으로 매핑하지 않고 0으로 초기화
- 기존 유저 비밀번호 저장값의 성격을 확인하고, 확정된 전환 방식에 따라 재해싱 또는 재설정 플로우 적용
- old/new songhash 매핑 테이블 또는 산출물 생성
- 곡 메타데이터 변경으로 songhash가 바뀔 경우를 대비해 old/new songhash alias 또는 redirect 정책 정의
- 기존 S3 자켓 key가 `oldSongHash` 기반이면, 신규 `newSongHash` 기반 key로 copy/upload하는 asset migration script 작성
- 자켓 migration은 기존 object를 삭제하거나 rename하지 않고, 신규 object 생성과 DB 참조 전환을 분리해서 수행
- 실패 row 리포트 형식 정의

대량 데이터 이전은 Flyway에 넣지 않는 것을 권장합니다. 데이터 양, 실행 시간, 실패 복구가 스키마 migration보다 훨씬 민감하기 때문입니다.

### 3-1. 세션별 실행 단위

데이터 변환 job은 내부적으로 작은 step을 가질 수 있지만, 운영 관리는 큰 세션 단위로 합니다.

| 세션 | Step 후보 |
| --- | --- |
| Identity Mapping | song dedupe, chart mapping, old/new songhash mapping, user mapping, Upper chart version mapping |
| Data Transform | users/user_profiles 이전, password 전환 정책 적용, 기존 credit/코인수 0 초기화, songs/charts 적재, `songs.version`/`charts.chart_version` 분리, playdata 적재, history 적재, logs 이전 |
| Jacket Asset Migration | 기존 S3 `oldSongHash` 자켓을 신규 `newSongHash` key로 copy/upload, `songs.jacket_url` 갱신, old/new jacket key mapping 저장 |
| Playdata Transform | 기존 점수 기준 `current_version = 28`, `version_score = 기존 score`, `all_time_score = 기존 score`, `all_time_score_version = 28` 생성, 필요 시 `playdata_history(MIGRATION)` 생성 |
| Version Transition Seed | `game_version_transitions(from_version = 28, to_version = 29, score_policy = RESET)` seed 등록 |
| Popclass Rebuild | `legacy_popclass` 보존, `potential_popclass` 계산, 필요 시 `display_popclass` 초기화 |
| Verification | row count 비교, orphan check, unique violation check, popclass 재계산 diff |

각 세션은 다음 값을 로그로 남깁니다.

- 시작/종료 시각
- 입력 row 수
- 성공 row 수
- 실패 row 수
- skip row 수
- 실패 사유별 count
- 산출 mapping 파일 또는 테이블 위치
- 재실행 가능 여부

### 4. 검증

필수 검증:

- 기존 곡 수와 신규 `songs` 수 비교
- 기존 chart 수와 신규 `charts` 수 비교
- `playdata` row count 비교
- `users`와 `user_profiles` row count 비교
- 모든 `users.user_id`에 대응하는 `user_profiles.user_id`가 있는지 확인
- songhash 후보별 중복 여부 확인
- 신규 unique 제약 위반 여부 확인
- 비밀번호 복구 이메일 nullable/unique 동작 확인
- 기존 `playdata`가 `current_version = 28`, `version_score = 기존 score`, `all_time_score = 기존 score`, `all_time_score_version = 28`로 들어갔는지 확인
- `playdata`가 `user_id + chart_id` 기준으로 중복 없이 생성되는지 확인
- `user_profiles.legacy_popclass`가 기존 `"user".popclass`를 보존하는지 확인
- `potential_popclass`가 `all_time_score` 기준으로 계산되었는지 확인
- `display_popclass`가 현재 버전 `version_score` 기준으로 계산되는지 확인
- 신규 credit 4종이 모두 0으로 초기화되었는지 확인. 기존 `normal/battle/local` 값이 임의로 섞이지 않았는지 확인
- 모든 기존 자켓이 신규 `song_hash` 기반 S3 key로 생성되었는지 확인
- `songs.jacket_url` 또는 `jacket_key`가 신규 key를 가리키는지 확인
- 기존 S3 자켓 object는 검증/롤백 기간 동안 삭제되지 않았는지 확인

### 4-1. 팝클래스 재계산 검증

마이그레이션 검증에는 유저별 팝클래스 3종 확인을 포함합니다.

| 컬럼 | 검증 기준 |
| --- | --- |
| `legacy_popclass` | 기존 DB의 `user.popclass`와 동일해야 합니다. |
| `potential_popclass` | 신규 `playdata.all_time_score` 상위 50개 기준 계산값이어야 합니다. |
| `display_popclass` | 현재 버전 `playdata.version_score` 상위 50개 기준 계산값이어야 합니다. 전환 직후 현재 버전 기록이 없으면 0 또는 정책상 초기값을 사용합니다. |

위 3개 컬럼은 `user_profiles`에 저장합니다.

`potential_popclass`는 마이그레이션 완료 조건입니다. 기존 기록을 `all_time_score`로 적재했다면 반드시 한 번 계산해 저장해야 하며, 계산 실패 유저가 있으면 세션을 성공 처리하지 않습니다.

### 5. 애플리케이션 라우팅 스위치

- 읽기 API를 신규 스키마로 전환
- 쓰기 API를 신규 스키마로 전환
- 필요하면 feature flag 또는 profile 기반 라우팅 사용

### 6. 최종 전환

1. 운영 DB를 백업합니다.
2. Jenkins 배포 job의 동시 실행을 막습니다.
3. 서버를 닫습니다.
4. Flyway 스키마 migration을 실행하거나 이미 적용된 상태를 확인합니다.
5. 최종 데이터 싱크 job을 수행합니다.
6. 검증 쿼리를 다시 실행합니다.
7. Docker image를 배포합니다.
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
→ Session 1. Flyway schema baseline
→ Session 2. migration dry-run or precheck
→ Session 3. final data transform
→ Session 4. verification
→ deploy app container
→ Session 5. cutover
→ health check
→ smoke test
```

운영에서 더 보수적으로 가려면 Flyway를 애플리케이션 시작 자동 실행이 아니라 Jenkins의 명시 단계로 분리합니다.

```text
deploy migration container
→ run flyway migrate
→ deploy app container
```

로컬 개발에서는 Spring Boot Flyway 자동 실행을 허용할 수 있습니다. staging/production, 특히 이번 리팩토링처럼 DB 구조가 크게 바뀌는 전환에서는 Jenkins의 명시 단계 또는 migration container를 우선합니다. 애플리케이션 컨테이너 시작과 schema baseline 적용이 섞이면 실패 시 원인 분리가 어려워집니다.

위험한 스키마 변경은 한 번에 처리하지 않습니다.

| 단계 | 의미 |
| --- | --- |
| Expand | 새 컬럼/테이블/index를 먼저 추가하고, 기존 API와 동시에 동작하게 함 |
| Deploy | 새 애플리케이션을 배포해 새 구조를 사용하게 함 |
| Contract | 더 이상 쓰지 않는 컬럼/테이블/코드를 별도 승인 후 제거 |

## 비밀번호 마이그레이션 검토

기존 `user.password`가 원문인지, 외부 secret인지, 이미 hash인지 확정되지 않았습니다. 따라서 현재 문서에서는 특정 재해싱 수식을 확정하지 않습니다.

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
