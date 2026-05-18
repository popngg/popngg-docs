# 운영과 배포

## 현재 개발 실행

```bash
./gradlew :popngg-api:bootRun --args='--spring.profiles.active=local'
```

Swagger:

- `http://localhost:8080/swagger-ui.html`
- `http://localhost:8080/v3/api-docs`

## 배포 기준

배포는 Jenkins가 오케스트레이션하고, 실행 산출물은 Docker image로 배포합니다. DB schema migration은 Flyway와 별도 migration 단계로 관리합니다.

이번 프로젝트의 운영 기준은 다음입니다.

- 레거시 운영 절차를 그대로 복사하지 않습니다.
- 배포와 마이그레이션은 분리해서 실패 지점을 명확히 봅니다.
- 운영에서 확인해야 하는 것은 “돌아가느냐”가 아니라 “새 기준대로 배포되고 검증되었느냐”입니다.

권장 흐름:

```text
Git push
→ Jenkins pipeline
→ test
→ bootJar
→ Docker image build
→ Docker image push
→ migration precheck
→ Flyway migration
→ deploy
→ health check
→ smoke test
```

## Jenkins

Jenkins job은 같은 환경에 대한 동시 배포를 막아야 합니다.

권장 stage:

| Stage | 내용 |
| --- | --- |
| Checkout | Git checkout |
| Test | `./gradlew test` |
| Build | `./gradlew :popngg-api:bootJar` |
| Docker Build | backend image build |
| Docker Push | registry push |
| DB Backup | 운영 DB 백업 |
| Migration Precheck | schema baseline / dry-run 확인 |
| Migrate | Flyway migration |
| Deploy | Docker container 교체 |
| Health Check | `/actuator/health` 또는 health endpoint 확인 |
| Smoke Test | 주요 API 최소 검증 |

스키마 변경은 기본적으로 애플리케이션 배포 전에 적용할 수 있게 backward-compatible하게 작성합니다. 컬럼 삭제, 의미 변경, 대량 데이터 보정처럼 위험한 변경은 `expand -> deploy -> contract` 단계로 나누고, contract 단계는 별도 승인 후 실행합니다.

## Docker

이미지는 commit SHA 또는 release tag로 고정합니다.

예:

```text
popngg-backend:2026.05.09-921c928
popngg-backend:sha-921c928
```

운영 배포에는 `latest`만 의존하지 않고 immutable tag 또는 digest를 사용합니다. `latest`는 로컬 확인이나 비운영 환경에서만 보조 태그로 사용할 수 있습니다.

컨테이너 환경변수 후보:

```text
SPRING_PROFILES_ACTIVE=prod
SPRING_DATASOURCE_URL=...
SPRING_DATASOURCE_USERNAME=...
SPRING_DATASOURCE_PASSWORD=...
JWT_SECRET=...
MAIL_HOST=...
MAIL_USERNAME=...
MAIL_PASSWORD=...
```

민감값은 Jenkins credential 또는 배포 환경의 secret 관리 기능으로 주입합니다. Git에 커밋하지 않습니다.

## 애플리케이션 자원 격리

과거처럼 스레드풀 하나에 모든 작업을 몰아넣지 않습니다.

레거시 문제에서 출발한 전체 대응 기준은 [레거시 문제 대응 전략](legacy-risk-response.md)을 우선 참고합니다.

- 요청 처리, 갱신 작업, 배치성 작업, 외부 API 호출은 각각 다른 실행 경계를 가집니다.
- 모든 executor는 bounded queue와 명시적 rejection policy를 가집니다.
- 무제한 큐, 무제한 스레드 생성, fire-and-forget 작업은 피합니다.
- 오래 걸리거나 블로킹 가능한 작업은 request thread에서 분리합니다.
- 외부 호출과 DB 작업에는 timeout을 반드시 둡니다.
- 작업이 밀리면 시스템이 조용히 죽지 않도록 backpressure 또는 caller-side 제한을 둡니다.
- 대용량 갱신은 웹 요청과 분리된 별도 worker나 job으로 처리합니다.

권장 관찰 지표:

- JVM thread count
- executor queue depth
- CPU 사용률
- heap 사용량
- GC pause
- request timeout rate
- task rejection rate

## Executor 분리안

현재 프로젝트에서는 작업 성격별로 executor를 분리합니다.

| 이름 | 용도 | 큐/정책 |
| --- | --- | --- |
| `backgroundTaskExecutor` | 짧은 비동기 후처리, 캐시 갱신, 가벼운 이벤트 처리 | bounded queue, `CallerRunsPolicy` 또는 명시적 reject |
| `playdataRefreshExecutor` | 플레이데이터 갱신, rank/popclass 재계산처럼 비교적 무거운 작업 | 더 작은 bounded queue, `AbortPolicy` 우선 |
| `externalCallExecutor` | 외부 HTTP 호출, 크롤링, 파일 fetch | 낮은 동시성, 짧은 timeout, bounded queue |
| `schedulerExecutor` | 주기적 점검, 만료 토큰 정리, 스테일 데이터 정리 | `TaskScheduler` 별도 분리 |

