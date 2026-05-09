# LONG POP ON/OFF

LONG POP ON/OFF 상태는 클리어 메달로 파악할 수 있습니다. 다만 점수와 팝클래스가 어떤 기준으로 남는지는 아직 검증이 필요합니다.

## 검증해야 하는 예시

```text
1. LONG POP OFF 상태로 95000점 달성
2. 이후 LONG POP ON 상태로 93000점 달성
```

이때 클리어 메달은 LONG POP ON 기준으로 바뀔 수 있습니다. 하지만 score가 95000점으로 유지되는지, 93000점으로 갱신되는지, 또는 ON/OFF 별도 최고점이 존재하는지는 아직 확정되지 않았습니다.

## 회의에서 결정할 질문

1. 크롤링 원천에서 LONG POP ON/OFF 상태를 명시적으로 얻을 수 있는가?
2. LONG POP ON/OFF는 medal만으로 충분히 판별 가능한가?
3. score는 LONG POP ON/OFF를 통합한 하나의 최고점인가, 상태별 최고점인가?
4. popclass 계산은 LONG POP ON/OFF 중 어떤 score를 기준으로 하는가?
5. `playdata`에 `long_pop_state` 같은 필드를 추가할 필요가 있는가?
6. 실기 검증 전까지 서버는 score를 보정하지 않고 원천 score/rank/medal만 저장하는 정책으로 둘 것인가?

## 현재 임시 정책

- 서버는 score로 rank를 계산하지 않습니다.
- 서버는 LONG POP ON/OFF에 따른 score를 임의로 보정하지 않습니다.
- 크롤링 원천에서 받은 `score`, `rankCode`, `medalCode`를 그대로 저장합니다.
- LONG POP ON/OFF와 popclass 적용 방식은 실기 검증 후 확정합니다.
