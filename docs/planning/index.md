<section class="doc-hero">
  <span class="eyebrow">Planning</span>
  <h1>기획</h1>
  <p>
    popn.gg 리팩토링의 제품 목표, MVP 범위, High☆Cheers 대응 정책을 정리합니다.
    이 섹션은 “무엇을 만들 것인가”와 “무엇을 아직 만들지 않을 것인가”를 결정하는 출발점입니다.
  </p>
</section>

<div class="doc-grid">
  <a class="doc-card" href="overview/">
    <span class="doc-card__eyebrow">Overview</span>
    <strong>프로젝트 개요</strong>
    <p>새 프로젝트로 다시 설계하는 이유, 문서 운영 방식, 레거시 참고 범위를 정리합니다.</p>
  </a>
  <a class="doc-card" href="mvp-scope/">
    <span class="doc-card__eyebrow">MVP</span>
    <strong>MVP 범위</strong>
    <p>출시를 위해 반드시 필요한 기능과 후순위로 미룰 기능을 구분합니다.</p>
  </a>
  <a class="doc-card" href="service-research/">
    <span class="doc-card__eyebrow">Research</span>
    <strong>서비스와 게임 리서치</strong>
    <p>High☆Cheers 변경점, 랭크/메달/곡 식별 정책, 서비스 기능 변화를 모읍니다.</p>
  </a>
  <a class="doc-card" href="../game-system/">
    <span class="doc-card__eyebrow">Game System</span>
    <strong>게임 시스템</strong>
    <p>랭크, 메달, LONG POP, 짠게이지/짠판정 저장 정책을 확인합니다.</p>
  </a>
</div>

## 이 섹션에서 확인할 것

- 이번 리팩토링은 `popngg-old`를 그대로 옮기는 작업이 아니라 새 기준을 세우는 작업입니다.
- High☆Cheers 변경 사항을 우선 지원하되, 다음 버전 변화에도 대응할 수 있게 설계합니다.
- 프론트에서 하던 데이터 가공은 가능한 한 백엔드 API 응답으로 이동합니다.
- 문서는 추후 공개 가능성을 고려해 개인 정보와 운영 비밀을 제외하고 작성합니다.
