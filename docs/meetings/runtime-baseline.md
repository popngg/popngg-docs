# Runtime Baseline

## 결정 방향

신규 프로젝트는 `JDK 25 + Spring Boot 4.x / Spring Framework 7.x` 조합을 우선 검증합니다.

호환성 문제가 확인되면 `JDK 21`로 fallback합니다.

```text
1순위: JDK 25 + Spring Boot 4.x + Spring Framework 7.x
Fallback: JDK 21 + Spring Boot 4.x + Spring Framework 7.x
```

현재 코드 baseline은 `Java 17 + Spring Boot 3.2.4`입니다. 이 값은 현재 구현 상태를 설명하는 기준이고, 신규 목표 baseline은 위 검증 결과에 따라 갱신합니다.

## 왜 지금 검증하는가

프로젝트가 아직 초반이고 코드를 새로 작성하는 단계이므로 런타임과 Spring 세대 전환 비용이 가장 낮습니다.

나중에 JPA, Querydsl, Jackson, Security, 테스트 코드, Docker/Jenkins 설정이 쌓인 뒤 전환하면 영향 범위가 더 커집니다.

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
- Docker base image와 Jenkins agent JDK 버전을 맞춰야 합니다.
- JDK 25는 JDK 21보다 운영 사례와 문제 해결 자료가 적을 수 있습니다.

## 검증 조건

아래 항목이 통과하면 JDK 25 baseline을 유지합니다.

- `./gradlew clean test`
- Querydsl Q class 생성
- Spring Boot application boot
- Swagger UI 또는 OpenAPI 문서 기동
- JPA repository smoke test
- Spring Security filter chain smoke test
- Docker image build
- Jenkins build
- `/actuator/health` 확인
- `/actuator/prometheus` 확인

## 실패 시 fallback 기준

다음 문제가 발생하고 단기간에 해결하기 어렵다면 JDK 21로 fallback합니다.

- annotation processor가 JDK 25에서 안정적으로 동작하지 않음
- Querydsl Q class 생성이 불안정함
- Docker/Jenkins 환경에서 JDK 25 이미지 또는 toolchain 관리가 과도하게 복잡함
- 핵심 라이브러리 호환성 문제가 반복됨

JDK 21 fallback은 Spring Boot 4.x / Spring Framework 7.x 검증을 포기한다는 뜻이 아닙니다. 런타임만 JDK 21로 낮추고 Spring 세대 전환은 유지하는 방향을 우선합니다.
