# 코드 컨벤션

## Runtime Baseline

JDK baseline은 `JDK 25`를 우선 검증하고, 호환성 문제가 있으면 `JDK 21`로 fallback합니다.

- 현재 코드 baseline은 Java 17이지만, 신규 구현 기준은 JDK 25 spike 결과를 우선 반영합니다.
- Spring baseline은 `Spring Boot 4.x / Spring Framework 7.x`를 우선 검증합니다.
- 검증 전까지 JDK 25 전용 API를 도메인 핵심 로직에 넓게 퍼뜨리지 않습니다.
- JDK 25 검증 항목은 Gradle build, Spring Boot 기동, Querydsl Q class 생성, JPA repository 테스트, springdoc Swagger UI, Docker image build입니다.

이 문서는 리팩토링 이후에도 같은 스타일로 개발하기 위한 기준입니다. 새 기능을 추가할 때는 새 문서에서 정한 멀티모듈, use case, port/adapter, DTO 분리 방식을 우선 적용하고, 레거시 코드는 참고만 합니다.

## 백엔드 구조

권장 모듈 구조:

```text
api -> application -> domain
infra -> application/domain
```

popn.gg 백엔드는 헥사고널 아키텍처를 기준으로 개발합니다.

| 모듈 | 허용되는 코드 | 금지되는 코드 |
| --- | --- | --- |
| `popngg-api` | Controller, HTTP request/response DTO, API mapper, web config | JPA Entity, Repository 직접 호출, 비즈니스 계산 |
| `popngg-application` | UseCase, service, command/query, port, result/view | Controller DTO, JPA Entity, Spring MVC 타입 |
| `popngg-domain` | 도메인 모델, 값 객체, enum, 도메인 예외 | Spring/JPA/Web 의존성 |
| `popngg-infra` | Entity, Repository, Querydsl, adapter, security/mail/external client | Controller, HTTP response DTO |

## 원칙

- Controller는 HTTP request/response 변환에 집중합니다.
- Application service는 use case와 트랜잭션 경계를 담당합니다.
- Domain은 값 객체와 핵심 규칙을 담당합니다.
- Infra는 DB, security, 외부 연동 adapter를 담당합니다.
- application은 port interface를 호출하고, infra가 adapter로 구현합니다.
- 새 기능은 Controller에서 바로 Repository로 내려가지 않고 반드시 use case를 거칩니다.

## Java 스타일

- Java 17 문법을 기준으로 합니다.
- DTO, Command, Query, Result/View처럼 값 전달이 목적인 객체는 `record`를 우선 검토합니다.
- JPA Entity는 `record`를 사용하지 않습니다.
- mutable 객체는 필요한 곳에서만 사용하고, domain value object는 가능하면 immutable로 둡니다.
- `var`는 사용하지 않습니다. 타입이 읽히는 편이 리뷰와 온보딩에 유리합니다.
- `Optional`은 반환 타입에 사용하고, field나 request/response DTO field에는 사용하지 않습니다.
- collection 반환은 `null` 대신 빈 collection을 사용합니다.
- public method 인자는 `null` 허용 여부를 validation 또는 타입으로 드러냅니다.
- magic number/string은 enum, constant, policy object로 이동합니다.
- `System.out.println`은 사용하지 않고 logger를 사용합니다.

## 이름 규칙

| 대상 | 규칙 | 예시 |
| --- | --- | --- |
| UseCase | 동사 + 대상 + `UseCase` | `RenewPlaydataUseCase` |
| Application service | UseCase 이름과 맞추고 `Service` 접미사 | `RenewPlaydataService` |
| Command | 상태 변경 의도 + `Command` | `ChangePasswordCommand` |
| Query | 조회 의도 + `Query` | `FindSongSearchQuery` |
| Result | 상태 변경 결과 + `Result` | `LoginResult` |
| View | 조회 결과 + `View` | `SongSearchView` |
| Port | 목적 + `Port` | `FindSongSearchPort` |
| Adapter | 기술/대상 + `Adapter` | `RedisSongSearchAdapter` |
| Entity | DB 대상 + `Entity` | `SongEntity` |
| Mapper | 경계 + `Mapper` | `SongApiMapper`, `SongPersistenceMapper` |

금지:

- `Manager`, `Processor`, `Handler`처럼 역할이 넓은 이름은 피합니다.
- `CommonService`, `UtilService`처럼 책임이 모호한 service를 만들지 않습니다.
- Entity 이름을 API response 이름으로 재사용하지 않습니다.

## 패키지 배치 기준