운영 원칙:

- 요청-응답 경로에서 끝나야 하는 작업은 `@Async`로 넘기지 않습니다.
- 유저가 기다리는 API는 가능하면 동기 처리하고, 길어지면 별도 job으로 분리합니다.
- playdata 갱신처럼 느려질 수 있는 작업은 웹 요청에서 직접 돌리지 않고 job 단위로 처리합니다.
- executor별로 메트릭을 따로 봅니다.
- 큐가 가득 차면 무조건 처리하지 않고, 실패를 드러내거나 재시도 가능한 경로로 넘깁니다.

권장 스레드 수는 인프라 크기에 따라 조정하되 시작점은 보수적으로 둡니다.

- `backgroundTaskExecutor`: core 2, max 4, queue 100
- `playdataRefreshExecutor`: core 2, max 4, queue 20
- `externalCallExecutor`: core 2, max 4, queue 20

이 값들은 시작점일 뿐이며, 실제 운영에서는 CPU/메모리/응답시간을 보고 줄이거나 늘립니다.

## Spring Boot 설정 초안

```java
@Configuration
@EnableAsync
@EnableScheduling
public class AsyncConfig implements AsyncConfigurer {

    @Bean(name = "backgroundTaskExecutor")
    public ThreadPoolTaskExecutor backgroundTaskExecutor() {
        return buildExecutor(
                "background-",
                2,
                4,
                100,
                new ThreadPoolExecutor.CallerRunsPolicy()
        );
    }

    @Bean(name = "playdataRefreshExecutor")
    public ThreadPoolTaskExecutor playdataRefreshExecutor() {
        return buildExecutor(
                "playdata-",
                2,
                4,
                20,
                new ThreadPoolExecutor.AbortPolicy()
        );
    }

    @Bean(name = "externalCallExecutor")
    public ThreadPoolTaskExecutor externalCallExecutor() {
        return buildExecutor(
                "external-",
                2,
                4,
                20,
                new ThreadPoolExecutor.AbortPolicy()
        );
    }

    @Bean(name = "schedulerExecutor")
    public ThreadPoolTaskScheduler schedulerExecutor() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setThreadNamePrefix("scheduler-");
        scheduler.setPoolSize(2);
        scheduler.setErrorHandler(Throwable::printStackTrace);
        return scheduler;
    }

    @Override
    public Executor getAsyncExecutor() {
        return backgroundTaskExecutor();
    }

    private ThreadPoolTaskExecutor buildExecutor(
            String prefix,
            int corePoolSize,
            int maxPoolSize,
            int queueCapacity,
            RejectedExecutionHandler handler
    ) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix(prefix);
        executor.setCorePoolSize(corePoolSize);
        executor.setMaxPoolSize(maxPoolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setKeepAliveSeconds(60);
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.setRejectedExecutionHandler(handler);
        executor.initialize();
        return executor;
    }
}
```

사용 규칙:

- 가벼운 비동기 처리에는 `@Async("backgroundTaskExecutor")`를 사용합니다.
- 무거운 갱신 처리에는 `@Async("playdataRefreshExecutor")`처럼 명시적으로 분리합니다.
- 외부 API 호출은 `externalCallExecutor`와 timeout을 함께 사용합니다.
- 스케줄 작업은 `@Scheduled` 또는 `schedulerExecutor`를 사용합니다.
- 로그 추적이 필요하면 `TaskDecorator`로 MDC를 전파합니다.

예시:

```java
@Async("playdataRefreshExecutor")
public void refreshPlaydata(...) {
    // 갱신 로직
}
```

주의:

- `@Async`를 붙였다고 해서 안전해지는 것은 아닙니다.
- 내부에서 다시 blocking call을 연쇄적으로 호출하면 thread starvation이 생길 수 있습니다.
- DB 트랜잭션이 오래 유지되는 작업은 executor보다 job 분리 여부를 먼저 검토합니다.

## Flyway

Flyway SQL 위치:

```text
db/migration/
```

이 경로는 애플리케이션 실행 classpath 기준입니다. 실제 파일 위치는 Flyway 의존성과 datasource 설정을 어느 모듈이 소유하는지에 맞춰 정합니다. 멀티모듈에서는 `popngg-infra/src/main/resources/db/migration/`, 실행 모듈의 `src/main/resources/db/migration/`, 또는 별도 migration 모듈을 후보로 검토합니다.

규칙:

- 한 번 운영에 적용된 `V*.sql`은 수정하지 않습니다.
- 새 변경은 새 버전 파일로 추가합니다.
- 스키마 변경과 대량 데이터 이전은 분리합니다.
- 이번 리팩토링처럼 DB 구조가 크게 바뀌는 경우 Flyway 파일은 작은 테이블 단위보다 큰 baseline 세션 단위로 묶습니다.
- `flyway_schema_history`를 운영 DB에서 확인할 수 있어야 합니다.
- migration 실패 시 자동 재시도보다 원인 확인 후 수동 조치를 우선합니다.

