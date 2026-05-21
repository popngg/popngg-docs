# 게임 시스템 변경

## 기준 버전

리팩토링의 기준 게임 버전은 `pop'n music High☆Cheers!!`입니다.

- 일본 가동 시작: 2025-12-18
- 본편 29번째 작품
- 장르명 표기 부활
- `EASY` 난이도명이 `LIGHT`로 변경된 것으로 관찰됨
- 점수 랭크에 `+` 등급 추가

참고:

- KONAMI 제품 페이지: <https://www.konami.com/arcadegames/products/am_popn_29/>
- KONAMI 가동 공지: <https://www.konami.com/arcadegames/corporate/ja/topics/2025/1218/>
- Pop'n Music Wiki High☆Cheers 정리: <https://popnmusic.fandom.com/wiki/Pop%27n_Music_High%E2%98%86Cheers%21%21>

## 랭크

High☆Cheers에서 점수 랭크 체계가 변경되었습니다. 기존 랭크에 `S+`, `AA+`, `A+`, `B+`가 추가됩니다.

중요 정책:

- 서버 내부에서 점수만 보고 랭크를 판단하지 않습니다.
- clear 여부에 따라 같은 점수라도 랭크가 달라질 수 있습니다.
- 갱신/크롤링 시점에 게임 화면 또는 원천 데이터의 랭크를 함께 수집하고, 그 값을 저장합니다.
- 아래 점수 구간은 참고/검증용입니다. 핵심 판정 로직으로 사용하지 않습니다.

| 랭크 | 점수 구간 | 조건 |
| --- | --- | --- |
| `S+` | 99,000 이상 | 클리어 |
| `S` | 98,000 - 98,999 | 클리어 |
| `AAA` | 95,000 - 97,999 | 클리어 |
| `AA+` | 93,000 - 94,999 | 클리어 |
| `AA` | 90,000 - 92,999 | 클리어 |
| `A+` | 86,000 - 89,999 | 클리어 |
| `A` | 82,000 이상 | clear 여부 영향 있음 |
| `B+` | 77,000 - 81,999 | clear 여부 영향 있음 |
| `B` | 72,000 - 76,999 | clear 여부 영향 있음 |
| `C` | 62,000 - 71,999 | clear 여부 영향 있음 |
| `D` | 50,000 - 61,999 | clear 여부 영향 있음 |
| `E` | 49,999 이하 | clear 여부 영향 있음 |

### 구현 메모

- 현재 `Rank`는 정수 값 객체입니다.
- High☆Cheers 이후에는 랭크 코드와 표시명을 분리해야 합니다.
- `rank_code`는 크롤링된 랭크를 저장하는 필드입니다.
- `score`는 점수 자체를 저장하는 필드이고, `rank_code`를 재계산하기 위한 source of truth가 아닙니다.
- 점수 구간은 데이터 검증, 관리자 리포트, 비정상 크롤링 감지에만 사용합니다.
- API 응답은 `code`, `label`, `sortOrder`, `scoreRange`, `requiresClearForReference`를 함께 내려줄 수 있습니다.

## 난이도

High☆Cheers 기준으로 난이도 표기는 `L / N / H / EX`를 우선 지원합니다.

| 표시 | 의미 | 비고 |
| --- | --- | --- |
| `L` | LIGHT | 기존 EASY 명칭 변경으로 추정 |
| `N` | NORMAL | 유지 |
| `H` | HYPER | 유지 |
| `EX` | EX | 유지 |

### 구현 메모

- 내부 difficulty code와 외부 표시명을 분리합니다.
- 기존 데이터의 `EASY`는 표시 단계에서 `LIGHT`로 변환할 수 있게 합니다.
- 버전별 표시명이 필요하면 `difficulty_label_policy` 또는 상수 API에서 관리합니다.

## 메달

신규 메달 `어시이지`를 추가합니다.

### 구현 메모

- 현재 `Medal`은 정수 값 객체입니다.
- 메달은 클리어 상태, 이지/노멀/하드 계열, 실패/미플레이 여부를 구분할 수 있어야 합니다.
- API는 프론트가 badge 표시를 바로 할 수 있도록 `code`, `label`, `shortLabel`, `sortOrder`를 내려주는 방식을 권장합니다.

### LONG POP ON/OFF

LONG POP OFF 여부는 클리어 메달로 파악할 수 있습니다. LONG POP OFF 기록 이후 LONG POP ON으로 다시 플레이했을 때의 점수/메달 저장 방식도 일부 실험으로 확인되었습니다.

검증 예시:

```text
1. 95,000점 LONG POP OFF
2. 이후 90,000점 LONG POP ON
```

실험 결과 이 경우 점수는 `95,000`으로 유지되고, 메달은 LONG POP ON 기준으로 바뀔 수 있습니다.

프로젝트 정책:

- 서버는 LONG POP ON/OFF 상태를 추론해 점수나 메달을 보정하지 않습니다.
- 갱신 원천 데이터의 현재 버전 `score`, `rank`, `medal`을 저장합니다.
- 검증된 범위에서는 “더 높은 score 유지 + 이후 플레이 상태를 반영한 medal 변경”이 가능하다고 봅니다.
- 팝클 계산은 현재 버전 베스트 row의 score/medal을 기준으로 하되, LONG POP ON/OFF의 정확한 팝클 영향은 추가 실험으로 확정합니다.

## 버전 베스트와 역대 베스트

High☆Cheers에서 처음으로 기존 점수 초기화가 확인되었고, 앞으로도 버전 변경 시 점수 초기화가 다시 발생할 수 있습니다. 따라서 `playdata` 구조는 특정 한 버전 전환이 아니라, 버전별 초기화를 일반적으로 수용할 수 있게 설계합니다.

프로젝트 정책:

