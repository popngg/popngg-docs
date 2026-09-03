# 운영과 배포

이 문서는 로컬 실행 방법보다 운영 기준을 먼저 설명합니다. 현재 Docker, Flyway, Prometheus/Grafana가 구현되어 있으며 Loki/Alloy/Alertmanager는 다음 단계의 운영 설계입니다.

<div class="doc-summary">
  <div class="doc-summary__item">
    <strong>서버 구성</strong>
    <p>서버 1은 관측 스택, 서버 2는 애플리케이션과 MySQL/Redis를 둡니다.</p>
  </div>
  <div class="doc-summary__item">
    <strong>배포 기준</strong>
    <p>test, build, image, migration, deploy, health check, smoke test를 pipeline stage로 분리합니다.</p>
  </div>
  <div class="doc-summary__item">
    <strong>운영 리스크</strong>
    <p>request thread와 긴 작업 executor를 분리하고, queue depth와 rejected count를 모니터링합니다.</p>
  </div>
</div>

## 현재 개발 실행

```bash
./gradlew :popngg-api:bootRun --args='--spring.profiles.active=local'
```

로컬 Swagger:

- `http://localhost:8080/swagger-ui/index.html`
- `http://localhost:8080/v3/api-docs`

현재 OCI dev 환경:

| 항목 | 값 |
| --- | --- |
| API | `http://161.33.165.110` |
| Swagger UI | `http://161.33.165.110/swagger-ui/index.html` |
| OpenAPI JSON | `http://161.33.165.110/v3/api-docs` |
| 공개 health check | `GET http://161.33.165.110/health` |

위 주소는 **dev 환경 전용**이며 운영 주소가 아닙니다. 현재 백엔드는 Spring Boot `3.5.16`과 호환되는 `springdoc-openapi 2.8.x`(`2.8.17`)를 사용합니다. 운영에서는 Swagger 공개 범위를 제한하거나 비활성화하고, Actuator 공개 범위도 다시 검토합니다.

dev 네트워크 구성:

```text
Internet → OCI Compute Instance:80 → Nginx → 127.0.0.1:8080 Spring API
                                             └→ Docker 내부 MySQL:3306
```

- Nginx만 80번 포트에서 요청을 받고 Spring API로 reverse proxy합니다.
- Spring API는 호스트의 `127.0.0.1:8080`에만 바인딩합니다.
- MySQL 3306, Spring 8080, Adminer는 외부에 공개하지 않습니다.
- OCI 인바운드는 SSH 22, HTTP 80, 향후 HTTPS 443만 허용합니다.

## 배포 기준

배포는 파이프라인으로 오케스트레이션하고, 실행 산출물은 Docker image로 배포합니다. DB schema migration은 Flyway와 별도 migration 단계로 관리합니다.

이번 프로젝트의 운영 기준은 다음입니다.

- 레거시 운영 절차를 그대로 복사하지 않습니다.
- 배포와 마이그레이션은 분리해서 실패 지점을 명확히 봅니다.
- 운영에서 확인해야 하는 것은 “돌아가느냐”가 아니라 “새 기준대로 배포되고 검증되었느냐”입니다.

권장 흐름:

```text
Git push
→ deployment pipeline
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

## 배포 파이프라인

배포 job은 같은 환경에 대한 동시 배포를 막아야 합니다.

현재 dev 자동 배포는 `main` 브랜치 push(머지 포함)의 CI 성공 후 다음 순서로 실행됩니다.

1. Java 21로 빌드합니다.
2. 전체 테스트를 실행합니다.
3. JaCoCo 리포트를 생성합니다.
4. CI 성공 여부를 확인합니다.
5. GitHub Actions 전용 SSH 키로 OCI dev 서버에 접속합니다.
6. 서버 저장소의 `main` 브랜치를 fast-forward로 갱신합니다.
7. 테스트된 커밋 SHA와 서버 `HEAD`가 같은지 검사합니다.
8. 해당 SHA를 태그로 Docker 이미지를 빌드합니다.
9. Flyway migration 컨테이너를 실행합니다.
10. API 컨테이너를 교체합니다.
11. `/health`와 songs/rankings smoke test를 실행합니다.

배포 성공 여부는 GitHub 저장소의 **Repository → Actions → Deploy dev**에서 확인합니다. `deployment image=<repository>:<SHA> status=healthy` 로그까지 출력되어야 완료입니다.

자동 배포 안전장치:

- CI가 실패하면 `Deploy dev` job을 실행하지 않습니다.
- `deploy-dev` concurrency group과 서버의 deployment lock으로 한 번에 하나만 배포합니다.
- `latest` 태그를 거부하고 테스트된 커밋 SHA를 이미지 태그로 사용합니다.
- 서버 저장소 갱신에는 읽기 전용 GitHub Deploy Key를 사용합니다.
- GitHub Actions의 서버 접속 키는 사용자 개인 SSH 키와 분리합니다.
- `.env`, 비밀번호, JWT secret, SSH private key를 Git에 커밋하지 않습니다.
- 기존 SQL dump 데이터 이전은 일반 배포에서 자동 재실행하지 않습니다.
- 일반 배포에서는 Flyway 스키마 migration만 실행합니다.

현재 JDK/Spring baseline:

- 빌드와 Docker image는 Java 21을 사용합니다.
- 애플리케이션은 Spring Boot 3.5.x를 사용합니다.
- OpenAPI UI는 Spring Boot 3.5와 호환되는 springdoc-openapi 2.8.x를 사용합니다.
- 빌드 환경과 Docker base image는 같은 JDK major version을 사용합니다.
- JDK 25 검증이 끝나기 전에는 운영 배포 기준을 확정하지 않고, spike branch에서 `./gradlew clean test`, bootJar, image build, app boot smoke test를 먼저 통과시킵니다.

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
| Health Check | 공개 `/health`, 내부 관리 포트의 Actuator health 확인 |
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
SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/popngg
SPRING_DATASOURCE_USERNAME=popngg
SPRING_DATASOURCE_PASSWORD=<DB_PASSWORD>
DB_PASSWORD=<DB_PASSWORD>
DB_ROOT_PASSWORD=<DB_ROOT_PASSWORD>
JWT_SECRET_KEY=<64자 이상의 무작위 비밀 값>
AUTH_COOKIE_SECURE=true
```