기능 이름을 기준으로 너무 깊게 쪼개기보다, 계층 책임이 드러나게 배치합니다. 실제 패키지명은 백엔드 구현 시 확정하되 다음 형태를 우선합니다.

```text
popngg-api
  auth/
    AuthController
    dto/LoginRequest
    dto/LoginResponse
    mapper/AuthApiMapper
  chart/
    ChartController
    dto/GroupChartResponse

popngg-application
  auth/
    port/LoadUserPort
    usecase/AuthenticateUserUseCase
    service/AuthenticateUserService
    command/LoginCommand
    result/LoginResult
  chart/
    port/FindChartPort
    usecase/FindGroupChartUseCase
    service/FindGroupChartService
    query/FindGroupChartQuery
    view/GroupChartView

popngg-domain
  user/
  chart/
  playdata/
  common/

popngg-infra
  persistence/
    user/
    chart/
    playdata/
  security/
  mail/
  external/
```

## DTO / Command / Query 규칙

DTO는 계층마다 분리합니다. HTTP DTO, application DTO, persistence Entity를 같은 객체로 재사용하지 않습니다.

| 객체 | 위치 | 접미사 | 예시 |
| --- | --- | --- | --- |
| HTTP 요청 | `api` | `Request` | `LoginRequest`, `UpdateUserProfileRequest` |
| HTTP 응답 | `api` | `Response` | `GroupChartResponse`, `UserProfileResponse` |
| 변경 입력 | `application` | `Command` | `RenewPlaydataCommand`, `ChangePasswordCommand` |
| 조회 입력 | `application` | `Query` | `FindGroupChartQuery`, `FindUserRankingQuery` |
| UseCase 출력 | `application` | `Result`, `View` | `LoginResult`, `GroupChartView` |
| DB 매핑 | `infra` | `Entity` | `UserEntity`, `ChartEntity` |

Mapping 흐름은 다음을 지킵니다.

```text
Request -> Command/Query -> UseCase -> Result/View -> Response
Entity <-> Domain/Result/View는 infra adapter 내부에서만 변환
```

세부 규칙:

- Controller는 `Request`를 `Command` 또는 `Query`로 변환한 뒤 use case를 호출합니다.
- `Command`는 상태 변경에만 사용합니다.
- `Query`는 조회에만 사용합니다.
- `Command`/`Query`는 HTTP path/body/query에서 왔다는 사실을 몰라야 합니다.
- `MultipartFile`, `HttpServletRequest`, `HttpSession`, `Pageable` 같은 웹 타입을 application으로 넘기지 않습니다.
- 파일 업로드는 api에서 파일명, content type, size, stream/reference 등 application이 필요한 형태로 변환한 뒤 command에 담습니다.
- `Response`는 프론트 표시 편의를 고려해 code, label, sortOrder, displayName 같은 값을 포함할 수 있습니다.
- `Entity`를 `Response`로 직접 변환하지 않습니다. 반드시 use case 출력 모델을 거칩니다.

DTO 예시:

```java
public record SongSearchResponse(
        List<SongSearchItemResponse> items,
        SearchMetaResponse meta
) {
}
```

Command/Query 예시:

```java
public record SearchSongsQuery(
        String keyword,
        int limit
) {
}
```

## Validation 규칙

- 형식 검증은 API request DTO에서 수행합니다.
- 비즈니스 검증은 application/domain에서 수행합니다.
- 같은 검증을 Controller와 Service에 흩뿌리지 않습니다.
- 외부 id 형식은 값 객체 또는 validator로 모읍니다.
- validation message에는 민감정보를 포함하지 않습니다.

예:

```java
public record SearchSongsRequest(
        @Size(max = 100)
        String q,

        @Min(1)
        @Max(30)
        Integer limit
) {
}
```

## UseCase 작성 규칙

UseCase는 기능 단위 interface로 작성합니다.

```java
public interface FindGroupChartUseCase {
    GroupChartView find(FindGroupChartQuery query);
}
```

구현체는 application service에 둡니다.

```java
@Service
@Transactional(readOnly = true)
public class FindGroupChartService implements FindGroupChartUseCase {
    ...
}
```

규칙:

- 하나의 use case는 하나의 사용자 행동 또는 화면 요구사항을 기준으로 잡습니다.
- 트랜잭션은 application service에 선언합니다.
- 조회 use case는 `readOnly = true`를 우선합니다.
- 외부 adapter 실패는 application에서 의미 있는 예외로 변환합니다.
- Controller에서 여러 use case를 조합해 화면 데이터를 억지로 만들지 않습니다. 화면 단위 aggregation이 필요하면 별도 조회 use case를 만듭니다.
- 오래 걸리는 갱신/집계/외부 I/O는 request use case와 processing use case를 분리하고, 필요하면 job id를 반환합니다.

