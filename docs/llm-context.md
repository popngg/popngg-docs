# LLM 컨텍스트

이 파일은 LLM이 프로젝트를 빠르게 이해하기 위한 압축 컨텍스트입니다. 코드 수정 전에는 최신 코드와 이 문서를 함께 확인해야 합니다.

레거시 코드는 참고 자료일 뿐이며, 실제 기준은 이 문서와 나머지 설계 문서입니다.

## 프로젝트 한 줄 설명

popn.gg는 아케이드 리듬게임 `pop'n music`의 곡, 채보, 플레이데이터, 랭킹 정보를 제공하는 서비스입니다.

## 현재 리팩토링 기준

- 기준 게임 버전은 `pop'n music High☆Cheers!!`입니다.
- High☆Cheers에서 장르명 표기가 부활했습니다.
- High☆Cheers에서 랭크 체계가 변경되어 `S+`, `AA+`, `A+`, `B+`를 지원해야 합니다.
- High☆Cheers에서 `EASY` 난이도명이 `LIGHT`로 바뀐 것으로 관찰됩니다. 내부 code와 표시 label을 분리해야 합니다.
- 랭크는 서버 내부에서 점수로 계산하지 않습니다. clear 여부에 따라 달라질 수 있으므로 크롤링/갱신 시 원천 데이터의 랭크를 함께 저장합니다.

## 기술 기준

- Java 17
- Spring Boot 3.2.4
- Gradle 멀티모듈
- MySQL 8.0
- Spring Security + JWT
- SpringDoc OpenAPI
- JPA, Querydsl
- Jenkins + Docker 배포
- 로깅/모니터링은 `Prometheus + Grafana + Loki + Grafana Alloy`를 사용합니다.
- Flyway DB migration. 현재 코드에 의존성이 없다면 스키마 작업 시 추가해야 함

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

## 현재 관찰된 구조

- `ChartEntity`는 `chart` 테이블에 곡 메타데이터와 채보 데이터를 함께 저장합니다.
- `PlaydataEntity`는 `UserEntity`, `ChartEntity`를 `ManyToOne`으로 참조합니다.
- `UserEntity`는 `"user"` 테이블을 사용하며 `poptomo_id`, `password`, `role` 등을 가집니다.
- `Rank`, `Medal`은 현재 정수 래퍼 값 객체이고 구체적인 enum 제한은 없습니다.
- `AuthenticateUserService`에는 해싱 검증 로그인과 평문/기존값 비교용 `loginWithoutHash`가 함께 있습니다.

## 리팩토링에서 바뀌어야 하는 것

- 게임 버전 기준: High☆Cheers
- 랭크 추가: `S+`, `AA+`, `A+`, `B+`
- 랭크 저장 정책: score 기반 계산 금지, 크롤링된 rank 저장
- 난이도 표시 변경: `EASY` 대신 `LIGHT` 지원
- 메달 추가: 어시이지
- LONG POP 검증: OFF `95000` 후 ON `90000`이면 점수는 `95000` 유지, 메달만 변경 가능
- 자켓/곡 표시 변경: 장르명 추가, 어퍼딱지 표시 삭제
- `chart`에서 `song` 메타데이터 분리
- `songs.version`은 원곡 또는 곡 그룹의 최초 수록 버전, `charts.chart_version`은 난이도별 채보 또는 Upper 채보의 실제 등장 버전입니다.
- 같은 song이라도 Upper가 나온 버전은 다를 수 있으므로 신곡/구곡 판정과 팝클 bucket 선정은 `charts.chart_version` 기준으로 합니다.
- 짠게이지는 `charts` metadata로 저장: 노트 수가 1536개를 넘는 채보에서 적용되므로 같은 곡이라도 높은 난이도만 짠게이지일 수 있음
- 짠판정도 난이도별 차이 가능성을 열어두고 `charts` metadata 우선
- playdata는 현재 버전 베스트와 역대 베스트를 분리: `best_type`, `target_version`, `score_version`을 저장
- High☆Cheers에서 처음 점수 초기화가 확인됐지만 이후 버전에서도 반복될 수 있다고 보고 모델과 API를 일반화
- 기존 DB playdata는 28버전 점수로 마이그레이션하고, 앞으로 크롤링한 점수는 무조건 현재 버전 기록으로 저장
- users는 팝클을 3개 보유: `display_popclass`는 현재 표기용, `potential_popclass`는 `ALL_TIME_BEST` 기준 포텐셜, `legacy_popclass`는 28버전 이전 기존 값
- credit은 High☆Cheers 기준 4종: `normal_credit`, `extra_credit`, `time_play_10_credit`, `time_play_16_credit`. 기존 credit/코인수는 마이그레이션에서 0으로 초기화
- songhash 정책 재검토: 기존에는 장르명/제목이 불변이라는 가정이 있었지만 이제는 변경 가능. `song_hash`는 내부 참조 기준이 아니라 외부 조회 alias로 보고 `song_id`, `chart_id` 중심으로 연결
- 유저 비밀번호: 기존 저장값의 성격이 불명확하므로 일괄 재해싱을 확정하지 않음. 점진 재해싱, legacy 검증 후 업그레이드, 강제 재설정 중 결정 필요
- 비밀번호 복구: 이메일 기반 복구 기능 포함
- FK 제거: DB 차원의 cascading 비용이 리턴보다 큼
- 마이그레이션: DB 구조 변화가 크므로 schema baseline/data transform/cutover 같은 큰 세션 단위로 관리. Flyway는 schema baseline, 대량 데이터 이전은 별도 job/script
- 배포: Jenkins pipeline에서 Docker image를 빌드/배포하고, 운영 마이그레이션은 별도 단계로 분리
- 운영 서버 구성: 서버 1은 Jenkins와 관측 스택(Prometheus, Grafana, Loki, Alertmanager, Alloy), 서버 2는 Spring Boot 애플리케이션, MySQL, Redis, Alloy, node exporter를 둡니다.
- 로그는 애플리케이션 stdout JSON log를 Alloy가 수집해 Loki로 전송하고, 메트릭은 Spring Boot Actuator/Micrometer의 `/actuator/prometheus`를 Prometheus가 수집합니다.
- 검색: 곡 라이브서치는 백엔드 API로 옮기되 Redis read model, local memory index, MySQL 검색 중 회의 후 확정
- 긴 작업: 플레이데이터 갱신, BOT 데이터 재계산, 테이블 생성, 이미지 fetch/S3 업로드는 request thread와 분리하고 job/worker/executor 기준으로 처리
- executor: 모든 queue는 bounded, rejection policy와 timeout을 명시하고 queue depth/rejected count를 모니터링
- API 응답: 프론트에서 데이터 가공하지 않도록 백엔드에서 계산/그룹핑/표시 데이터 제공
- playdata 조회 API는 `VERSION_BEST`와 `ALL_TIME_BEST`를 응답에서 분리해 함께 내려주는 방향. 팝클 API도 계산 기준은 version best이지만 포함 playdata는 두 스코프를 함께 제공

