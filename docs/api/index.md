<section class="doc-hero">
  <span class="eyebrow">API</span>
  <h1>API</h1>
  <p>
    프론트에서 모든 데이터를 받아 직접 가공하던 흐름을 줄이고, 백엔드가 검색·필터링·페이지네이션·집계를
    책임지기 위한 API 설계 문서입니다.
  </p>
</section>

<div class="doc-grid">
  <a class="doc-card" href="../api-design/">
    <span class="doc-card__eyebrow">Design</span>
    <strong>API 설계</strong>
    <p>도메인별 endpoint, 응답 정책, 관리자 API 후보, playdata 응답 구조를 정리합니다.</p>
  </a>
  <a class="doc-card" href="../api-reference/">
    <span class="doc-card__eyebrow">Reference</span>
    <strong>API Reference</strong>
    <p>OpenAPI YAML을 Redoc으로 렌더링한 상세 API 문서입니다.</p>
  </a>
</div>

## API 설계 기준

- API는 레거시 endpoint 복제가 아니라 새 서비스 경험을 기준으로 설계합니다.
- 응답은 프론트가 바로 그릴 수 있는 구조를 우선합니다.
- playdata 응답은 `versionBest`, `allTimeBest`, `medal`을 함께 제공합니다.
- 곡 검색은 백엔드 검색 API로 제공하며, 검색 태그와 캐시 전략은 별도 회의 문서에서 확정합니다.
- 운영성 API는 관리자 영역(`/admin`)에 두고, 실제 구현 우선순위는 MVP 범위에 맞춰 조정합니다.
