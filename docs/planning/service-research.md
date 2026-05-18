# 서비스와 게임 리서치

이 문서는 `popn.gg` 서비스와 `pop'n music High☆Cheers!!` 자료를 바탕으로, 현재 리팩토링 프로젝트에 필요한 요구사항을 정리합니다.

## 참고 자료

### High☆Cheers 공식/공개 자료

- KONAMI 제품 페이지: <https://www.konami.com/arcadegames/products/am_popn_29/>
- KONAMI 가동 공지: <https://www.konami.com/arcadegames/corporate/ja/topics/2025/1218/>
- 공식 곡 목록: <https://p.eagate.573.jp/game/popn/popn29/music/list.html>
- 상급공략Wiki High☆Cheers 곡 목록: <https://popn.wiki/high_cheers>
- 상급공략Wiki High☆Cheers 신규 요소/레벨 변경: <https://popn.wiki/high_cheers/%E6%96%B0%E8%A6%81%E7%B4%A0%E3%83%BB%E3%83%AC%E3%83%99%E3%83%AB%E5%A4%89%E6%9B%B4>
- RemyWiki AC General Info: <https://remywiki.com/Pop%27n_music_AC_General_Info>
- RG Stats Pop'n Class Points: <https://rgstats.readthedocs.io/en/latest/algorithms/popn-classpoints/>

### popn.gg 서비스 자료

공개 웹 fetch에서는 `popn.gg`가 403으로 응답했습니다. 따라서 현재 서비스 기능은 이전 백엔드 코드는 참고 자료로만 보고, 기존 문서의 API/DB 구조와 공개 자료를 함께 비교해 추정합니다.

## High☆Cheers에서 확인한 게임 변화

### 장르명 부활

KONAMI 공지에 따르면 High☆Cheers에서 곡 장르명 표기가 부활했습니다. 공식 곡 목록과 상급공략Wiki의 곡 표도 `GENRE`, `TITLE`, `ARTIST`, `CHARA`, `BPM`, `L`, `N`, `H`, `EX` 구조로 정리되어 있습니다.

프로젝트 영향:

- `songs.genre_name`은 핵심 표시 필드입니다.
- 기존 데이터에서는 장르명이 없는 판권곡이나 장르명이 추가되지 않았던 곡의 `genreName`에 제목과 동일한 문자열을 넣어왔습니다. 따라서 `genreName == songName`은 “장르와 제목이 실제로 같다”가 아니라 “장르명을 별도로 알 수 없어서 제목으로 대체했다”는 의미일 수 있습니다.
- 이번 리팩토링에서 더 중요하게 봐야 할 점은 장르명과 제목이 더 이상 불변값이 아니라는 점입니다. High☆Cheers 전환이나 이후 데이터 보정으로 `genre_name`, `song_name`, `artist_name`이 바뀔 수 있습니다.
- 기존 songhash가 장르명/제목에 의존했다면 곡 표시 정보 보정 때 songhash도 바뀔 수 있습니다. 따라서 내부 참조는 `song_id`, `chart_id`를 기준으로 하고, `song_hash`는 외부 조회 alias로만 취급하는 방향을 우선합니다.
- 곡 메타데이터 변경 API가 필요합니다. 장르명/제목/작곡가/버전 보정 시 old/new songhash mapping 또는 alias를 남겨 기존 URL과 기록 추적이 끊기지 않게 합니다.
- 검색 필터에 `genreName`을 포함해야 합니다.

### 난이도 표시 변경

High☆Cheers 신규 요소 자료에 따르면 `EASY` 표기가 `LIGHT`로 변경되었습니다. 곡 목록도 `L / N / H / EX` 컬럼을 사용합니다.

프로젝트 영향:

- 내부 `difficulty_code`와 표시 label을 분리합니다.
- 기존 `EASY` 데이터는 High☆Cheers 표시에서 `LIGHT`로 보여야 합니다.
- API는 `difficulty.code`, `difficulty.label`, `difficulty.shortLabel`을 함께 내려줍니다.

