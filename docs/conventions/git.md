# Git 컨벤션

## Branch

권장 브랜치:

```text
main
feature/<topic>
fix/<topic>
docs/<topic>
```

## Commit

커밋 메시지는 변경 목적이 드러나게 작성합니다.

예:

```text
docs: add MVP database design
docs: update API reference
fix: correct password reset token policy
```

## Pull Request

PR에는 다음을 포함합니다.

- 변경 요약
- 영향 범위
- 검증 방법
- 관련 문서 링크

API나 DB가 바뀌는 PR은 관련 문서도 함께 업데이트합니다.