- 기존 DB의 플레이데이터는 28버전 기록으로 마이그레이션합니다.
- 앞으로 크롤링한 점수는 무조건 현재 버전에서 나온 기록으로 저장합니다.
- `playdata`는 `user_id + chart_id`당 현재 상태 1 row만 유지합니다.
- 버전 전환 시 점수 처리 방식은 `RESET` 또는 `CARRY_OVER` 정책으로 명시합니다.
- 현재 버전 베스트는 `current_version`, `version_score`, `version_rank_code`로 저장합니다.
- 역대 베스트는 `all_time_score`, `all_time_score_version`, `all_time_rank_code`로 저장합니다.
- 메달은 버전이 바뀌어도 유지되므로 `medal_code`로 별도 상태처럼 저장합니다.
- 조회 API는 한 row에서 `versionBest`, `allTimeBest`, `medal`을 분리해 내려줍니다.
- 팝클은 이번 버전 기준으로 계산합니다. 즉 현재 버전 `version_score`만 유저 팝클 계산에 사용합니다.
- 현재 버전 점수가 역대 베스트를 넘으면 `version_score`와 `all_time_score`를 함께 갱신합니다.
- 현재 버전 점수가 역대 베스트보다 낮으면 `version_score`만 갱신하고 `all_time_score`는 유지합니다.

## 갱신 코드

갱신 코드는 랭크를 반드시 함께 수집해야 합니다.

| 수집 항목 | 저장 위치 | 비고 |
| --- | --- | --- |
| 현재 버전 점수 | `playdata.version_score` | 정수 점수. 버전 전환 정책에 따라 초기화 또는 승계 |
| 현재 버전 | `playdata.current_version` | 크롤링 점수는 현재 게임 버전 |
| 역대 점수 | `playdata.all_time_score` | 전체 버전 중 최고 점수 |
| 역대 점수 버전 | `playdata.all_time_score_version` | 역대 점수가 나온 버전 |
| 랭크 | `playdata.version_rank_code`, `playdata.all_time_rank_code` | 원천 데이터에서 수집한 값 |
| 메달 | `playdata.medal_code` | 버전 변경 후에도 유지되는 값 |
| 클리어 여부 | `playdata` 또는 medal 파생 | 랭크 검증 참고값 |

| 시나리오 | 서버 구현 |
| --- | --- |
| KONAMI가 JSON 제공 | JSON에서 score/rank/medal을 함께 파싱 |
| HTML/이미지/비정형 데이터 | score/rank/medal 영역을 함께 크롤링/파싱 |
| 수동 업로드 | 관리자 API에서 rank를 필수 입력값으로 받음 |

## 버전 전환 정책

버전이 올라갔다고 해서 항상 점수가 초기화된다고 가정하지 않습니다.

| 정책 | 의미 | 예시 |
| --- | --- | --- |
| `RESET` | 신규 버전의 `version_score`를 0 또는 첫 관측 점수로 시작 | 28 -> 29에서 점수 초기화 |
| `CARRY_OVER` | 이전 버전의 `version_score`를 신규 버전 시작 점수로 유지 | 29 -> 30에서 기록 초기화가 없는 경우 |

운영 흐름:

1. 신규 버전이 확인되면 관리자 API로 전환 정책을 등록합니다.
2. 점수 초기화 여부가 확정되기 전에는 `DRAFT` 상태로 둡니다.
3. 확정 후 적용 API 또는 Jenkins job으로 `playdata.current_version`을 chunk 단위로 갱신합니다.
4. `RESET`이면 `VERSION_INITIALIZED`, `CARRY_OVER`이면 `VERSION_CARRIED_OVER` 이력을 남깁니다.
5. `display_popclass`는 전환 정책 적용 후 현재 `version_score` 기준으로 재계산합니다.

## 자켓 표시 정책

High☆Cheers에서 장르명 표기가 부활했습니다.

- 장르명을 곡 표시 정보에 포함합니다.
- 어퍼딱지는 표시에서 제거합니다.
- `isUpper` 데이터 자체는 songhash 판별과 채보 구분을 위해 보존 여부를 검토합니다.
- 자켓 파일명/URL 규칙은 song metadata와 chart metadata 중 어디에 둘지 확정해야 합니다.

## 짠판정 / 짠게이지

팝픈은 곡 또는 채보마다 짠판정, 짠게이지 특성이 존재합니다. MVP DB는 이를 저장할 수 있어야 합니다.

짠게이지는 chart metadata로 판단해야 합니다. 노트 수가 1536개를 넘는 채보에서 짠게이지가 적용되므로, 같은 곡이라도 높은 난이도만 짠게이지일 수 있습니다.

| 선택지 | 장점 | 단점 |
| --- | --- | --- |
| Song metadata | 곡 단위 특성으로 보기 쉬움 | 난이도별로 다르면 표현 불가 |
| Chart metadata | 난이도별 차이 표현 가능 | 곡 목록 조회 시 집계 필요 |

현재 권장: `charts.has_strict_judgement`, `charts.has_strict_gauge`로 둡니다. 특히 `has_strict_gauge`는 노트 수 기준 때문에 `songs`에 두면 표현력이 부족합니다. 실제 데이터가 곡 단위로만 존재한다고 확인되면 API 응답에서 곡 단위 요약값으로 집계합니다.

## 추가 리서치 메모

High☆Cheers 공개 자료에서 곡 목록은 장르명, 곡명, 아티스트, 캐릭터, BPM, L/N/H/EX 레벨을 함께 다룹니다. 따라서 장기적으로 곡 메타데이터에는 `artistName`, `characterName`, `bpm`, `releaseDate`, `eventName`을 추가할 가능성이 높습니다.

자세한 요구사항은 [서비스와 게임 리서치](planning/service-research.md)를 참고합니다.
