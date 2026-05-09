# 회의해야 할 것

아래 항목은 아직 코드나 스키마로 확정하지 말고, 팀 회의에서 먼저 결정해야 하는 주제입니다.

결정이 끝난 항목은 이 페이지에서 제거하지 않고, 요약과 함께 [의사결정 기록](../decisions.md)으로 옮깁니다.

## 회의 아젠다

| 번호 | 세션 | 결정해야 할 것 |
| --- | --- | --- |
| 1 | [데이터 모델링](data-modeling.md) | 팝클 계산식, 플레이데이터 저장 방식, 유저 비밀번호/복구 방식 |
| 2 | [songhash 생성 규칙](songhash.md) | 장르명/곡명/작곡가/Upper/버전 중 어떤 값을 식별자 seed로 사용할지 |
| 3 | [Upper 모델링](upper-modeling.md) | Upper를 같은 song의 chart로 둘지, 별도 song으로 둘지 |
| 4 | [LONG POP ON/OFF](long-pop.md) | LONG POP ON/OFF 상태에 따라 score와 popclass가 어떻게 저장/적용되는지 |

## 회의 운영 방식

- 각 세션에서 결정할 질문을 먼저 확인합니다.
- 실제 크롤링 데이터로 검증할 수 있는 항목은 회의 중 결론을 내리지 않고 검증 쿼리와 담당 작업으로 남깁니다.
- 결정된 내용은 [의사결정 기록](../decisions.md)에 ADR로 옮기고, DB/API/LLM 문서에 반영합니다.

## 결정 후 반영할 문서

- [MVP DB 설계 초안](../mvp-db-design.md)
- [데이터 모델링](../data-modeling.md)
- [API 설계](../api-design.md)
- [API Reference](../api-reference.md)
- [LLM 컨텍스트](../llm-context.md)
