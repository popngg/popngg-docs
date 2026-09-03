# 구현 현황

이 페이지는 설계 초안과 실제 백엔드 구현을 구분하기 위한 스냅샷입니다.

!!! info "확인 기준"
    [`popngg/popngg`](https://github.com/popngg/popngg) 저장소의 안정 버전 `14f1158`과 동일한 소스 트리(2026-09-04)를 기준으로 확인했습니다. 세부 계약은 항상 현재 코드와 Swagger UI를 우선합니다.

## 런타임과 모듈

| 항목 | 현재 구현 |
| --- | --- |
| Java | 21 |
| Spring Boot | 3.5 |
| Gradle wrapper | 8.13 |
| 데이터베이스 | MySQL 8, 로컬 테스트 일부는 H2/Testcontainers |
| 스키마 관리 | Flyway `V1`~`V21` |
| 모듈 | `popngg-api`, `popngg-application`, `popngg-domain`, `popngg-infra` |
| 배포 | Docker image + production Compose |

JDK 25와 Spring Boot 4는 더 이상 현재 baseline이 아닙니다. 현재 빌드와 운영 기준은 Java 21과 Spring Boot 3.5입니다.

## 구현된 주요 기능

- 로그인, 가입 확인, 가입, 세션 확인, 로그아웃, 비밀번호 재설정
- 곡 목록/상세/등록과 채보 목록/상세 조회
- 사용자 목록/프로필 수정/랭킹 조회
- 플레이데이터 조회, 기록·진행도·레벨 통계, 채보별 랭킹
- 플레이데이터 import와 popclass 재계산
- High☆Cheers collector용 데이터 갱신 API
- 버전 점수와 역대 점수 분리, 게임 버전 전환 정책 적용
- 계정 설정 조회, 프로필/아바타 수정, 비밀번호 변경
- S3/CloudFront 기반 아바타와 곡 자켓 저장
- Discord 곡 추가·수정·조회와 미등록 곡 처리
- Discord 운영/오류 알림과 미확인 채보 수집
- Prometheus/Grafana 운영 모니터링과 production dashboard
- Loki/Alloy 기반 구조화 로그 수집과 7일 보존
- 사용자 목록 클리어 레벨 사전 집계와 선택적 Redis 캐시
- `develop` 후보 배포, 실패 시 `main` 복구, 성공 시 릴리스 PR 생성
- 배포 이미지의 날짜·커밋 기반 버전과 Discord `/배포버전` 조회

## 실제 HTTP 경로

현재 Controller에서 확인되는 주요 경로입니다.

| 영역 | 경로 |
| --- | --- |
| 인증 | `/api/v1/auth/*` |
| 계정 설정 | `/api/v1/account/settings`, `/api/v1/account/profile`, `/api/v1/account/password` |
| 사용자 | `/api/v1/users`, `/api/v1/users/{poptomoId}`, `/api/v1/users/rankings` |
| 곡/채보 | `/api/v1/songs`, `/api/v1/charts`, `/api/v1/chart-details/{chartId}` |
| 플레이데이터 | `/api/v1/users/{poptomoId}/playdata`, `/records`, `/progress`, `/level-stats` |
| 갱신 | `/api/v1/renewals` |
| import/recalculation | `/api/v1/playdata/imports`, `/api/v1/playdata/popclass/recalculate` |
| 호환 차트 API | `/api/v2/chart/*` |
| Discord | `/api/v1/discord/interactions` |

!!! warning "OpenAPI 초안과 구현의 차이"
    이 사이트의 OpenAPI Reference에는 아직 구현되지 않았거나 실제 경로가 달라진 초안이 포함될 수 있습니다. 예를 들어 구현은 `/api/v1` prefix를 사용하고, 갱신은 `/api/v1/renewals`로 제공됩니다. 개발 중 호출 계약은 실행 중인 서버의 `/swagger-ui.html`을 우선 확인합니다.

## DB migration 상태

| 버전 | 목적 |
| --- | --- |
| V1 | 계정과 보안 baseline |
| V2 | 곡/채보 catalog baseline |
| V3 | playdata와 history baseline |
| V4 | 로그와 게임 버전 전환 baseline |
| V5 | `song_hash` 길이 확장 |
| V6 | pop'n 29 버전 전환 승인 |
| V7 | High☆Cheers 메달 코드 정렬 |
| V8 | 버전 최고점 제공 여부 추적 |
| V9 | 갱신 중 매칭되지 않은 곡/채보 리포트 추적 |
| V10 | 불확실한 난이도/UPPER 값을 nullable로 전환하고 곡 단위로 병합 |
| V11~V12 | 팝클래스 역산 및 레거시 플레이데이터의 현재 버전 승격 |
| V13~V15 | 사용자 랭킹 조회 최적화와 potential popclass 저장·보정 |
| V16~V17 | 레거시 메달·랭크 코드 보정 |
| V18 | 사용자 활동 시각 복원 |
| V19 | 미등록 곡 리포트 조회 collation 정규화 |
| V20 | 곡 제목 데이터 보정 |
| V21 | 사용자별·게임 버전별 클리어 레벨 사전 집계와 캐시 revision |

운영에 적용된 migration 파일은 수정하지 않고 새 버전을 추가합니다. 레거시 대량 이전은 Flyway와 분리된 `migration/` 스크립트로 실행하고 별도 검증 SQL을 사용합니다.

## 실행과 배포

로컬 실행에는 JDK 21과 Docker Compose가 필요합니다.

```powershell
.\gradlew.bat :popngg-api:bootRun --args="--spring.profiles.active=local"
```

운영 환경은 `.env.example`의 필수 값을 secret으로 주입하고 `deploy/compose.yml`을 사용합니다. API는 `127.0.0.1:${API_PORT}`에 bind하므로 HTTPS reverse proxy 앞에서 노출해야 합니다. 쿠키 인증을 쓰는 프론트 요청은 credentials를 포함해야 합니다.

Prometheus, Grafana, Loki와 Alloy는 `deploy/compose.monitoring.yml`로 실행합니다. 공개 health check는 `/health`이며, 전체 Actuator와 `/actuator/prometheus`는 컨테이너 내부 관리 포트 `9091`에서만 제공합니다. Grafana만 HTTPS reverse proxy를 통해 `grafana.popn.gg`로 공개하고 Prometheus와 Loki는 외부에 직접 공개하지 않습니다.

## 아직 문서 결정이 필요한 영역

- OpenAPI 초안과 현재 Controller 계약의 일괄 동기화
- 레거시 호환 `/api/v2/chart/*`의 유지 기간과 종료 조건
- 이메일 등 초안 API 중 미구현 범위의 MVP 포함 여부
- Alertmanager 도입 시점과 경보 기준
- 게임 버전이 바뀔 때 `RESET`/`CARRY_OVER` 승인 절차
