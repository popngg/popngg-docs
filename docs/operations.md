# 운영과 배포

## 현재 개발 실행

```bash
./gradlew :popngg-api:bootRun --args='--spring.profiles.active=local'
```

Swagger:

- `http://localhost:8080/swagger-ui.html`
- `http://localhost:8080/v3/api-docs`

## 배포 기준

배포는 Jenkins와 Docker를 사용합니다. DB schema migration은 Flyway로 관리합니다.

권장 흐름:

```text
Git push
→ Jenkins pipeline
→ test
→ bootJar
→ Docker image build
→ Docker image push
→ deploy
→ Flyway migration
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
| Deploy | Docker container 교체 |
| Migrate | Flyway migration |
| Health Check | `/actuator/health` 또는 health endpoint 확인 |
| Smoke Test | 주요 API 최소 검증 |

## Docker

이미지는 commit SHA 또는 release tag로 고정합니다.

예:

```text
popngg-backend:2026.05.09-921c928
popngg-backend:latest
```

운영 배포에는 `latest`만 의존하지 않고 immutable tag를 사용합니다.

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

## Flyway

Flyway SQL 위치:

```text
src/main/resources/db/migration/
```

규칙:

- 한 번 운영에 적용된 `V*.sql`은 수정하지 않습니다.
- 새 변경은 새 버전 파일로 추가합니다.
- 스키마 변경과 대량 데이터 이전은 분리합니다.
- 이번 리팩토링처럼 DB 구조가 크게 바뀌는 경우 Flyway 파일은 작은 테이블 단위보다 큰 baseline 세션 단위로 묶습니다.
- `flyway_schema_history`를 운영 DB에서 확인할 수 있어야 합니다.
- migration 실패 시 자동 재시도보다 원인 확인 후 수동 조치를 우선합니다.

MVP에서는 Spring Boot 시작 시 Flyway 자동 실행을 허용할 수 있습니다. 다만 이번처럼 구조 변화가 큰 전환이나 운영 데이터가 큰 경우에는 Jenkins에서 migration container를 별도 실행하는 방식으로 분리합니다.

## 모니터링

초기 필수 지표:

- API latency
- 4xx/5xx rate
- 로그인 실패율
- 갱신 작업 성공/실패
- DB connection pool
- Flyway migration 성공/실패
- Docker container restart count
- 마이그레이션 이후 정합성 점검 결과

CloudWatch 등 구체 도구는 운영 인프라에 맞춰 후속 결정합니다.

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
- [ ] 검증 SQL 통과
- [ ] 신규 API smoke test 준비
- [ ] 롤백 image tag 확인
- [ ] Jenkins 동시 배포 lock 확인
- [ ] 서버 중단 공지
- [ ] 최종 싱크
- [ ] 서버 재오픈
- [ ] health check 통과
- [ ] 주요 화면 확인
