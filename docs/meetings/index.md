# 회의해야 할 것

아래 항목은 아직 코드나 스키마로 확정하지 말고, 팀 회의에서 먼저 결정해야 하는 주제입니다.

결정이 끝난 항목은 이 페이지에서 제거하지 않고, 요약과 함께 [의사결정 기록](../decisions.md)으로 옮깁니다.

<div class="doc-summary">
  <div class="doc-summary__item">
    <strong>회의 문서의 역할</strong>
    <p>아직 구현 기준으로 삼기 이른 선택지를 모아두고, 결정 후 ADR과 설계 문서로 옮깁니다.</p>
  </div>
  <div class="doc-summary__item">
    <strong>우선순위</strong>
    <p>데이터 모델링, songHash, 검색, LONG POP은 DB/API에 직접 영향을 주므로 먼저 확정해야 합니다.</p>
  </div>
  <div class="doc-summary__item">
    <strong>주의</strong>
    <p>회의 문서의 추천안은 확정이 아닙니다. 확정된 내용은 반드시 ADR 또는 각 설계 문서에 반영합니다.</p>
  </div>
</div>

## 회의 아젠다

| 번호 | 세션 | 결정해야 할 것 |
| --- | --- | --- |
| 1 | [데이터 모델링](data-modeling.md) | 팝클 계산식, 플레이데이터 저장 방식, 버전 전환 정책, 유저 비밀번호/복구 방식 |
| 2 | [songhash 생성 규칙](songhash.md) | 장르명/곡명/작곡가/Upper/버전 중 어떤 값을 식별자 seed로 사용할지 |
| 3 | [Upper 모델링](upper-modeling.md) | Upper를 같은 song의 chart로 둘지, 별도 song으로 둘지 |
| 4 | [LONG POP ON/OFF](long-pop.md) | LONG POP ON/OFF 상태에 따라 score와 popclass가 어떻게 저장/적용되는지 |
| 5 | [곡 검색 API와 라이브서치](song-search.md) | 검색 책임을 백엔드로 옮길 때 Redis/read model/API 응답/장애 대응을 어떻게 설계할지 |

## 회의 운영 방식

- 각 세션에서 결정할 질문을 먼저 확인합니다.
- 실제 크롤링 데이터로 검증할 수 있는 항목은 회의 중 결론을 내리지 않고 검증 쿼리와 담당 작업으로 남깁니다.
- 결정된 내용은 [의사결정 기록](../decisions.md)에 ADR로 옮기고, DB/API/LLM 문서에 반영합니다.

## 결정 후 반영할 문서

- [MVP DB 설계 초안](../mvp-db-design.md)
- [데이터 모델링](../data-modeling.md)
- [API 설계](../api-design.md)
- [API Reference](../api-reference.md)
- [운영과 배포](../operations.md)
- [LLM 컨텍스트](../llm-context.md)