## 열린 질문

- songhash 유니크 키는 어떤 조합으로 확정할 것인가?
- 곡 메타데이터 변경 시 old/new songhash alias 또는 redirect를 어떻게 유지할 것인가?
- 짠판정은 Song metadata로 충분한가, Chart metadata가 필요한가?
- 이메일 인증을 MVP 1차에 포함할 것인가, 이메일 등록 후 복구만 먼저 열 것인가?
- 갱신 코드는 KONAMI가 JSON을 제공하는지에 따라 구현 방식이 달라지는가?
- 기존 playdata를 28버전 `VERSION_BEST` row로도 복제할 것인가, MVP에서는 `ALL_TIME_BEST`만 보존할 것인가?
- 기존 비밀번호 저장값을 어떤 방식으로 검증하고 신규 hash로 전환할 것인가?
- 곡 라이브서치의 MVP 검색 엔진은 Redis read model, local memory index, MySQL 중 무엇으로 할 것인가?

## 코드 수정 시 주의

- 기존 멀티모듈 경계를 유지합니다.
- HTTP DTO와 도메인 모델을 직접 섞지 않습니다.
- HTTP DTO와 application command/query/result도 분리합니다.
- 변경 API는 Command, 조회 API는 Query를 use case 입력으로 사용합니다.
- UseCase interface와 application service 구현체를 분리합니다.
- outbound 의존성은 application port로 정의하고 infra adapter에서 구현합니다.
- rank, medal, difficulty는 정수 코드와 표시 label을 분리합니다.
- rank는 score에서 계산하지 말고 갱신 원천 데이터에서 받은 값을 저장합니다.
- playdata 저장 시 `best_type`, `target_version`, `score_version`을 누락하지 않습니다.
- 현재 버전 크롤링 점수는 현재 버전 `VERSION_BEST`에 upsert하고, 역대 최고를 넘는 경우 `ALL_TIME_BEST`도 갱신합니다.
- `display_popclass`는 현재 버전 `VERSION_BEST`, `potential_popclass`는 `ALL_TIME_BEST`, `legacy_popclass`는 28버전 이전 기존 값을 기준으로 관리합니다.
- 마이그레이션 시 `potential_popclass`를 반드시 한 번 계산해 채웁니다.
- 갱신 데이터로 `ALL_TIME_BEST`가 변경되면 `potential_popclass`를 반드시 재계산합니다.
- 현재 버전 `VERSION_BEST` 갱신 후 서버가 `charts.chart_version` 기준으로 이번 버전 채보 20개, 구버전 채보 40개를 선정해 `playdata.is_display_popclass_target`, `popclass_bucket`, `popclass_bucket_rank`를 마킹합니다.
- 크롤러/API 입력은 `popclass_bucket`을 보내지 않습니다. bucket은 서버 계산값입니다.
- 비밀번호 복구 token 원문은 DB에 저장하지 않고 hash만 `password_reset_tokens`에 저장합니다.
- password, reset token 원문, JWT secret, 외부 민감 header는 로그와 DB에 저장하지 않습니다.
- request thread에서 대량 갱신, 대량 집계, S3/외부 HTTP 작업을 길게 수행하지 않습니다.
- 긴 갱신은 job 상태를 남기고 chunk 단위 transaction으로 처리합니다.
- 운영에 적용된 Flyway `V*.sql`은 수정하지 말고 새 파일을 추가합니다.
- 이번 리팩토링 마이그레이션은 작은 테이블 단위보다 큰 세션 단위로 문서화하고 검증합니다.
- Docker image는 배포마다 immutable tag를 사용합니다.
- High☆Cheers 전환처럼 버전별 정책이 바뀔 수 있는 값은 하드코딩보다 정책 객체 또는 상수 테이블을 우선 검토합니다.
- FK 제거 결정이 확정되면 JPA 연관관계도 엔티티 id 기반 참조로 바꿀지 검토해야 합니다.
- 마이그레이션 문서와 실제 스키마 변경을 함께 업데이트합니다.
