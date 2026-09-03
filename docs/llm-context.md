# LLM 컨텍스트

이 파일은 LLM이 프로젝트를 빠르게 이해하기 위한 압축 컨텍스트입니다. 코드 수정 전에는 최신 코드와 이 문서를 함께 확인해야 합니다.

레거시 코드는 참고 자료일 뿐입니다. 실제 구현 판단은 현재 `popngg` 코드와 migration을 우선하고, 이 문서는 압축된 보조 컨텍스트로 사용합니다.

## 프로젝트 한 줄 설명

popn.gg는 아케이드 리듬게임 `pop'n music`의 곡, 채보, 플레이데이터, 랭킹 정보를 제공하는 서비스입니다.

## 현재 리팩토링 기준

- 기준 게임 버전은 `pop'n music High☆Cheers!!`입니다.
- High☆Cheers에서 장르명 표기가 부활했습니다.
- High☆Cheers에서 랭크 체계가 변경되어 `S+`, `AA+`, `A+`, `B+`를 지원해야 합니다.
- High☆Cheers에서 `EASY` 난이도명이 `LIGHT`로 바뀐 것으로 관찰됩니다. 내부 code와 표시 label을 분리해야 합니다.
- 랭크는 서버 내부에서 점수로 계산하지 않습니다. clear 여부에 따라 달라질 수 있으므로 크롤링/갱신 시 원천 데이터의 랭크를 함께 저장합니다.

## 현재 기술 기준

- Java 21
- Spring Boot 3.5
- Gradle wrapper 8.13
- Gradle 멀티모듈
- MySQL 8.0
- Spring Security + JWT
- SpringDoc OpenAPI
- JPA, Querydsl
- Docker 기반 배포
- Prometheus/Grafana/Loki/Alloy production monitoring과 구조화 로그 수집 구현. Alertmanager는 다음 단계 설계
- Flyway DB migration (`V1`~`V21` 적용)

## 모듈 경계

| 모듈 | 역할 |
| --- | --- |
| `popngg-api` | HTTP Controller, request/response DTO, 웹 설정 |
| `popngg-application` | UseCase, service, port, application DTO |
| `popngg-domain` | 도메인 모델, 값 객체, 도메인 예외 |
| `popngg-infra` | DB Entity, JPA Repository, mapper, security adapter |

아키텍처 기준은 헥사고널 아키텍처입니다. `api`와 `infra`는 adapter이고, `application`과 `domain`은 core입니다. Controller는 request를 command/query로 바꿔 use case를 호출하고, infra는 application port를 구현합니다.

DTO 흐름:

```text
Request DTO -> Command/Query -> UseCase -> Result/View -> Response DTO
Entity <-> Domain/Result/View 변환은 infra adapter 내부에서 수행
```

금지:

- Controller에서 Repository 직접 호출
- application에서 JPA Entity 또는 HTTP DTO 참조
- domain에서 Spring/JPA/Web 의존성 참조
- Entity를 API response로 직접 반환
- Request/Response DTO를 use case 입력/출력으로 재사용

## 현재 구현된 구조

- 곡 메타데이터는 `songs`, 난이도별 채보는 `charts`로 분리되어 있습니다.
- 계정과 공개 프로필은 `users`, `user_profiles`로 분리되어 있습니다.
- playdata는 현재 버전 점수, 역대 점수, 버전 최고점 제공 여부를 함께 관리합니다.
- `game_version_transitions`가 버전 전환의 `RESET`/`CARRY_OVER` 정책을 관리합니다.
- 메달 코드는 High☆Cheers 원천 코드 순서에 맞춰 1~12, 없음은 13을 사용합니다.
- 로그인/가입은 JWT를 HttpOnly 쿠키로 발급하며 Bearer token도 호환합니다.
- 운영 스키마는 적용된 Flyway 파일을 수정하지 않고 새 migration을 추가합니다.
- 계정 설정 API는 프로필/아바타/비밀번호 변경을 제공하고 이미지는 S3에 저장합니다.
- Discord 관리자 명령은 곡 추가·수정·조회와 미등록 목록 처리를 지원합니다.
- 갱신 중 미확인 곡은 `unknown_chart_reports`에 곡 단위로 누적하며 불확실한 난이도/UPPER 값은 null로 둡니다.
- 사용자 목록의 클리어 레벨은 `user_clear_levels`에 사전 집계하고 공개 첫 페이지는 revision 기반 Redis 캐시를 사용합니다. Redis 장애 시 MySQL로 fallback합니다.

## 구현 및 운영 기준