트랜잭션 기준:

| 작업 | 기준 |
| --- | --- |
| 단순 조회 | `@Transactional(readOnly = true)` |
| 상태 변경 | application service method에 transaction 선언 |
| 긴 갱신 | job/chunk 단위로 transaction을 짧게 유지 |
| 외부 호출 포함 | DB transaction 안에서 오래 잡지 않도록 순서 분리 |
| 이벤트/후처리 | transaction commit 이후 실행 여부 검토 |

긴 작업 예시:

```text
SubmitRenewJobUseCase
  -> job 생성
  -> job id 반환

ProcessRenewJobUseCase
  -> worker가 실행
  -> chunk 단위 저장
```

## Port / Adapter 규칙

Application 계층은 outbound port를 정의합니다.

```text
LoadUserPort
SaveUserPort
FindChartPort
FindPlaydataPort
SavePlaydataPort
PasswordHasherPort
TokenPort
MailPort
```

Infra 계층은 adapter로 구현합니다.

```text
UserPersistenceAdapter implements LoadUserPort, SaveUserPort
ChartQueryAdapter implements FindChartPort
BcryptPasswordHasherAdapter implements PasswordHasherPort
JwtTokenAdapter implements TokenPort
SmtpMailAdapter implements MailPort
```

규칙:

- port 이름은 기술이 아니라 목적을 기준으로 짓습니다.
- adapter 이름은 사용하는 기술이나 저장소 성격을 드러내도 됩니다.
- application service는 `JpaRepository`, `EntityManager`, `JPAQueryFactory`, `JavaMailSender`를 직접 참조하지 않습니다.
- Querydsl 최적화는 infra adapter 내부에 둡니다.

Port 분리 기준:

| 상황 | 기준 |
| --- | --- |
| 읽기와 쓰기 책임이 다름 | `Find...Port`, `Save...Port`로 분리 |
| 외부 시스템이 다름 | 별도 port |
| 테스트 fake가 복잡해짐 | port가 너무 넓은지 점검 |
| 기술 변경 가능성이 큼 | application port로 감춤 |

Adapter 예외 처리:

- 외부 기술 예외를 그대로 application 밖으로 던지지 않습니다.
- timeout, connection failure, duplicate key, not found를 application 의미로 변환합니다.
- 변환 전 원인 예외는 로그나 cause로 추적 가능하게 둡니다.

## JPA 조회와 수정 전략

JPA 최적화의 기본 목표는 “무조건 join을 많이 하는 것”이 아니라, use case가 필요한 데이터만 명확히 가져오는 것입니다.

레거시에서 JPQL이 유의미했던 이유는 JPQL 자체가 특별히 빠르기 때문이 아니라, entity 전체 조회를 DTO projection으로 바꾸면서 필요한 필드만 한 번에 조회했고, 그 결과 N+1, lazy loading, entity hydration, Java DTO 변환 비용이 줄었기 때문입니다.

새 프로젝트에서는 다음 기준을 우선합니다.

| 상황 | 기본 전략 |
| --- | --- |
| 읽기 전용 목록 API | Querydsl 또는 JPQL DTO projection |
| 동적 필터/정렬/페이지네이션 | Querydsl 우선 |
| 고정 count/sum/group by | JPQL projection 또는 Querydsl |
| 단건 수정 | 수정 대상 entity만 영속 상태로 조회 |
| 단건 수정에서 연관 값이 필요 | 제한적으로 fetch join 또는 가벼운 projection |
| 대량 import/update | 참조 데이터는 DTO projection으로 bulk 조회, 수정 대상만 최소 로딩 |
| 복잡한 랭킹/통계/window function | native query 또는 summary table 검토 |

### DTO Projection

DTO projection은 읽기 전용 조회에 우선 사용합니다.

```java
public record PlaydataListItem(
        Long chartId,
        String songTitle,
        Integer level,
        Integer score,
        Integer rankCode,
        Integer medalCode,
        Integer popclass
) {
}
```

사용 기준:

- API 응답이나 화면용 view를 만들 때 사용합니다.
- entity를 수정할 필요가 없는 조회에 사용합니다.
- N+1을 피하고 필요한 컬럼만 조회하기 위해 사용합니다.
- 목록 조회는 pagination 또는 limit을 함께 사용합니다.

주의:

