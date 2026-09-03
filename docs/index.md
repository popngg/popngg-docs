<section class="landing-hero">
  <div class="landing-hero__copy">
    <span class="eyebrow">popn.gg Refactor Docs</span>
    <h1>popn.gg 리팩토링 문서</h1>
    <p>
      이 문서는 High☆Cheers 기준으로 재구축 중인 popn.gg의 기획, 구현 현황, 데이터 모델,
      API와 운영 기준을 함께 관리하는 작업 공간입니다. 설계 초안과 실제 백엔드 구현의 차이도
      명시적으로 기록합니다.
    </p>
    <div class="hero-actions">
      <a class="button button--primary" href="planning/">기획부터 보기</a>
      <a class="button button--ghost" href="implementation-status/">구현 현황 보기</a>
      <a class="button button--ghost" href="design/">설계 문서 보기</a>
    </div>
  </div>
  <div class="landing-hero__panel">
    <span class="panel-label">Current Focus</span>
    <strong>구현과 문서 동기화</strong>
    <p>Java 21, Spring Boot 3.5, Flyway V8 기반 구현과 설계 문서의 차이를 계속 줄입니다.</p>
  </div>
</section>

<section class="doc-section">
  <div class="section-heading">
    <span class="eyebrow">Start Here</span>
    <h2>추천 읽기 순서</h2>
    <p>처음 들어온 팀원이 길을 잃지 않도록, 의사결정 흐름에 맞춰 읽는 순서를 정리했습니다.</p>
  </div>

  <div class="reading-path">
    <a class="path-step" href="planning/overview/">
      <span>01</span>
      <strong>프로젝트 개요</strong>
      <p>왜 새로 시작하는지, 레거시는 어디까지 참고할지 확인합니다.</p>
    </a>
    <a class="path-step" href="implementation-status/">
      <span>02</span>
      <strong>구현 현황</strong>
      <p>현재 런타임, 모듈, API, migration과 설계 초안의 차이를 확인합니다.</p>
    </a>
    <a class="path-step" href="planning/service-research/">
      <span>03</span>
      <strong>서비스와 게임 리서치</strong>
      <p>High☆Cheers 변경점과 서비스 정책에 영향을 주는 게임 규칙을 봅니다.</p>
    </a>
    <a class="path-step" href="mvp-db-design/">
      <span>04</span>
      <strong>MVP DB 설계</strong>
      <p>song/chart, playdata/history, version best/all-time best 구조를 확인합니다.</p>
    </a>
    <a class="path-step" href="api-design/">
      <span>05</span>
      <strong>API 설계</strong>
      <p>프론트 가공을 줄이고 백엔드가 책임질 응답 구조를 확인합니다.</p>
    </a>
  </div>
</section>

<section class="doc-section">
  <div class="section-heading">
    <span class="eyebrow">Decision Snapshot</span>
    <h2>현재 확정에 가까운 방향</h2>
  </div>

  <div class="status-grid">
    <div class="status-card">
      <span class="status-card__tag">Architecture</span>
      <strong>헥사고널 / 레이어드 구조</strong>
      <p>API, application, domain, infra를 분리하고 구현 전에 의존 방향을 고정합니다.</p>
    </div>
    <div class="status-card">
      <span class="status-card__tag">Data</span>
      <strong>song과 chart 분리</strong>
      <p>곡 메타데이터와 난이도별 채보 정보를 분리해 Upper, 버전, 자켓 변경에 대응합니다.</p>
    </div>
    <div class="status-card">
      <span class="status-card__tag">Playdata</span>
      <strong>version best + all-time best</strong>
      <p>점수 초기화와 기록 유지 가능성을 모두 다루기 위해 현재 버전 기록과 역대 기록을 함께 저장합니다.</p>
    </div>
    <div class="status-card">
      <span class="status-card__tag">Operations</span>
      <strong>Docker, Flyway, 관측 스택</strong>
      <p>배포와 운영은 레거시 기준이 아니라 Docker 기반 배포와 Prometheus/Grafana/Loki/Alloy 기준으로 정리합니다.</p>
    </div>
  </div>
</section>

<section class="doc-section">
  <div class="section-heading">
    <span class="eyebrow">Document Map</span>
    <h2>문서 지도</h2>
  </div>

  <div class="doc-grid doc-grid--wide">
    <a class="doc-card" href="planning/">
      <span class="doc-card__eyebrow">Planning</span>
      <strong>기획</strong>
      <p>프로젝트 목표, MVP 범위, High☆Cheers 대응 정책을 정리합니다.</p>
    </a>
    <a class="doc-card" href="meetings/">
      <span class="doc-card__eyebrow">Discussion</span>
      <strong>회의해야 할 것</strong>
      <p>아직 결정하지 않은 쟁점과 회의에서 확정할 질문을 모읍니다.</p>
    </a>
    <a class="doc-card" href="design/">
      <span class="doc-card__eyebrow">Design</span>
      <strong>설계</strong>
      <p>아키텍처, DB 모델링, 마이그레이션 전략, 의사결정 기록을 모읍니다.</p>
    </a>
    <a class="doc-card" href="api/">
      <span class="doc-card__eyebrow">API</span>
      <strong>API</strong>
      <p>API 설계 원칙, 엔드포인트 초안, OpenAPI Reference를 제공합니다.</p>
    </a>
    <a class="doc-card" href="conventions/">
      <span class="doc-card__eyebrow">Convention</span>
      <strong>컨벤션</strong>
      <p>문서, 코드, DB, 테스트, Git 규칙을 구현 전에 맞춥니다.</p>
    </a>
    <a class="doc-card" href="operations/">
      <span class="doc-card__eyebrow">Operations</span>
      <strong>운영</strong>
      <p>Docker, Flyway, 모니터링, 로그 수집 흐름을 정리합니다.</p>
    </a>
  </div>
</section>

<section class="doc-section doc-section--compact">
  <div class="doc-callout">
    <strong>문서 운영 원칙</strong>
    <p>
      확정된 결정은 설계 문서와 ADR에 남기고, 아직 논의 중인 내용은 회의 문서에 둡니다.
      레거시 코드는 구현 기준이 아니라 문제를 이해하기 위한 참고 자료로만 사용합니다.
    </p>
  </div>
</section>