- 게임 버전 기준: High☆Cheers
- 랭크 추가: `S+`, `AA+`, `A+`, `B+`
- 랭크 저장 정책: score 기반 계산 금지, 크롤링된 rank 저장
- 난이도 표시 변경: `EASY` 대신 `LIGHT` 지원
- 메달 코드표: `GOLD_STAR`부터 `LONGOFF_CLEAR`까지 확정된 12종. 코드 숫자는 식별자이며 정렬/우열 비교는 `MedalPolicy.sortOrder` 사용
- LONG POP 검증: OFF `95000` 후 ON `90000`이면 점수는 `95000` 유지, 메달만 변경 가능
- 자켓/곡 표시 변경: 장르명 추가, 어퍼딱지 표시 삭제
- `chart`에서 `song` 메타데이터 분리 완료
- `songs.version`은 원곡 또는 곡 그룹의 최초 수록 버전, `charts.chart_version`은 난이도별 채보 또는 Upper 채보의 실제 등장 버전입니다.
- 같은 song이라도 Upper가 나온 버전은 다를 수 있으므로 신곡/구곡 판정과 팝클 bucket 선정은 `charts.chart_version` 기준으로 합니다.
- 짠게이지는 `charts` metadata로 저장: 노트 수가 1536개를 넘는 채보에서 적용되므로 같은 곡이라도 높은 난이도만 짠게이지일 수 있음
- 짠판정도 난이도별 차이 가능성을 열어두고 `charts` metadata 우선
- playdata는 `user_id + chart_id`당 1 row current state로 관리: `current_version`, `version_score`, `all_time_score`, `all_time_score_version`, `medal_code`를 저장
- playdata_history는 기록 갱신, 메달 변경, 버전 초기화/승계 같은 의미 있는 변화만 append하고 `game_version`을 반드시 저장
- High☆Cheers에서 처음 점수 초기화가 확인됐지만 이후 버전에서는 초기화가 없을 수도 있으므로 `game_version_transitions.score_policy`로 `RESET` 또는 `CARRY_OVER`를 선언
- 기존 DB playdata는 28버전 점수로 마이그레이션하고, 앞으로 크롤링한 점수는 무조건 현재 버전 기록으로 저장
- 유저는 `users`와 `user_profiles` 2테이블로 분리: `users`는 계정/인증/권한, `user_profiles`는 공개 프로필/랭킹 표시 캐시/credit
- `user_profiles`는 팝클을 3개 보유: `display_popclass`는 현재 버전 `version_score` 기준, `potential_popclass`는 `all_time_score` 기준 포텐셜, `legacy_popclass`는 28버전 이전 기존 값
- credit은 `user_profiles`에 High☆Cheers 기준 4종으로 저장: `normal_credit`, `extra_credit`, `time_play_10_credit`, `time_play_16_credit`. 기존 credit/코인수는 마이그레이션에서 0으로 초기화
- songhash 정책 재검토: 기존에는 장르명/제목이 불변이라는 가정이 있었지만 이제는 변경 가능. `song_hash`는 내부 참조 기준이 아니라 외부 조회 alias로 보고 `song_id`, `chart_id` 중심으로 연결
- 유저 비밀번호: 기존 저장값의 성격이 불명확하므로 일괄 재해싱을 확정하지 않음. 점진 재해싱, legacy 검증 후 업그레이드, 강제 재설정 중 결정 필요
- 비밀번호 복구: 이메일 기반 복구 기능 포함
- FK 제거: DB 차원의 cascading 비용이 리턴보다 큼
- 마이그레이션: Flyway는 schema baseline과 증분 변경, 레거시 대량 데이터 이전은 별도 `migration/` script로 관리
- 배포: 배포 파이프라인에서 Docker image를 빌드/배포하고, 운영 마이그레이션은 별도 단계로 분리
- 운영 서버 구성: 서버 1은 관측 스택(Prometheus, Grafana, Loki, Alertmanager, Alloy), 서버 2는 Spring Boot 애플리케이션, MySQL, Redis, Alloy, node exporter를 둡니다.
- 로그는 애플리케이션 stdout JSON log를 Alloy가 수집해 Loki로 전송하고, 메트릭은 Spring Boot Actuator/Micrometer의 `/actuator/prometheus`를 Prometheus가 수집합니다.
- 검색: 곡 라이브서치는 백엔드 API로 옮기되 Redis read model, local memory index, MySQL 검색 중 회의 후 확정
- 긴 작업: 플레이데이터 갱신, BOT 데이터 재계산, 테이블 생성, 이미지 fetch/S3 업로드는 request thread와 분리하고 job/worker/executor 기준으로 처리
- executor: 모든 queue는 bounded, rejection policy와 timeout을 명시하고 queue depth/rejected count를 모니터링
- API 응답: 프론트에서 데이터 가공하지 않도록 백엔드에서 계산/그룹핑/표시 데이터 제공
- playdata 조회 API는 한 row에서 `versionBest`, `allTimeBest`, `medal`을 응답 객체로 분리해 함께 내려주는 방향. 팝클 API 계산 기준은 현재 버전 `version_score`

