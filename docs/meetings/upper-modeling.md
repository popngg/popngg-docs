# Upper 모델링

## 배경

같은 곡이라도 Upper 채보가 원곡과 다른 버전에 추가될 수 있습니다.

예를 들어 일반 채보는 이전 버전에 수록되었지만, Upper 채보는 High☆Cheers에서 새로 추가될 수 있습니다. 이 경우 단순히 `songs.version`만 보면 팝클래스의 이번 버전곡/구곡 분류, 버전별 필터, 최신 채보 목록이 틀릴 수 있습니다.

현재 문서 초안은 다음 방향입니다.

- `songs.version`: 원곡 또는 곡 그룹의 최초 수록 버전
- `charts.chart_version`: 해당 난이도 채보 또는 Upper 채보가 실제로 등장한 버전
- `charts.is_upper`: Upper 채보 여부
- 팝클래스 bucket은 `charts.chart_version` 기준으로 계산

하지만 Upper를 아예 별도 `song`으로 취급하는 방법도 가능하므로, 아래 기준으로 회의가 필요합니다.

## 선택지

### Option A. Upper를 같은 song의 chart로 둔다

```text
song:  A곡
chart: A곡 NORMAL
chart: A곡 HYPER
chart: A곡 EX
chart: A곡 Upper EX
```

장점:

- 곡명 검색 시 일반 채보와 Upper 채보를 한 곡 상세에서 함께 보여주기 쉽습니다.
- 자켓, 아티스트, 장르명, 캐릭터 같은 공통 메타데이터 중복이 줄어듭니다.
- 플레이데이터는 어차피 `chart_id` 기준이므로 점수/랭크/메달 분리는 자연스럽습니다.
- `charts.chart_version`으로 Upper 등장 버전을 따로 관리할 수 있습니다.
- “이 곡의 모든 채보” 화면을 만들기 쉽습니다.

단점:

- Upper가 사실상 별도 곡처럼 취급되는 경우에는 song 상세 화면이 복잡해질 수 있습니다.
- 일반 채보와 Upper 채보의 장르명, 자켓, 아티스트, BPM 등이 달라지는 사례가 있으면 예외 처리가 필요합니다.
- `song_hash + difficulty`만으로 chart를 찾을 수 없고, `is_upper` 또는 `chart_id`가 필요합니다.

적합한 경우:

- Upper가 “같은 곡의 추가 채보”에 가깝다.
- 검색 결과에서 일반/Upper를 한 곡으로 묶어 보여주는 것이 자연스럽다.
- 곡 단위 상세 페이지에서 모든 채보를 보여주고 싶다.

### Option B. Upper를 별도 song으로 둔다

```text
song:  A곡
chart: A곡 NORMAL
chart: A곡 HYPER
chart: A곡 EX

song:  A곡 Upper
chart: A곡 Upper EX
```

장점:

- Upper의 출시 버전, 자켓, 장르명, BPM, 캐릭터가 다를 때 모델이 단순합니다.
- 버전별 곡 목록과 최신 추가곡 목록을 `songs.version`만으로 만들기 쉽습니다.
- song 단위 URL, songhash, 검색 결과가 게임 내 표기와 더 비슷해질 수 있습니다.

단점:

- 같은 곡이 검색 결과에 여러 개로 보일 수 있습니다.
- 일반 곡과 Upper 곡을 묶어 보여주려면 `song_group_id` 또는 `parent_song_id` 같은 추가 모델이 필요합니다.
- 공통 메타데이터가 중복될 수 있습니다.
- 유저가 곡 상세에서 일반/Upper를 함께 보고 싶을 때 join/aggregation 로직이 더 필요합니다.

적합한 경우:

- 게임 내에서 Upper가 별도 곡처럼 강하게 노출된다.
- Upper의 장르명, 자켓, 아티스트, BPM, 캐릭터가 일반 곡과 달라지는 사례가 많다.
- 최신곡/버전별 곡 목록에서 Upper를 독립 항목으로 보여주는 것이 더 중요하다.

### Option C. song_group을 추가한다

```text
song_group: A곡 묶음
song:       A곡
song:       A곡 Upper
chart:      A곡 EX
chart:      A곡 Upper EX
```

장점:

- Upper를 별도 song으로 두면서도 검색/상세 화면에서 묶을 수 있습니다.
- 곡 단위와 곡 묶음 단위를 모두 표현할 수 있어 장기적으로 가장 유연합니다.
- 자켓/장르명/BPM이 다른 Upper도 자연스럽게 처리할 수 있습니다.

단점:

- MVP에는 테이블과 API가 과해질 수 있습니다.
- 마이그레이션과 크롤링 매칭 규칙이 복잡해집니다.
- 프론트 화면도 `song`과 `songGroup`을 구분해야 합니다.

적합한 경우:

- 실제 데이터 검증에서 Upper가 별도 곡처럼 보이는 사례와 같은 곡처럼 묶어야 하는 사례가 모두 많다.
- 오픈소스 공개 후 장기 유지보수까지 고려해 곡 그룹 모델을 명확히 두고 싶다.

## 현재 권장안

MVP에서는 **Option A. Upper를 같은 song의 chart로 둔다**를 우선 권장합니다.

이유:

- 현재 가장 중요한 단위는 플레이데이터가 붙는 `chart`입니다.
- Upper의 다른 출시 버전은 `charts.chart_version`으로 해결할 수 있습니다.
- 곡 검색, 곡 상세, 유저 플레이데이터 화면에서 일반/Upper를 한 번에 보여주기 쉽습니다.
- 추후 필요하면 `song_group_id` 또는 `parent_song_id`를 추가해 Option C로 확장할 수 있습니다.

단, 실제 크롤링 데이터에서 다음 사례가 많으면 Option B 또는 C를 다시 검토합니다.

- Upper의 자켓이 일반 곡과 다르다.
- Upper의 장르명이 일반 곡과 다르다.
- Upper의 아티스트/BPM/캐릭터가 일반 곡과 다르다.
- 게임 내 검색/목록에서 Upper가 완전히 별도 곡처럼 노출된다.

## 회의에서 결정할 질문

1. 유저 검색 결과에서 일반 곡과 Upper를 한 항목으로 묶어 보여줄 것인가?
2. 곡 상세 페이지에서 일반 채보와 Upper 채보를 함께 보여줄 것인가?
3. 최신곡/버전별 목록에서 Upper를 별도 항목처럼 보여줄 것인가?
4. songhash는 song 단위로 유지할 것인가, Upper까지 포함해 별도 생성할 것인가?
5. MVP에서 `song_group_id` 같은 묶음 모델이 필요한가, 아니면 나중에 추가할 것인가?