이번 프로젝트에서는 Spring Boot 시작 시 자동 실행보다 Jenkins의 명시 migration 단계 또는 migration container를 우선합니다. 애플리케이션 시작과 schema baseline 적용이 섞이면 실패 분석이 어려워집니다.

로컬 개발에서는 Spring Boot 자동 Flyway 실행을 허용할 수 있지만, staging/production에서는 Jenkins 단계에서 migration 결과를 먼저 확인합니다.

## 로깅과 모니터링

초기 운영 스택은 `Prometheus + Grafana + Loki + Grafana Alloy`로 확정합니다.

2대 서버 구성:

| 서버 | 역할 | 구성 |
| --- | --- | --- |
| 서버 1 | CI/CD와 관측 | Jenkins, Prometheus, Grafana, Loki, Alertmanager, Grafana Alloy |
| 서버 2 | 서비스 실행 | Spring Boot 애플리케이션, MySQL, Redis, Grafana Alloy, node exporter |

기본 흐름:

```text
Spring Boot /actuator/prometheus
-> Prometheus scrape
-> Grafana dashboard

Docker stdout JSON log
-> Grafana Alloy
-> Loki
-> Grafana log query
```

알람은 Prometheus alert rule과 Alertmanager를 사용합니다. 알람 수신 채널은 운영 방식이 정해진 뒤 Slack, Discord, email 중에서 선택합니다.

필수 메트릭:

- API latency, throughput, 4xx/5xx rate
- JVM heap, non-heap, GC pause, live thread count
- Tomcat busy thread count
- executor active count, queue depth, rejected count
- HikariCP active, idle, pending connection count
- MySQL connection, slow query, disk usage
- Redis memory usage, connected clients, evicted keys
- Docker container restart count, OOMKilled 여부
- 서버 CPU, memory, disk, load average
- Flyway migration 성공/실패
- Jenkins 배포 단계별 성공/실패
- playdata import job 성공/실패, 처리 row 수, 실패 row 수

필수 로그:

- 애플리케이션 JSON structured log
- Spring Boot access log 또는 HTTP request summary log
- Jenkins build/deploy log
- Flyway migration log
- playdata import/renew log
- login failure log

로그 정책:

- 애플리케이션 로그는 Docker stdout으로 출력하고, Alloy가 수집해 Loki로 전송합니다.
- 로그는 한 줄 JSON 형식을 우선합니다.
- 공통 필드는 `timestamp`, `level`, `service`, `env`, `requestId`, `traceId`, `poptomoId`, `songId`, `chartId` 후보를 사용합니다.
- password, reset token 원문, JWT secret, 인증 header, 외부 민감 header는 로그에 남기지 않습니다.
- stacktrace는 multiline이 깨지지 않도록 JSON 필드 또는 Loki multiline 처리 기준을 정합니다.
- Loki label은 `service`, `env`, `level`, `container`처럼 cardinality가 낮은 값만 사용합니다. `poptomoId`, `songId`, `chartId`, `requestId`는 label이 아니라 log field로 둡니다.

서버 2의 앱/DB 동시 배치 보호:

- 애플리케이션과 DB 컨테이너에 memory/cpu limit을 설정합니다.
- MySQL `max_connections`와 HikariCP `maximumPoolSize`를 함께 제한합니다.
- executor는 bounded queue와 rejection policy를 명시합니다.
- DB volume과 애플리케이션 로그/임시 파일 영역을 분리합니다.
- disk usage 80% 이상, DB connection pending, executor rejected task, container restart/OOM은 알람 대상입니다.

## 로그

- 인증 실패는 민감정보 없이 남깁니다.
- 비밀번호, reset token 원문, JWT secret은 절대 로그에 남기지 않습니다.
- 갱신 코드는 외부 응답 원문 저장 여부를 별도 정책으로 정합니다.
- 데이터 마이그레이션은 row count, 실패 row, old/new id 매핑을 파일 또는 테이블로 남깁니다.
- Jenkins 배포 로그에는 secret이 출력되지 않게 masking을 확인합니다.

## 전환 당일 체크리스트

- [ ] Docker image build 완료
- [ ] Docker image registry push 완료
- [ ] 신규 스키마 Flyway migration 리허설 완료
- [ ] 데이터 싱크 리허설 완료
- [ ] 운영 DB 백업 완료
- [ ] migration precheck 통과
- [ ] 검증 SQL 통과
- [ ] 신규 API smoke test 준비
- [ ] 롤백 image tag 확인
- [ ] Jenkins 동시 배포 lock 확인
- [ ] 서버 중단 공지
- [ ] 최종 싱크
- [ ] 서버 재오픈
- [ ] health check 통과
- [ ] 주요 화면 확인