## 열린 질문

- songhash 유니크 키는 어떤 조합으로 확정할 것인가?
- 곡 메타데이터 변경 시 old/new songhash alias 또는 redirect를 어떻게 유지할 것인가?
- 짠판정은 Song metadata로 충분한가, Chart metadata가 필요한가?
- 이메일 인증을 MVP 1차에 포함할 것인가, 이메일 등록 후 복구만 먼저 열 것인가?
- 갱신 코드는 KONAMI가 JSON을 제공하는지에 따라 구현 방식이 달라지는가?
- 기존 history를 얼마나 복원할지, 마이그레이션 초기 이벤트만 남길지 결정할 것인가?
- 기존 비밀번호 저장값을 어떤 방식으로 검증하고 신규 hash로 전환할 것인가?
- 곡 라이브서치의 MVP 검색 엔진은 Redis read model, local memory index, MySQL 중 무엇으로 할 것인가?
- 신규 게임 버전 전환 시 `RESET`/`CARRY_OVER` 정책은 누가 어떤 근거로 확정할 것인가?

## 코드 수정 시 주의

- 기존 멀티모듈 경계를 유지합니다.
- HTTP DTO와 도메인 모델을 직접 섞지 않습니다.
- HTTP DTO와 application command/query/result도 분리합니다.
- 변경 API는 Command, 조회 API는 Query를 use case 입력으로 사용합니다.
- UseCase interface와 application service 구현체를 분리합니다.
- outbound 의존성은 application port로 정의하고 infra adapter에서 구현합니다.
- rank, medal, difficulty는 정수 코드와 표시 label을 분리합니다.
- rank는 score에서 계산하지 말고 갱신 원천 데이터에서 받은 값을 저장합니다.
- playdata 저장 시 `current_version`, `version_score`, `all_time_score`, `all_time_score_version`, `medal_code`를 누락하지 않습니다.
- 서버 현재 버전과 `playdata.current_version`이 다르면 `game_version_transitions` 정책을 먼저 확인하고, 정책이 없으면 임의로 초기화/승계하지 않습니다.
- 현재 버전 크롤링 점수는 `version_score` 후보로 처리하고, 역대 최고를 넘는 경우 `all_time_score`도 갱신합니다.
- `display_popclass`는 현재 버전 `version_score`, `potential_popclass`는 `all_time_score`, `legacy_popclass`는 28버전 이전 기존 값을 기준으로 관리합니다.
- 위 팝클 3종과 credit 4종은 `users`가 아니라 `user_profiles`에 저장합니다.
- 마이그레이션 시 `potential_popclass`를 반드시 한 번 계산해 채웁니다.
- 갱신 데이터로 `all_time_score`가 변경되면 `potential_popclass`를 반드시 재계산합니다.
- 현재 버전 `version_score` 갱신 후 서버가 `charts.chart_version` 기준으로 이번 버전 채보 20개, 구버전 채보 40개를 선정해 `playdata.is_display_popclass_target`, `popclass_bucket`, `popclass_bucket_rank`를 마킹합니다.
- 크롤러/API 입력은 `popclass_bucket`을 보내지 않습니다. bucket은 서버 계산값입니다.
- 비밀번호 복구 token 원문은 DB에 저장하지 않고 hash만 `password_reset_tokens`에 저장합니다.
- password, reset token 원문, JWT secret, 외부 민감 header는 로그와 DB에 저장하지 않습니다.
- 로그인 성공 시 JWT access token은 JSON body가 아니라 `HttpOnly Secure Cookie`로 발급합니다. 프론트는 credential 포함 요청을 사용하고, 상태 변경 API는 CSRF 방어를 둡니다.
- request thread에서 대량 갱신, 대량 집계, S3/외부 HTTP 작업을 길게 수행하지 않습니다.
- 긴 갱신은 job 상태를 남기고 chunk 단위 transaction으로 처리합니다.
- 운영에 적용된 Flyway `V*.sql`은 수정하지 말고 새 파일을 추가합니다.
- 이번 리팩토링 마이그레이션은 작은 테이블 단위보다 큰 세션 단위로 문서화하고 검증합니다.
- Docker image는 배포마다 immutable tag를 사용합니다.
- High☆Cheers 전환처럼 버전별 정책이 바뀔 수 있는 값은 하드코딩보다 정책 객체 또는 상수 테이블을 우선 검토합니다.
- FK 제거 결정이 확정되면 JPA 연관관계도 엔티티 id 기반 참조로 바꿀지 검토해야 합니다.
- 마이그레이션 문서와 실제 스키마 변경을 함께 업데이트합니다.
