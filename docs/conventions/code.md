# 코드 컨벤션

## 백엔드 구조

권장 모듈 구조:

```text
api -> application -> domain
infra -> application/domain
```

## 원칙

- Controller는 HTTP request/response 변환에 집중합니다.
- Application service는 use case와 트랜잭션 경계를 담당합니다.
- Domain은 값 객체와 핵심 규칙을 담당합니다.
- Infra는 DB, security, 외부 연동 adapter를 담당합니다.

## 주의 사항

- HTTP DTO와 JPA Entity를 직접 섞지 않습니다.
- 랭크는 score에서 계산하지 않습니다.
- 비밀번호, reset token, JWT secret은 로그에 남기지 않습니다.
- 운영에 적용된 Flyway `V*.sql`은 수정하지 않습니다.

