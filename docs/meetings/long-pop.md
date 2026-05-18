# LONG POP ON/OFF

LONG POP ON/OFF 상태는 클리어 메달로 파악할 수 있습니다. 점수와 메달의 저장 방식은 일부 실험으로 확인되었고, 팝클래스 영향 같은 세부 사항은 추가 검증이 필요합니다.

## 검증해야 하는 예시

```text
1. LONG POP OFF 상태로 95000점 달성
2. 이후 LONG POP ON 상태로 90000점 달성
```

실험 결과:

- 점수는 더 높은 점수인 `95000`이 유지됩니다.
- 메달은 이후 플레이 상태를 반영해 LONG POP ON 기준으로 바뀔 수 있습니다.
- 즉 LONG POP ON/OFF에 따라 score와 medal이 완전히 같은 기준으로 함께 움직이지 않을 수 있습니다.

## 회의에서 결정할 질문

1. 크롤링 원천에서 LONG POP ON/OFF 상태를 명시적으로 얻을 수 있는가?
2. LONG POP ON/OFF는 medal만으로 충분히 판별 가능한가?
3. popclass 계산은 “유지된 최고 score + 최신 medal” 조합을 기준으로 하는가?
4. LONG POP ON/OFF 원천 상태를 별도 필드로 보존해야 하는가?
5. `playdata`에 `long_pop_state` 같은 필드를 추가할 필요가 있는가?
6. 실기 검증 전까지 서버는 score를 보정하지 않고 원천 score/rank/medal만 저장하는 정책으로 둘 것인가?

## 현재 임시 정책

- 서버는 score로 rank를 계산하지 않습니다.
- 서버는 LONG POP ON/OFF에 따른 score를 임의로 보정하지 않습니다.
- 크롤링 원천에서 받은 `score`, `rankCode`, `medalCode`를 그대로 저장합니다.
- 검증된 범위에서는 더 높은 score를 유지하고, medal은 이후 플레이 상태를 반영할 수 있다고 봅니다.
- LONG POP ON/OFF와 popclass 적용 방식은 추가 실험 후 확정합니다.
