<section class="doc-hero">
  <span class="eyebrow">Convention</span>
  <h1>컨벤션</h1>
  <p>
    문서, 코드, API, DB, 테스트, Git 규칙을 한곳에 모읍니다.
    구현 전에 규칙을 정해두면 팀원이 늘어나도 같은 방향으로 작업할 수 있습니다.
  </p>
</section>

<div class="doc-grid">
  <a class="doc-card" href="docs/">
    <span class="doc-card__eyebrow">Docs</span>
    <strong>문서 컨벤션</strong>
    <p>초안/확정 구분, 공개 문서 작성 원칙, LLM 컨텍스트 관리 규칙입니다.</p>
  </a>
  <a class="doc-card" href="code/">
    <span class="doc-card__eyebrow">Code</span>
    <strong>코드 컨벤션</strong>
    <p>백엔드 구현에서 맞출 계층, 네이밍, DTO, 예외 처리 규칙입니다.</p>
  </a>
  <a class="doc-card" href="api/">
    <span class="doc-card__eyebrow">API</span>
    <strong>API 컨벤션</strong>
    <p>endpoint, request/response, error, pagination, live search 규칙입니다.</p>
  </a>
  <a class="doc-card" href="database/">
    <span class="doc-card__eyebrow">Database</span>
    <strong>DB 컨벤션</strong>
    <p>테이블, 컬럼, 인덱스, Flyway 파일 작성 기준입니다.</p>
  </a>
  <a class="doc-card" href="testing/">
    <span class="doc-card__eyebrow">Test</span>
    <strong>테스트 컨벤션</strong>
    <p>계층별 테스트 범위, 이름, fixture, 부하 테스트 기준입니다.</p>
  </a>
  <a class="doc-card" href="git/">
    <span class="doc-card__eyebrow">Git</span>
    <strong>Git 컨벤션</strong>
    <p>branch, commit, PR, 문서 변경 추적 방식을 정리합니다.</p>
  </a>
</div>

## 공통 원칙

- 규칙은 구현자의 기억에 맡기지 않고 문서에 남깁니다.
- 확정되지 않은 규칙은 회의 문서에 두고, 확정 후 컨벤션 문서로 옮깁니다.
- API와 DB 변경은 설계 문서, OpenAPI, 마이그레이션 계획을 함께 갱신합니다.
- 컨벤션을 어기는 경우 PR 설명에 이유와 영향 범위를 남깁니다.