### BPM과 캐릭터 정보의 표시 가치 증가

공식/위키 곡 목록은 `BPM`과 `CHARA`를 곡 정보와 함께 제공합니다. KONAMI 공지도 High☆Cheers에서 캐릭터 그래픽 품질 향상을 강조합니다.

프로젝트 영향:

- `songs` 또는 확장 메타데이터에 `bpm_min`, `bpm_max`, `character_name`을 추가할지 검토합니다.
- MVP DDL에는 아직 없지만, 곡 상세/검색 경험을 위해 후속 추가 가능성이 높습니다.
- `character_name`은 유저 프로필의 캐릭터와 구분하기 위해 곡 캐릭터라면 `song_character_name` 또는 `default_character_name`처럼 명확히 이름 붙입니다.

### 이벤트/해금/배포일 정보

상급공략Wiki 곡 목록은 이벤트, 페이즈, 배포일, 해금 조건을 함께 정리합니다.

프로젝트 영향:

- `songs.release_date` 또는 `published_at`이 있으면 최신 차트와 이벤트 페이지 품질이 좋아집니다.
- `songs.event_name`, `songs.unlock_condition`, `songs.source_category` 같은 확장 필드가 필요할 수 있습니다.
- MVP에서는 `created_at`으로 최신 차트를 대체하되, 크롤링 데이터에 배포일이 있으면 별도 컬럼으로 승격하는 것이 좋습니다.

### LONG POP OFF와 어시스트 클리어

High☆Cheers 신규 요소 자료는 LONG POP을 OFF로 플레이하면 클리어 메달이 `アシストクリア`가 된다고 설명합니다.

프로젝트 영향:

- LONG POP OFF 여부는 클리어 메달로 파악할 수 있습니다.
- 신규 메달 `어시이지/アシストクリア`는 단순 label 추가가 아니라 플레이 옵션에 의해 발생하는 clear 상태입니다.
- `medal_code` mapping에서 `assist clear`를 별도 상태로 둬야 합니다.
- 갱신/크롤링 입력은 메달 원천값을 그대로 저장해야 합니다.
- 랭크와 마찬가지로 메달도 서버가 임의로 재계산하지 않는 편이 안전합니다.
- 실험 결과 LONG POP OFF로 `95000`을 기록한 뒤 LONG POP ON으로 `90000`을 기록하면, 점수는 더 높은 `95000`이 유지되고 메달만 LONG POP ON 기준으로 바뀔 수 있습니다.
- 따라서 LONG POP ON/OFF에서는 score와 medal이 항상 같은 플레이의 결과로 묶여 저장된다고 가정하면 안 됩니다.
- popclass가 이 조합에 어떻게 반응하는지는 추가 실험이 필요합니다.

### 버전 베스트와 역대 베스트

High☆Cheers에서 처음으로 기존 점수 초기화가 확인되었고, 앞으로도 버전 변경 시 점수 초기화가 다시 발생할 수 있습니다. 따라서 이번 버전만을 위한 예외 처리 대신, 버전 베스트와 역대 베스트를 함께 저장하는 일반화된 구조가 필요합니다.

프로젝트 영향:

- 기존 DB의 플레이데이터는 28버전에서 나온 기록으로 마이그레이션합니다.
- 새로 크롤링한 score는 항상 현재 버전에서 나온 점수로 저장합니다.
- `playdata`에는 `best_type`, `target_version`, `score_version`을 둬서 현재 버전 베스트와 역대 베스트를 구분합니다.
- 조회 API도 이 구조를 그대로 반영해야 합니다. 현재 버전 비교만 필요한 API는 `VERSION_BEST`를 기본으로 쓰고, 유저 전체 데이터나 차트 상세처럼 두 스코프를 함께 보여줘야 하는 화면은 `VERSION_BEST`와 `ALL_TIME_BEST`를 응답에서 분리해 함께 내려줍니다.
- 팝클은 현재 버전 기준으로 계산하므로, `ALL_TIME_BEST`가 아니라 현재 버전 `VERSION_BEST`가 source of truth입니다.
- 포텐셜 팝클래스는 `ALL_TIME_BEST` 기준으로 별도 계산합니다.
- 마이그레이션 시 기존 기록을 `ALL_TIME_BEST`로 넣은 뒤 포텐셜 팝클래스를 한 번 계산해야 합니다.
- 이후 갱신 데이터가 역대 베스트를 바꾸면 포텐셜 팝클래스도 다시 계산해야 합니다.
- 현재 표기 팝클에 들어가는 이번 버전 채보 20개, 구버전 채보 40개는 서버가 선정하고 `playdata`에 마킹합니다.
- 같은 song이라도 Upper가 나온 버전은 다를 수 있으므로, 신곡/구곡 판정은 `songs.version`이 아니라 `charts.chart_version`을 기준으로 합니다.
- 크롤러는 popclass bucket을 보내지 않고, 서버가 전체 playdata를 기준으로 bucket을 계산합니다.

### 짠판정과 짠게이지

팝픈에는 곡마다 짠판정과 짠게이지가 존재합니다. 이 특성은 난이도별로 달라질 가능성을 배제하지 않는 편이 안전합니다.

프로젝트 영향:

- MVP DB는 `charts.has_strict_judgement`, `charts.has_strict_gauge`를 가집니다.
- 곡 목록에서는 chart들의 값을 집계해 곡 단위 요약으로 보여줄 수 있습니다.
- 검색/필터에서 짠판정/짠게이지 필터가 필요해질 수 있습니다.

### 신규 기체와 플레이 옵션

KONAMI 제품 페이지와 공지는 43인치 120Hz 모니터, 터치패널, 경량 버튼, 헤드폰 단자, `でっかポップ君` 버튼, EXTRA 모드 등을 소개합니다. 상급공략Wiki는 ROOF, JUDGE ADJUST, SLIM, KEY BEAM, LINE 등 신규 옵션도 언급합니다.

프로젝트 영향:

- MVP 플레이데이터에는 옵션 상세를 저장하지 않습니다.
- 다만 장기적으로 플레이 옵션이 결과에 영향을 줄 수 있으므로 `play_options` 확장 테이블 또는 JSON 컬럼 후보를 남깁니다.
- `LONG POP OFF -> assist clear`처럼 결과값에 직접 반영되는 옵션은 medal로 우선 표현합니다.

### 스코어와 랭크

RemyWiki는 pop'n music 점수가 100,000점 만점 체계이고, clear rank가 특정 점수 구간에서 부여된다고 정리합니다. 그러나 이번 프로젝트에서는 clear 여부에 따라 랭크가 달라질 수 있다는 정책을 받아들여, 서버가 score만으로 rank를 계산하지 않습니다.

프로젝트 영향:

- `playdata.rank_code`는 크롤링 원천 데이터에서 받은 값입니다.
- 점수 구간은 검증/표시 참고값입니다.
- API와 DB 문서에서 “rank는 score로 계산하지 않음”을 계속 유지해야 합니다.

### 팝클

RG Stats 문서는 pop'n class point가 개별 chart score/lamp/level에 의해 계산되는 개념이며, 게임 내에서 개별 chart point가 직접 표시되는 것은 아니라고 설명합니다. 기존 백엔드도 level, score, medal 기반으로 chart popclass를 계산하고 상위 50개 평균으로 유저 popclass를 산출했습니다.

프로젝트 영향:

- `playdata.popclass`는 서버 계산값으로 유지합니다.
- 계산식은 별도 정책 문서/테스트로 고정해야 합니다.
- medal mapping이 바뀌면 popclass 계산 결과가 바뀔 수 있으므로 medal code table/constant를 조심히 관리해야 합니다.

