<section class="doc-hero">
  <span class="doc-hero__eyebrow">Design</span>
  <h1>설계</h1>
  <p>백엔드 구조, DB 모델, 마이그레이션, 의사결정 기록을 구현 전에 읽을 수 있게 정리합니다.</p>
</section>

<div class="doc-grid">
  <a class="doc-card" href="../architecture/">
    <span class="doc-card__eyebrow">Architecture</span>
    <strong>아키텍처</strong>
    <p>서버, DB, 배포, 외부 연동의 큰 구조를 설명합니다.</p>
  </a>
  <a class="doc-card" href="../legacy-db-inference/">
    <span class="doc-card__eyebrow">Legacy</span>
    <strong>기존 DB 구조</strong>
    <p>이전 백엔드 domain 기준 기존 DB 구조입니다.</p>
  </a>
  <a class="doc-card" href="../mvp-db-design/">
    <span class="doc-card__eyebrow">Database</span>
    <strong>MVP DB 설계 초안</strong>
    <p>song/chart 분리, playdata, 인증, 이미지, ERD를 정리합니다.</p>
  </a>
  <a class="doc-card" href="../data-modeling/">
    <span class="doc-card__eyebrow">Modeling</span>
    <strong>데이터 모델링</strong>
    <p>식별자, 랭크/메달 원천 저장, LONG POP 검증 포인트를 다룹니다.</p>
  </a>
  <a class="doc-card" href="../migration-plan/">
    <span class="doc-card__eyebrow">Migration</span>
    <strong>마이그레이션 계획</strong>
    <p>Flyway schema migration과 대량 데이터 싱크 전략을 분리합니다.</p>
  </a>
  <a class="doc-card" href="../decisions/">
    <span class="doc-card__eyebrow">ADR</span>
    <strong>의사결정 기록</strong>
    <p>확정된 결정과 보류 중인 결정을 추적합니다.</p>
  </a>
</div>

## 설계 원칙

- 기존 서비스의 핵심 조회 패턴은 유지합니다.
- `song`과 `chart`를 분리합니다.
- DB foreign key constraint는 만들지 않습니다.
- 참조 정합성은 애플리케이션 검증, unique key, index, 정합성 점검 쿼리로 보완합니다.
- 대량 데이터 이전은 Flyway가 아니라 별도 job/script로 분리합니다.