- DTO는 영속 entity가 아니므로 값을 바꿔도 DB가 변경되지 않습니다.
- 조회 결과를 다시 수정 흐름에 억지로 재사용하지 않습니다.
- 화면 DTO와 persistence projection DTO를 무리하게 하나로 합치지 않습니다.

### Fetch Join

Fetch join은 entity graph를 한 번에 로딩하기 위한 도구입니다. 기본적으로 read API의 N+1 방지에 사용하되, 수정 use case에서도 연관 entity 상태가 반드시 필요하면 제한적으로 사용할 수 있습니다.

사용해도 되는 경우:

- 단건 또는 소량 entity 수정입니다.
- 수정 대상 entity를 dirty checking으로 변경해야 합니다.
- 연관 entity 값이 계산이나 검증에 반드시 필요합니다.

예시:

```java
@Query("""
    select p
    from PlaydataEntity p
    join fetch p.chart c
    where p.user.id = :userId
      and p.chart.id = :chartId
""")
Optional<PlaydataEntity> findForUpdateWithChart(Long userId, Long chartId);
```

위 예시는 `PlaydataEntity`를 수정하면서 `Chart.level`, `Chart.deleted` 같은 값이 같은 transaction 안에서 필요할 때만 사용합니다.

주의:

- collection fetch join은 목록 조회와 pagination에서 특히 조심합니다.
- 대량 import에서 수천 개 entity graph를 fetch join으로 올리지 않습니다.
- 수정에 필요하지 않은 연관 entity를 습관적으로 fetch join하지 않습니다.

### 수정 Use Case

Playdata의 일부 필드만 수정하고 연관 객체 값이 필요 없다면 Playdata만 영속 상태로 가져옵니다.

```java
PlaydataEntity playdata = playdataRepository.findById(playdataId)
        .orElseThrow();

playdata.updateScore(score, rankCode, medalCode);
```

이 경우 `playdata.getChart()`나 `playdata.getUser()`를 호출하지 않으면 lazy loading은 발생하지 않습니다.

연관 값이 필요한 경우는 두 가지 중 하나를 선택합니다.

1. 단건 수정이면 fetch join을 사용합니다.
2. 대량 수정이면 필요한 값만 projection으로 bulk 조회합니다.

대량 import 예시:

```java
public record ChartForPlaydataImport(
        Long chartId,
        String songHash,
        Integer difficulty,
        Integer level,
        Integer chartVersion,
        boolean deleted
) {
}
```

대량 import 흐름:

```text
1. 입력 row에서 chart matching key를 모읍니다.
2. ChartForPlaydataImport를 bulk 조회합니다.
3. 기존 Playdata key를 bulk 조회합니다.
4. 변경이 필요한 Playdata만 수정하거나 insert합니다.
5. history를 append합니다.
6. popclass target을 재계산합니다.
```

이 흐름에서는 fetch join보다 projection과 chunk 처리, bulk upsert 전략이 중요합니다.

## 도메인 규칙

도메인 값은 primitive만 넘겨 다니지 않도록 점진적으로 값 객체를 사용합니다.

권장 값 객체:

```text
PoptomoId
SongId
SongHash
ChartId
Score
RankCode
MedalCode
DifficultyCode
Popclass
```

게임 정책:

- 유저 DB는 `users`와 `user_profiles` 2테이블 구조를 사용합니다. `users`는 계정/인증/권한, `user_profiles`는 공개 프로필/랭킹 표시 캐시/credit을 담당합니다.
- application use case는 `Account`, `Profile`, `Ranking` 책임을 나누되, persistence adapter는 필요하면 같은 `UserPersistenceAdapter`에서 여러 port를 구현할 수 있습니다.
- `SongHash`는 외부 조회 alias 값 객체로만 사용하고, 내부 영속 참조는 `SongId`/`ChartId`를 우선합니다.
- 랭크는 score에서 계산하지 않습니다.
- rank, medal, difficulty는 내부 code와 표시 label을 분리합니다.
- LONG POP ON/OFF는 메달로 파악합니다.
- 실험 기준으로는 더 높은 score를 유지하면서 medal만 바뀔 수 있으므로, score와 medal이 항상 같은 플레이에서 동시에 갱신된다고 가정하지 않습니다.
- popclass 반영 방식은 추가 실험 전까지 임의 보정하지 않습니다.
- 짠판정/짠게이지는 chart metadata로 저장할 수 있게 유지합니다.
- High☆Cheers처럼 버전별 정책이 바뀌는 값은 하드코딩보다 enum, policy object, constant table을 우선 검토합니다.

값 객체 기준:

- 값 범위가 있는 primitive는 값 객체 후보입니다.
- 외부 식별자와 내부 DB id는 타입이나 이름으로 구분합니다.
- 값 객체 생성 시점에 유효성 검증을 수행합니다.
- 표시 label은 domain 값과 분리합니다. 예: `RankCode`와 `RankLabel`

## Mapper 규칙

- API mapper는 `api` 모듈에 둡니다.
- Persistence mapper는 `infra` 모듈에 둡니다.
- application service 안에서 HTTP response를 만들지 않습니다.
- Controller 안에서 Entity를 만지지 않습니다.
- mapper가 비즈니스 계산을 하지 않습니다.

권장 흐름:

```text
Request DTO
  -> ApiMapper
  -> Command/Query
  -> UseCase
  -> Result/View
  -> ApiMapper
  -> Response DTO
```

## Logging 규칙

- logger는 class별로 선언합니다.
- password, reset token 원문, JWT secret, authorization header는 로그에 남기지 않습니다.
- 외부 API 응답 원문은 기본적으로 저장하지 않습니다.
- job id, trace id, user id, poptomo id처럼 추적 가능한 최소 정보만 남깁니다.
- 반복 루프 안에서 과도한 info log를 찍지 않습니다.
- 운영에서 필요한 이벤트는 structured field로 남길 수 있게 메시지를 고정합니다.

## API 응답 규칙

프론트가 화면 렌더링을 위해 매번 조합하지 않도록 응답을 구성합니다.

예:

- `GroupChartResponse`는 `song`과 `chart`가 DB에서 분리되어 있어도 곡 단위로 묶어 내려줍니다.
- `difficulty`, `rank`, `medal`은 `{ code, label, sortOrder }` 형태를 우선합니다.
- 사용자 프로필 화면에 필요한 summary count는 별도 API 호출을 과하게 늘리지 않도록 aggregation 응답을 검토합니다.
- nullable field는 의미가 명확해야 하며, 없음을 표현하는 값과 아직 모름을 표현하는 값을 섞지 않습니다.

## 예외와 에러 코드

- 도메인 규칙 위반은 domain/application 예외로 표현합니다.
- Controller advice에서 HTTP status와 에러 응답으로 변환합니다.
- 외부 시스템 실패, 인증 실패, 검증 실패, 데이터 없음은 서로 다른 error code를 사용합니다.
- 비밀번호, reset token, JWT, 외부 응답 원문은 에러 메시지에 포함하지 않습니다.

예외 위치:

| 위치 | 예외 |
| --- | --- |
| Domain | 값/정책 위반 |
| Application | use case 실패, 권한 없는 행위, 상태 충돌 |
| Infra | 기술 예외를 application 예외로 변환하기 전까지만 |
| API | validation, HTTP status 변환 |

## 비동기와 Job 규칙

- `@Async`는 가벼운 후처리에만 제한적으로 사용합니다.
- 대량 갱신, 대량 집계, 외부 파일 처리는 job으로 표현합니다.
- job은 상태, 시작/종료 시각, 실패 사유, retry count를 추적합니다.
- 같은 유저/같은 대상에 대한 중복 job 실행을 막습니다.
- worker는 chunk 단위로 처리하고, 실패 chunk를 추적 가능하게 남깁니다.
- job 처리 중 사용자에게 노출할 상태 API를 함께 설계합니다.

## 테스트 기준

테스트는 계층별 책임에 맞춰 작성합니다.

| 대상 | 테스트 |
| --- | --- |
| Domain value object | 값 범위, 동등성, 예외 |
| Application service | use case 흐름, port mock, transaction이 필요한 정책 |
| API Controller | request validation, status, response shape |
| Infra adapter | repository query, mapper, 외부 adapter contract |

새로운 계산식이나 데이터 정책을 추가할 때는 application/domain 테스트를 우선합니다. Controller 테스트만으로 비즈니스 규칙을 검증하지 않습니다.

## 주의 사항

- HTTP DTO와 JPA Entity를 직접 섞지 않습니다.
- Request/Response DTO를 application service 입력/출력으로 그대로 넘기지 않습니다.
- request thread에서 대량 갱신, 대량 집계, S3/외부 HTTP 작업을 길게 수행하지 않습니다.
- 랭크는 score에서 계산하지 않습니다.
- 비밀번호, reset token, JWT secret은 로그에 남기지 않습니다.
- 운영에 적용된 Flyway `V*.sql`은 수정하지 않습니다.
- 레거시 naming, package, mapper 스타일이 있더라도 새 기준과 충돌하면 새 기준을 우선합니다.
- 문서와 코드가 충돌하면 구현 전에 문서를 갱신하거나 ADR에 예외를 남깁니다.