## popn.gg 서비스에서 필요한 핵심 화면

이전 백엔드와 기존 API에서 추정되는 서비스 화면은 다음과 같습니다.

| 화면 | 필요한 API/데이터 |
| --- | --- |
| 메인 페이지 | 최신 차트, 주요 랭킹, 공지 후보 |
| 곡 목록 | GroupChart 목록, 검색/필터, 난이도/레벨 |
| 곡 상세 | GroupChart, 특정 채보, 곡별 랭킹, 내 플레이데이터 |
| 유저 프로필 | 유저 정보, 현재 표기 팝클, 포텐셜 팝클, 기존 팝클, 공개 여부 |
| 유저 전체 데이터 | 곡/채보별 score/rank/medal/popclass |
| 팝클표 | 현재 버전 베스트 기준 상위 50개 playdata, 평균 popclass |
| 유저 랭킹 | 기본은 현재 표기 팝클 기준, 필요 시 포텐셜/기존 팝클 기준 목록 |
| 플레이데이터 갱신 | 크롤링 입력, 매칭 결과, 갱신 로그 |
| 관리자 업로드 | 차트 업로드, 자켓 업로드, 데이터 보정 |

## 현재 프로젝트에 추가로 필요한 것

### DB 후보 필드

MVP 이후 추가 가능성이 높은 필드:

| 테이블 | 필드 | 이유 |
| --- | --- | --- |
| `songs` | `bpm_min`, `bpm_max` | 공식/위키 곡 목록에서 BPM이 핵심 표시값 |
| `songs` | `default_character_name` | 곡 목록에 CHARA가 함께 표시됨 |
| `songs` | `release_date` | 최신 차트/이벤트 정렬 품질 개선 |
| `songs` | `event_name` | 이벤트/해금 곡 분류 |
| `songs` | `source_category` | default, event, license, collab 등 분류 |
| `songs` | `source_url` | 크롤링 출처 추적 |
| `charts` | `button_count` | LIGHT에서 사용 버튼 정보가 표시될 수 있음 |
| `charts` | `note_count` | 점수/난이도 분석 확장 |
| `playdata` | `clear_type` | medal과 별도로 clear 계열 분석이 필요해질 경우 |

MVP DDL에 모두 넣지는 않습니다. 다만 `bpm`, `character`, `release_date`는 곡 상세 품질에 직접 영향을 주므로 우선순위를 높게 둡니다.

### API 후보

현재 OpenAPI 초안에 추가했거나 후속 후보로 둘 API:

| API | 필요 이유 |
| --- | --- |
| `GET /constants` | 랭크/메달/난이도 label을 프론트가 일관되게 사용 |
| `GET /playdata/history/{poptomoId}/charts/{chartId}` | 채보별 성장 이력 표시. songhash 변경에 흔들리지 않도록 chartId 사용 |
| `GET /playdata/versus` | 기존 비교 기능 계승 |
| `GET /charts/{chartId}/rankings` | 차트 상세 외에도 곡별 랭킹만 독립 조회할 수 있게 함. version best/all-time best 동시 제공 |
| `GET /users/{poptomoId}/playdata/summary` | 프로필/대시보드에서 version best/all-time best 요약을 한 번에 내려줌 |
| `PATCH /user/email` | 이메일 기반 비밀번호 복구 준비 |
| `GET /admin/migrations/status` | 운영 편의. Jenkins/DB 확인으로 충분하면 제외 가능 |
| `GET /search/charts` | 검색이 복잡해질 때 `/chart/all`에서 분리 |
| `GET /image/jacket/{songId}` | 이미지 프록시가 필요해질 때 후보. 자켓은 songId 기준으로 연결 |
| `PATCH /admin/songs/{songId}` | 장르명, 제목, 작곡가, 버전, 자켓 등 곡 메타데이터 보정 |

### 크롤링/갱신에서 반드시 수집할 값

