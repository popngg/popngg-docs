# 코드 컨벤션

이 문서는 리팩토링 이후에도 같은 스타일로 개발하기 위한 기준입니다. 새 기능을 추가할 때는 기존 코드가 이미 정해 둔 멀티모듈, use case, port/adapter, DTO 분리 방식을 유지합니다.

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

## 도메인 규칙

도메인 값은 primitive만 넘겨 다니지 않도록 점진적으로 값 객체를 사용합니다.

권장 값 객체:

```text
PoptomoId
SongHash
ChartId
Score
RankCode
MedalCode
DifficultyCode
Popclass
```

게임 정책:

- 랭크는 score에서 계산하지 않습니다.
- rank, medal, difficulty는 내부 code와 표시 label을 분리합니다.
- LONG POP ON/OFF는 메달로 파악하되, score/popclass 반영 방식은 검증 전까지 임의 보정하지 않습니다.
- 짠판정/짠게이지는 chart metadata로 저장할 수 있게 유지합니다.
- High☆Cheers처럼 버전별 정책이 바뀌는 값은 하드코딩보다 enum, policy object, constant table을 우선 검토합니다.

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
- 랭크는 score에서 계산하지 않습니다.
- 비밀번호, reset token, JWT secret은 로그에 남기지 않습니다.
- 운영에 적용된 Flyway `V*.sql`은 수정하지 않습니다.
- 기존 코드가 이미 쓰는 naming, package, mapper 스타일이 있으면 새 스타일을 만들기보다 기존 방식을 확장합니다.
- 문서와 코드가 충돌하면 구현 전에 문서를 갱신하거나 ADR에 예외를 남깁니다.
