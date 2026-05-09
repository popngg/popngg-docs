# popn.gg Docs

popn.gg는 아케이드 리듬게임 `pop'n music`의 곡, 채보, 플레이데이터, 랭킹 정보를 제공하는 서비스입니다.

이 문서는 현재 진행 중인 High☆Cheers 리팩토링을 정리하는 동시에, 추후 오픈소스 공개를 염두에 둔 프로젝트 문서 허브입니다.

## 문서 섹션

| 섹션 | 내용 |
| --- | --- |
| [기획](planning/index.md) | 프로젝트 목표, MVP 범위, 게임 시스템 정책 |
| [설계](design/index.md) | 아키텍처, DB 모델링, 마이그레이션 전략, ADR |
| [API](api/index.md) | API 설계 원칙과 Redoc 기반 API Reference |
| [컨벤션](conventions/index.md) | 문서, 코드, DB, Git 운영 규칙 |
| [운영](operations.md) | Jenkins, Docker, Flyway 기반 배포와 운영 |
| [LLM 컨텍스트](llm-context.md) | Codex/LLM이 구현 전에 읽을 압축 컨텍스트 |

## 현재 리팩토링 핵심

- 기준 게임 버전은 `pop'n music High☆Cheers!!`입니다.
- `song`과 `chart`를 분리합니다.
- 랭크는 점수로 계산하지 않고 크롤링 원천 데이터에서 받은 값을 저장합니다.
- 이메일 기반 비밀번호 복구를 MVP에 포함합니다.
- DB foreign key constraint는 만들지 않고 애플리케이션 검증과 인덱스로 운영합니다.
- DB schema migration은 Flyway로 관리합니다.
- 배포는 Jenkins와 Docker를 기준으로 합니다.

## 공개 문서 운영 원칙

- 개인 이름, 가용성, 내부 일정 같은 비공개 운영 정보는 문서에 넣지 않습니다.
- 확정된 내용과 검토 중인 내용을 분리합니다.
- API와 DB 변경은 마이그레이션/호환성 전략과 같이 기록합니다.
- 결정 사항은 ADR 형태로 남깁니다.

## 로컬 문서 실행

```bash
pip install -r requirements.txt
mkdocs serve
```

브라우저에서 `http://127.0.0.1:8000`을 열면 됩니다.