| 값 | 필요 이유 |
| --- | --- |
| `genreName` | High☆Cheers 장르명 부활 |
| `songName` | 곡 식별과 표시 |
| `artistName` | songhash 안정화와 검색 |
| `version` | 버전 필터와 식별 |
| `chartVersion` | 채보 또는 Upper 채보가 실제로 등장한 버전. 팝클 bucket과 버전 필터에 필요 |
| `isUpper` | 채보/곡 식별 |
| `difficulty` | chart 매칭 |
| `level` | chart metadata와 popclass 계산 |
| `score` | playdata |
| `scoreVersion` | 점수가 나온 게임 버전. 크롤링 점수는 현재 버전 |
| `bestType` | 현재 버전 베스트와 역대 베스트 구분 |
| `rankCode` | 서버 계산 금지, 원천값 저장 |
| `medalCode` | 서버 계산 금지, 원천값 저장 |
| `normalCredit` | `NORMAL` credit |
| `extraCredit` | `EXTRA` credit |
| `timePlay10Credit` | `TIME PLAY(10分)` credit |
| `timePlay16Credit` | `TIME PLAY(16分)` credit |
| `bpm` | 곡 상세/검색 확장 |
| `characterName` | 곡 상세 표시 확장 |
| `releaseDate` | 최신 차트 정확도 향상 |

조회 API 설계 원칙:

- playdata를 보여주는 API는 `VERSION_BEST`와 `ALL_TIME_BEST`를 함께 내려주는 것을 기본으로 합니다.
- 특정 스코프만 필요할 때만 query parameter로 좁힙니다.
- 곡별 랭킹 API도 현재 버전 랭킹과 역대 랭킹을 동시에 보여줄 수 있어야 합니다.

### songhash 재검토 포인트

High☆Cheers에서는 장르명이 새로 생기거나 추후 반영될 수 있습니다. 기존에는 장르명과 제목이 불변이라고 가정했지만, 이제는 장르명/제목/작곡가 같은 표시 메타데이터가 바뀔 수 있다고 봐야 합니다. 따라서 장르명이나 제목을 hash seed에 넣는 후보는 메타데이터 수정 때 songhash가 바뀔 위험을 함께 검토해야 합니다.

권장 방향:

- 내부 PK는 `song_id`를 사용합니다.
- 외부 API 식별자인 `song_hash`는 내부 영속 참조가 아니라 조회 alias로 봅니다.
- `playdata`, `history`, 이미지, 캐시, 검색 index는 `song_hash`가 아니라 `song_id` 또는 `chart_id`에 종속되게 설계합니다.
- `song_hash`가 바뀌면 old/new mapping 또는 alias를 남기고, 캐시와 검색 read model을 재빌드합니다.
- `genreName`은 표시/검색 필드로 중요하지만, hash seed 포함 여부는 실제 중복 검증 후 결정합니다.
- `artistName`을 확보할 수 있다면 `songName + artistName + version + upperGroup` 조합도 후보로 검토합니다.

## 문서/구현 액션 아이템

| 우선순위 | 작업 | 문서 위치 |
| --- | --- | --- |
| 높음 | OpenAPI 초안과 실제 API naming 일치 | `api-design.md`, `openapi.yaml` |
| 높음 | medal code table 확정. 어시스트 클리어 위치 포함 | `game-system.md` |
| 높음 | songhash 후보를 실제 데이터로 중복 검증 | `data-modeling.md` |
| 높음 | 곡 메타데이터 변경 API와 old/new songhash mapping 정책 정리 | `api-design.md`, `migration-plan.md` |
| 높음 | popclass 계산식을 테스트 가능한 정책으로 문서화 | `mvp-db-design.md` |
| 중간 | `songs` 확장 필드 후보 정리 | `mvp-db-design.md` |
| 중간 | 관리자용 데이터 보정 흐름 정리 | `operations.md` |
| 낮음 | 검색 태그/한국어 검색 설계 분리 | 후속 문서 |
