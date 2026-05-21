<section class="doc-hero">
  <span class="eyebrow">Design</span>
  <h1>설계</h1>
  <p>
    백엔드 구조, 데이터 모델, 마이그레이션, 운영 리스크를 구현 전에 검토하기 위한 섹션입니다.
    긴 문서가 많으므로 먼저 아래 순서대로 읽는 것을 권장합니다.
  </p>
</section>

<div class="reading-path reading-path--compact">
  <a class="path-step" href="../architecture/">
    <span>01</span>
    <strong>아키텍처</strong>
    <p>전체 서버 구성과 클린/헥사고널 계층 구조를 봅니다.</p>
  </a>
  <a class="path-step" href="../mvp-db-design/">
    <span>02</span>
    <strong>MVP DB 설계</strong>
    <p>핵심 테이블과 playdata/history 정책을 확인합니다.</p>
  </a>
  <a class="path-step" href="../migration-plan/">
    <span>03</span>
    <strong>마이그레이션 계획</strong>
    <p>레거시 DB와 S3 자켓을 새 구조로 옮기는 흐름을 봅니다.</p>
  </a>
</div>

<div class="doc-grid">
  <a class="doc-card" href="../architecture/">
    <span class="doc-card__eyebrow">Architecture</span>
    <strong>아키텍처</strong>
    <p>서버 2대 구성, Vercel 프론트, Docker 배포, 관측 스택의 큰 그림입니다.</p>
  </a>
  <a class="doc-card" href="../legacy-risk-response/">
    <span class="doc-card__eyebrow">Risk</span>
    <strong>레거시 문제 대응 전략</strong>
    <p>이전 백엔드에서 보인 성능, 스레드풀, 운영 위험을 새 구조에서 줄이는 방법입니다.</p>
  </a>
  <a class="doc-card" href="../troubleshooting/">
    <span class="doc-card__eyebrow">Troubleshooting</span>
    <strong>트러블슈팅 기록</strong>
    <p>과거 문제의 증상, 원인 추정, 개선 흐름을 누적합니다.</p>
  </a>
  <a class="doc-card" href="../legacy-db-inference/">
    <span class="doc-card__eyebrow">Legacy</span>
    <strong>기존 DB 구조</strong>
    <p>레거시 코드에서 추정한 참고 자료입니다. 신규 구현의 기준은 아닙니다.</p>
  </a>
  <a class="doc-card" href="../mvp-db-design/">
    <span class="doc-card__eyebrow">Database</span>
    <strong>MVP DB 설계</strong>
    <p>users/profile, song/chart, playdata/history, version transition 정책을 정리합니다.</p>
  </a>
  <a class="doc-card" href="../data-modeling/">
    <span class="doc-card__eyebrow">Modeling</span>
    <strong>데이터 모델링</strong>
    <p>도메인별 책임과 조회/갱신 정책을 구현 관점으로 설명합니다.</p>
  </a>
  <a class="doc-card" href="../migration-plan/">
    <span class="doc-card__eyebrow">Migration</span>
    <strong>마이그레이션 계획</strong>
    <p>Flyway schema migration과 데이터 이전 job/script를 분리합니다.</p>
  </a>
  <a class="doc-card" href="../decisions/">
    <span class="doc-card__eyebrow">ADR</span>
    <strong>의사결정 기록</strong>
    <p>확정된 결정과 그 이유를 짧게 추적합니다.</p>
  </a>
</div>

## 설계 원칙

- 레거시 구조보다 현재 요구사항과 운영 방식을 우선합니다.
- 내부 참조는 변경 가능한 `songHash`가 아니라 `songId`와 `chartId`를 기준으로 합니다.
- DB foreign key constraint는 만들지 않고, 애플리케이션 검증과 unique key/index로 보완합니다.
- 긴 갱신, 집계, 이미지 I/O는 request thread에서 분리하고 job/worker 기준으로 처리합니다.
