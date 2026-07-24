# Runtime Baseline

## 확정 baseline

2026-07-24 기준으로 다음 조합을 채택합니다.

```text
JDK: 21 LTS
Spring Boot: 3.5.16
Spring Framework: Spring Boot 3.5.16이 관리하는 6.2.x
Gradle Wrapper: 8.13
```

JDK 25는 우선 후보로 검토했지만 이번 baseline에서는 채택하지 않습니다. 현재 개발
환경에 JDK 25가 없고, Gradle을 JDK 25에서 실행하려면 9.1 이상으로 함께 올려야 하며,
Querydsl annotation processor와 Spring Boot 4/Jackson 3 전환까지 한 번에 검증해야
합니다. 런타임, 빌드 도구, 프레임워크 세대를 동시에 바꾸지 않도록 JDK 21로
fallback합니다.

Spring Boot 3.5.16은 기존 3.2 코드와 Jakarta/Jackson 2 호환성을 유지하면서 보안 및
의존성 baseline을 먼저 올리기 위한 과도기 버전입니다. Spring Boot 4.1 /
Spring Framework 7 전환은 Querydsl, springdoc, Jackson 3 호환성 검증을 별도 작업으로
분리합니다.

## 왜 지금 검증하는가

프로젝트가 아직 초반이고 코드를 새로 작성하는 단계이므로 런타임과 Spring 세대 전환 비용이 가장 낮습니다.

나중에 JPA, Querydsl, Jackson, Security, 테스트 코드, Docker/CI 설정이 쌓인 뒤 전환하면 영향 범위가 더 커집니다.

## 기대 이점

- 최신 LTS를 기준으로 장기 유지보수 기준을 잡을 수 있습니다.
- Spring Framework 7 세대의 Jakarta EE 11, Servlet 6.1, Tomcat 11, JPA 3.2, Hibernate 7 흐름을 초기에 맞출 수 있습니다.
- Boot 3.x에서 Boot 4.x로 넘어가는 큰 전환을 나중으로 미루지 않습니다.
- 새 프로젝트라 호환성 문제를 빠르게 발견하고 설계를 조정할 수 있습니다.
- JDK 25가 어렵더라도 JDK 21 fallback을 두면 운영 안정성을 확보할 수 있습니다.

## 비용과 리스크

- Gradle wrapper를 Spring Boot 4 요구사항에 맞춰 올려야 합니다.
- Querydsl은 Hibernate 7/JPA 3.2 대응 버전을 검토해야 합니다.
- springdoc은 Spring Boot 4 대응 라인을 사용해야 합니다.
- Jackson 3 전환 영향으로 JSON 직렬화/역직렬화 동작을 확인해야 합니다.
- Docker base image와 빌드 환경의 JDK 버전을 맞춰야 합니다.
- JDK 25는 JDK 21보다 운영 사례와 문제 해결 자료가 적을 수 있습니다.

## 검증 명령

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew clean test
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew :popngg-api:bootJar
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew :popngg-api:bootRun \
  --args='--spring.profiles.active=local'
```

CI와 Docker의 build/runtime JDK도 21로 맞춥니다. `bootRun` 검증에는 로컬 DB와
필수 secret이 필요하며, 준비되지 않은 환경에서는 `bootJar`까지를 필수 검증으로
봅니다.

## 다음 baseline 승격 조건

JDK 25와 Spring Boot 4.1로 승격하려면 아래를 모두 별도 브랜치에서 통과해야 합니다.

- Gradle 9.1+ wrapper와 CI/Docker runtime 정렬
- Querydsl Q class 생성 및 JPA repository smoke test
- Jackson 3 직렬화 회귀 테스트
- Spring Security filter chain smoke test
- springdoc/OpenAPI 기동
- `clean test`, `bootJar`, 애플리케이션 boot, Docker image build
