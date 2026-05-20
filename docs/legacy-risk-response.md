# 레거시 문제 대응 전략

이 문서는 `popngg-old`에서 관찰한 위험을 새 프로젝트에서 어떻게 줄일지 정리합니다.

레거시 코드는 참고 자료입니다. 새 프로젝트의 목표는 같은 기능을 그대로 옮기는 것이 아니라, 웹 요청, 배치, 외부 I/O, DB 집계, 배포가 서로 영향을 덜 주는 구조로 다시 설계하는 것입니다.

## 핵심 방향

| 영역 | 레거시에서 보인 위험 | 새 프로젝트 기준 |
| --- | --- | --- |
| 요청 처리 | 갱신/집계/저장을 HTTP 요청 안에서 길게 처리 | 짧은 요청은 동기 처리, 긴 작업은 job으로 분리 |
| 실행 경계 | 스케줄, 갱신, 외부 호출이 한 애플리케이션 자원에 몰림 | request, worker, scheduler, external I/O 경계 분리 |
| DB | 대량 조회 후 애플리케이션에서 정렬/집계 | 조회 패턴별 index, summary, batch upsert |
| 보안/로그 | password 같은 민감정보가 로그/테이블에 남을 수 있음 | 민감정보 저장 금지, hash/token 원문 분리, 사유 code화 |
| 운영/배포 | jar 교체, 앱 내부 SSH tunnel, 불명확한 migration 흐름 | Jenkins, Docker, Flyway, health check, smoke test 분리 |

## 1. 요청 경로에서 긴 작업 분리

레거시의 `renewPlaydata`, `registerPlaydata`는 하나의 요청에서 입력 row를 순회하며 chart 조회, playdata 저장, history 저장, user popclass 갱신, renew log 저장을 처리했습니다. 데이터가 적을 때는 단순하지만, 입력 크기와 동시 요청이 늘면 request thread, DB connection, heap을 함께 잡아먹습니다.

새 프로젝트에서는 요청을 다음 두 흐름으로 나눕니다.

| 흐름 | 기준 |
| --- | --- |
| 즉시 처리 | 입력이 작고, DB 작업이 예측 가능하며, 사용자가 결과를 바로 봐야 하는 경우 |
| job 처리 | 입력 row가 많거나, 외부 호출/대량 upsert/재계산/history 생성이 포함되는 경우 |

권장 갱신 흐름:

```text
POST /renew
  -> request validation
  -> renewal job 생성
  -> job id 반환

worker
  -> job claim
  -> chunk 단위 chart 매칭
  -> chunk 단위 playdata upsert
  -> history append
  -> user summary 재계산
  -> renew log/status 갱신
```

운영 기준:

- `POST /renew`가 항상 전체 갱신 완료까지 기다릴 필요는 없습니다.
- 같은 `poptomoId`에 대한 갱신 job은 동시에 하나만 실행되게 합니다.
- job은 `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `PARTIAL` 같은 상태를 가집니다.
- 갱신은 idempotency key 또는 `poptomoId + sourceVersion + requestedAt bucket` 기준으로 중복 제출을 제어합니다.
- transaction은 전체 요청 하나로 길게 잡지 않고 chunk 단위로 짧게 유지합니다.
- 실패한 chunk와 실패 사유는 재처리 가능하게 남깁니다.

## 2. Executor와 Worker 분리

`@Async`를 붙이는 것만으로 안전해지지 않습니다. 오히려 긴 blocking 작업을 executor에 계속 밀어 넣으면 큐가 쌓이고, thread가 고갈되고, 결국 애플리케이션 전체가 느려집니다.

새 프로젝트에서는 작업 성격별로 실행 경계를 나눕니다.

| 실행 경계 | 담당 작업 | 정책 |
| --- | --- | --- |
| request thread | HTTP 요청 검증, command/query 변환, 짧은 use case | 오래 걸리는 작업 금지 |
| `backgroundTaskExecutor` | 짧은 후처리, 가벼운 캐시 갱신 | bounded queue, 낮은 max thread |
| `playdataRefreshExecutor` | 갱신 job 일부, popclass 재계산 | 작은 queue, 명시적 reject |
| `externalCallExecutor` | S3, 외부 HTTP, 이미지 fetch | 낮은 동시성, 짧은 timeout |
| scheduler/worker | 정기 집계, BOT 데이터 재계산, 테이블 생성 | 웹 요청과 분리 |

별도 worker로 분리할 기준:

| 조건 | 판단 |
| --- | --- |
| 실행 시간이 수 초 이상으로 흔들림 | worker 후보 |
| 외부 네트워크나 S3에 의존 | worker 또는 external executor |
| 대량 DB upsert/update 포함 | worker 후보 |
| 실패 후 재시도가 필요 | worker 후보 |
| 사용자가 즉시 결과를 기다리지 않아도 됨 | worker 후보 |

executor 공통 규칙:

- 모든 queue는 bounded로 둡니다.
- rejection policy를 명시합니다.
- timeout 없는 외부 호출을 허용하지 않습니다.
- executor별 thread count, active count, queue depth, rejected count를 모니터링합니다.
- `fire-and-forget` 작업은 금지하고, 추적 가능한 job/status를 둡니다.
- 대량 작업은 `saveAll` 한 번에 몰아넣기보다 chunk 크기를 정합니다.

## 3. DB와 조회 전략 재설계

레거시는 전체 목록을 가져온 뒤 애플리케이션에서 정렬/집계하는 흐름이 많았습니다. 데이터가 늘면 API latency, DB connection 점유, heap 사용량이 같이 증가합니다.

새 프로젝트의 DB 기준은 조회 패턴에서 출발합니다.

| 조회/작업 | 필요한 설계 |
| --- | --- |
| 유저 로그인/프로필 | `users.poptomo_id` unique index |
| 유저 랭킹 | `user_profiles.display_popclass desc`, 필요 시 `users.role` join |
| 유저 팝클 테이블 | `playdata(user_id, best_type, target_version, popclass desc, score desc)` |
| 곡별 랭킹 | `playdata(chart_id, best_type, target_version, score desc)` |
| 곡별 메달 랭킹 | `playdata(chart_id, best_type, target_version, medal_code, score desc)` |
| 레벨별 rank/medal 집계 | `playdata`와 `charts.level` 기준 집계 또는 summary table |
| 최근 갱신/이력 | `playdata_history(user_id, chart_id, created_at desc)` |

구현 원칙:

- API에서 필요한 정렬과 필터는 DB index가 받쳐야 합니다.
- 조회 API는 기본적으로 pagination 또는 limit을 가집니다.
- JPA entity graph나 fetch join을 의식적으로 사용해 N+1을 막습니다.
- 화면 단위 집계는 `application query service`로 분리하고, 내부 구현은 Querydsl/native query/summary table로 바꿀 수 있게 합니다.
- `playdata` 최신 상태와 `playdata_history` 이력은 역할을 분리합니다.
- popclass, 랭킹, 카운트처럼 자주 쓰는 값은 필요하면 summary column/table로 캐시합니다.
- 대량 migration과 대량 집계는 Flyway가 아니라 별도 job/script로 처리합니다.

summary table로 승격할 후보:

| 후보 | 이유 |
| --- | --- |
| `user_ranking_summary` | 유저 랭킹을 매번 전체 정렬하지 않기 위함 |
| `user_playdata_counts` | 레벨별 rank/medal count를 빠르게 응답 |
| `song_chart_summary` | 곡 목록에서 chart grouping을 반복하지 않기 위함 |
| `popclass_table_snapshots` | 주기 생성 테이블을 S3 파일 대신 DB/API 기준으로 관리 |

MVP에서는 정규화 테이블과 index로 시작하되, query service 경계를 두어 summary table로 옮기기 쉽게 만듭니다.

## 4. 보안과 로그 기준 재정의

레거시에서는 login log에 password가 저장될 수 있었습니다. 새 프로젝트에서는 인증과 로그를 처음부터 분리해서 설계합니다.

비밀번호 정책:

- password 원문은 DB, 로그, 예외 메시지에 저장하지 않습니다.
- 신규 비밀번호는 `BCrypt` 또는 `Argon2` 같은 password hasher로 저장합니다.
- 기존 비밀번호가 평문/외부 secret/기존 hash 중 무엇인지 확인한 뒤, 로그인 성공 시점에 신규 hash로 점진 재해싱합니다.
- 비밀번호 변경/복구 시 기존 token과 session 무효화 정책을 별도로 둡니다.

로그 정책:

| 로그 | 저장 가능 | 저장 금지 |
| --- | --- | --- |
| `login_logs` | `poptomo_id`, `user_id`, `status`, `failure_code`, `ip`, `created_at` | password, token 원문, JWT secret |
| `renew_logs` | 입력 row 수, 매칭 수, 갱신 수, 실패 code, 실패 row 식별자 | password, 외부 응답 원문 전체, 민감 header |
| 배포 로그 | image tag, stage, migration version, health result | secret, DB password, JWT secret |

토큰 정책:

- password reset token 원문은 DB에 저장하지 않고 hash만 저장합니다.
- JWT secret은 환경 변수나 secret manager로 주입합니다.
- secret은 Jenkins log에 출력되지 않도록 masking을 확인합니다.
- 외부 API 응답 원문을 저장해야 하면 보관 기간과 redaction 규칙을 먼저 정합니다.

오류 응답 정책:

- 사용자에게는 일반화된 메시지를 반환합니다.
- 내부 로그에는 추적 가능한 error code와 correlation id를 남깁니다.
- 인증 실패, 권한 실패, 데이터 없음, 외부 시스템 실패를 서로 다른 code로 구분합니다.

## 5. 배포와 운영 기준 재설계

레거시 배포는 jar 교체와 수동 실행에 가까웠고, 앱 내부 SSH tunnel과 profile 설정에 의존하는 흔적이 있었습니다. 새 프로젝트에서는 배포 가능한 산출물과 운영 절차를 명확히 분리합니다.

권장 배포 흐름:

```text
Git push
-> Jenkins
-> test
-> bootJar
-> Docker image build
-> Docker image push
-> migration precheck
-> Flyway migration
-> deploy
-> health check
-> smoke test
```

운영 기준:

- Docker image는 commit SHA 또는 release tag 같은 immutable tag로 배포합니다.
- `latest`만으로 운영 배포하지 않습니다.
- Flyway schema migration은 Jenkins 단계 또는 migration container로 명시 실행합니다.
- 대량 데이터 이전은 Flyway가 아니라 별도 migration job으로 실행합니다.
- 위험한 schema 변경은 `expand -> deploy -> contract` 순서로 나누고, contract 단계는 별도 승인 후 실행합니다.
- DB 접속 경로와 SSH tunnel은 애플리케이션 코드가 아니라 인프라 레이어에서 다룹니다.
- container memory limit과 JVM `Xmx`를 함께 설정합니다.
- 배포 전 DB backup과 rollback image tag를 확인합니다.
- 배포 후 `/actuator/health`와 주요 API smoke test를 통과해야 성공으로 봅니다.

초기 모니터링 필수 지표:

| 영역 | 지표 |
| --- | --- |
| HTTP | latency, 4xx/5xx, timeout |
| JVM | heap, GC pause, thread count |
| Executor | active count, queue depth, rejected count |
| DB | connection pool active/idle, slow query, lock wait |
| Job | queued/running/failed count, retry count, duration |
| Container | restart count, memory, CPU |
| Migration | version, duration, failed step |

운영에서 가장 먼저 보고 싶은 신호는 “서버가 켜져 있다”가 아니라 “작업이 밀리고 있는가”, “큐가 차고 있는가”, “DB connection이 고갈되는가”, “재시도가 폭증하는가”입니다.

## 구현 체크리스트

| 항목 | 완료 기준 |
| --- | --- |
| 요청 경로 분리 | 긴 갱신 API가 job id를 반환하거나, 명확한 timeout 내에 끝남 |
| job 상태 모델 | `QUEUED/RUNNING/SUCCESS/FAILED/PARTIAL` 상태와 조회 API 존재 |
| executor 분리 | 용도별 executor와 bounded queue, rejection policy 정의 |
| worker 분리 | 대량 갱신/집계/S3 작업이 request thread에서 실행되지 않음 |
| DB index | 주요 API query plan을 설명할 수 있는 index 정의 |
| summary 확장성 | query service가 summary table로 전환 가능하게 분리 |
| 보안 로그 | password/token 원문 저장 지점이 없음 |
| secret 주입 | secret이 Git과 Jenkins log에 노출되지 않음 |
| 배포 파이프라인 | Jenkins에서 test/build/image/migration/health/smoke가 분리됨 |
| 모니터링 | executor, DB pool, JVM, job 상태를 볼 수 있음 |

## 구현 우선순위

1. 갱신 요청을 job 모델로 분리합니다.
2. executor와 worker 경계를 먼저 잡고, 무거운 작업을 request thread에서 제거합니다.
3. `playdata`, `users`, `charts`의 주요 조회 index를 확정합니다.
4. login/renew log에서 민감정보 저장 가능성을 제거합니다.
5. Jenkins + Docker + Flyway 배포 흐름을 최소 형태로 먼저 완성합니다.

이 순서를 지키면 새 프로젝트는 기능을 늘리더라도 특정 작업 하나가 서버 전체를 끌고 내려가는 위험을 훨씬 줄일 수 있습니다.
