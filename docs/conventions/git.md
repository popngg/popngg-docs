# Git 컨벤션

## Branch

권장 브랜치:

```text
main
feature/<topic>
fix/<topic>
docs/<topic>
```

branch 이름은 짧고 변경 목적이 보여야 합니다.

예:

```text
feature/song-search-api
feature/renew-job-worker
fix/password-reset-token-expiry
docs/search-live-api-meeting
```

규칙:

- `main`은 배포 가능한 상태를 유지합니다.
- 기능 개발은 `feature/`, 버그 수정은 `fix/`, 문서만 변경하면 `docs/`를 사용합니다.
- 한 branch에는 하나의 주된 목적만 담습니다.
- 대규모 리팩토링과 기능 추가를 같은 PR에 섞지 않습니다.

## Commit

커밋 메시지는 변경 목적이 드러나게 작성합니다.

예:

```text
docs: add MVP database design
docs: update API reference
fix: correct password reset token policy
```

권장 type:

| Type | 용도 |
| --- | --- |
| `feat` | 사용자 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `refactor` | 동작 변화 없는 구조 개선 |
| `test` | 테스트 추가/수정 |
| `build` | Gradle/Docker/CI 변경 |
| `chore` | 기타 관리 작업 |

규칙:

- subject는 명령형 또는 짧은 설명형으로 씁니다.
- 한 커밋에 무관한 변경을 섞지 않습니다.
- secret, 로컬 설정 파일, 개인 경로를 커밋하지 않습니다.
- 운영에 적용된 Flyway 파일을 수정하는 커밋은 만들지 않습니다. 새 migration을 추가합니다.

## Pull Request

PR에는 다음을 포함합니다.

- 변경 요약
- 영향 범위
- 검증 방법
- 관련 문서 링크

API나 DB가 바뀌는 PR은 관련 문서도 함께 업데이트합니다.

## PR 체크리스트

PR 작성자는 아래를 확인합니다.

- [ ] 변경 목적이 PR 제목과 설명에서 드러납니다.
- [ ] API 변경 시 OpenAPI와 API 설계 문서를 갱신했습니다.
- [ ] DB 변경 시 Flyway migration과 DB 문서를 갱신했습니다.
- [ ] 보안/로그 정책 변경 시 컨벤션 또는 운영 문서를 갱신했습니다.
- [ ] 긴 작업이 request thread에서 실행되지 않는지 확인했습니다.
- [ ] 테스트 또는 검증 방법을 적었습니다.
- [ ] rollback 또는 migration 주의사항이 있으면 적었습니다.

## Review

- 리뷰는 동작, 경계, 보안, 운영 영향 순서로 봅니다.
- 스타일 지적은 컨벤션 링크와 함께 남깁니다.
- 문서와 코드가 다르면 둘 중 하나를 반드시 맞춥니다.
- 회의가 필요한 주제는 PR 안에서 즉시 확정하지 않고 `meetings/` 문서로 옮깁니다.

## Merge

- main merge 전 CI가 통과해야 합니다.
- migration이 포함된 PR은 배포 순서를 확인합니다.
- squash merge 여부는 팀 정책으로 정하되, PR 단위로 의미 있는 변경이 남아야 합니다.
- hotfix는 원인과 후속 문서 업데이트를 함께 남깁니다.