민감값은 배포 환경의 secret 관리 기능으로 주입합니다. Git에 커밋하지 않습니다.

`AUTH_COOKIE_SECURE` 기준:

| 환경 | 값 | 설명 |
| --- | --- | --- |
| 현재 IP 기반 HTTP dev | `false` | 임시 HTTP 환경에서만 사용 |
| HTTPS dev/staging | `true` | HTTPS 전환 즉시 적용 |
| 운영 | `true` | 반드시 `true` |

## 보안 주의사항

- MySQL 3306, Spring 8080, Adminer를 외부에 공개하지 않습니다.
- 실제 비밀번호, JWT secret, SSH private key를 문서나 Git commit에 넣지 않습니다.
- 도메인 연결 후 HTTPS를 적용하고 `AUTH_COOKIE_SECURE=true`로 전환합니다.
- 운영 전 Swagger와 Actuator의 공개 범위를 재검토합니다.

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

이번 프로젝트에서는 Spring Boot 시작 시 자동 실행보다 배포 파이프라인의 명시 migration 단계 또는 migration container를 우선합니다. 애플리케이션 시작과 schema baseline 적용이 섞이면 실패 분석이 어려워집니다.

로컬 개발에서는 Spring Boot 자동 Flyway 실행을 허용할 수 있지만, staging/production에서는 배포 단계에서 migration 결과를 먼저 확인합니다.

## 로깅과 모니터링

### 현재 구현

Prometheus와 Grafana는 `deploy/compose.monitoring.yml`의 선택 서비스입니다. 모니터링 컨테이너 실패는 정상 API 배포를 rollback하지 않습니다.

```text
Spring Boot API :9091/actuator/prometheus (Compose network only)
  -> Prometheus :9090 (127.0.0.1 bind)
  -> Grafana :3000 (127.0.0.1 bind)
  -> Nginx HTTPS -> grafana.popn.gg
```

- 공개 health endpoint는 `/health`입니다.
- 전체 Actuator surface와 Prometheus endpoint는 내부 관리 포트 `9091`에만 둡니다.
- Prometheus는 인증 기능이 없으므로 외부에 공개하지 않고 필요할 때 SSH tunnel을 사용합니다.
- Grafana는 anonymous access와 signup을 끄고 HTTPS/SameSite Strict cookie를 사용합니다.
- 기본 dashboard는 request rate/latency/status, JVM, HikariCP 지표를 제공합니다.
- Prometheus retention은 7일, block 목표 크기는 1GB입니다.
- metric label에는 사용자·곡·채보·poptomo·trace 식별자를 넣지 않습니다.

### 다음 단계 설계

전체 목표 스택은 `Prometheus + Grafana + Loki + Grafana Alloy + Alertmanager`입니다.

2대 서버 구성:

| 서버 | 역할 | 구성 |
| --- | --- | --- |
| 서버 1 | 관측 | Prometheus, Grafana, Loki, Alertmanager, Grafana Alloy |
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
- 배포 단계별 성공/실패
- playdata import job 성공/실패, 처리 row 수, 실패 row 수

필수 로그:

- 애플리케이션 JSON structured log
- Spring Boot access log 또는 HTTP request summary log
- build/deploy log
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
- 배포 로그에는 secret이 출력되지 않게 masking을 확인합니다.

## 전환 당일 체크리스트

실제 전환은 [MVP 전환 당일 체크리스트](cutover-checklist.md)를 위에서 아래로
실행합니다. 이 runbook에는 DB backup과 restore 확인, migration precheck, Flyway,
final data sync, verification SQL, Docker deploy, health, smoke test, rollback 판정과
결과 기록 위치가 포함됩니다.
