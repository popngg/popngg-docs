<section class="doc-hero">
  <span class="doc-hero__eyebrow">Convention</span>
  <h1>컨벤션</h1>
  <p>프로젝트를 오픈소스로 공개할 때도 유지 가능한 공통 규칙을 정리합니다.</p>
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
    <p>백엔드 구현에서 맞출 기본 코드 스타일과 계층 규칙입니다.</p>
  </a>
  <a class="doc-card" href="api/">
    <span class="doc-card__eyebrow">API</span>
    <strong>API 컨벤션</strong>
    <p>endpoint, request/response, error, pagination, live search 규칙입니다.</p>
  </a>
  <a class="doc-card" href="database/">
    <span class="doc-card__eyebrow">Database</span>
    <strong>DB 컨벤션</strong>
    <p>테이블, 컬럼, 인덱스, Flyway 파일 작성 규칙입니다.</p>
  </a>
  <a class="doc-card" href="testing/">
    <span class="doc-card__eyebrow">Test</span>
    <strong>테스트 컨벤션</strong>
    <p>계층별 테스트 범위, 이름, 픽스처, 검증 기준입니다.</p>
  </a>
  <a class="doc-card" href="git/">
    <span class="doc-card__eyebrow">Git</span>
    <strong>Git 컨벤션</strong>
    <p>branch, commit, PR, 문서 변경 추적 방식을 정리합니다.</p>
  </a>
</div>

## 공통 원칙

- 새 구현은 이 문서들을 기준으로 하고, 레거시 코드는 비교와 이행을 위한 참고 자료로만 봅니다.
- 공개 문서에는 개인 정보, 비밀값, 내부 운영 사정을 포함하지 않습니다.
- 의사결정은 ADR로 기록합니다.
- API, DB, 운영 정책 변경은 문서와 함께 변경합니다.
- 구현보다 문서가 앞서갈 수 있지만, 확정/초안 상태를 명확히 표시합니다.
- 컨벤션을 어겨야 할 때는 PR 설명에 이유와 영향 범위를 남깁니다.
