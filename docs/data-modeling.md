# 데이터 모델링

이 문서는 DB DDL보다 한 단계 위에서, 도메인별 데이터 책임과 변경 이유를 설명합니다. 최종 컬럼과 인덱스는 [MVP DB 설계 초안](mvp-db-design.md)을 기준으로 하고, 이 문서는 모델링 의도와 정책을 이해하는 용도로 사용합니다.

<div class="doc-summary">
  <div class="doc-summary__item">
    <strong>읽는 목적</strong>
    <p>왜 song/chart를 분리하고, 왜 playdata를 current state와 history로 나누는지 이해합니다.</p>
  </div>
  <div class="doc-summary__item">
    <strong>확정 방향</strong>
    <p>users + user_profiles 2테이블, song_search_tags, version/all-time score 분리, S3 jacket key 재생성 정책입니다.</p>
  </div>
  <div class="doc-summary__item">
    <strong>세부 DDL</strong>
    <p>실제 타입, 제약, 인덱스, DDL 초안은 DB 설계 문서에서 관리합니다.</p>
  </div>
</div>

## 가장 크게 바뀌는 영역

- High☆Cheers 기준 게임 시스템 반영
- 팝클 계산식
- 플레이데이터 관리 방식
- 유저 비밀번호 저장 및 이메일 기반 복구 방식
- `chart`와 `song` 메타데이터 분리
- songhash 후보 검토
- 랭크, 메달, 난이도 상수의 버전별 정책화

## 현재 모델의 문제

현재 `chart` 테이블은 곡 메타데이터와 채보 메타데이터를 함께 가지고 있습니다.

| 컬럼 | 성격 |
| --- | --- |
| `song_hash` | 곡 식별자 |
| `genre_name` | 곡 메타데이터 |
| `song_name` | 곡 메타데이터 |
| `song_version` | 원곡 또는 곡 그룹의 최초 수록 버전 |
| `chart_version` | 난이도별 채보 또는 Upper 채보가 실제로 등장한 버전 |
| `difficulty` | 채보 메타데이터 |
| `level` | 채보 메타데이터 |
| `jacket` | 표시 메타데이터 |
| `is_upper` | 채보/표시 메타데이터 |

High☆Cheers에서 장르명 표기가 부활했고 랭크 체계가 변경되었으므로, 표시 정책을 기존 정수 코드에 묶어두면 다음 버전 변경 때 다시 크게 흔들릴 수 있습니다.

## 제안 스키마 초안

### users / user_profiles

유저 데이터는 2개 테이블로 분리합니다.

| 테이블 | 책임 |
| --- | --- |
| `users` | 계정, 인증, 권한. `poptomo_id`, `password_hash`, `email`, `role` 중심 |
| `user_profiles` | 공개 프로필, 랭킹 표시 캐시, credit. 화면에 자주 노출되는 유저 상태 중심 |

3테이블 구조(`users`, `user_profiles`, `user_game_stats`)는 책임이 가장 선명하지만, popn.gg에서는 프로필과 랭킹 표시 값이 대부분 함께 조회됩니다. 따라서 MVP에서는 `user_profiles`에 공개 프로필과 게임 표시 캐시를 함께 두고, 인증 정보만 `users`로 분리합니다.

유저 단위 팝클래스는 `user_profiles`에서 3개 값으로 분리합니다.

| 컬럼 | 설명 |
| --- | --- |
| `display_popclass` | 현재 표기용 팝클래스. MVP에서는 현재 버전 `version_score` 기준 |
| `potential_popclass` | 최고기록 기준으로 산출된 포텐셜 팝클래스. `all_time_score` 기준 |
| `legacy_popclass` | 28버전 이전 기준 팝클래스. 기존 DB 값 보존 |

`display_popclass`는 서비스 기본 랭킹과 유저 프로필에서 우선 보여줄 값입니다. `potential_popclass`는 역대 최고 기록 기준 실력 지표이고, `legacy_popclass`는 High☆Cheers 이전 기록 비교와 마이그레이션 검증을 위해 보존합니다.

`character_name`은 갱신 때 함께 바뀔 수 있지만, 랭킹/프로필에 표시되는 공개 정보이므로 `user_profiles.character_name`에 둡니다. credit 역시 갱신 시 바뀌지만 프로필과 랭킹 주변 화면에서 함께 표시될 가능성이 높으므로 MVP에서는 `user_profiles`에 둡니다.

High☆Cheers 기준 credit은 다음 4종으로 저장합니다.

| 컬럼 | 게임 표시 |
| --- | --- |
| `normal_credit` | `NORMAL` |
| `extra_credit` | `EXTRA` |
| `time_play_10_credit` | `TIME PLAY(10分)` |
| `time_play_16_credit` | `TIME PLAY(16分)` |

기존 `normal_credit`, `battle_credit`, `local_credit`은 High☆Cheers 기준 신규 credit 체계로 이어받지 않고 0으로 초기화합니다. 새 버전에서 크롤링/갱신한 값만 신규 4종 credit에 반영합니다.

계산 시점:

- 마이그레이션 시 기존 playdata를 `all_time_score`로 적재한 뒤 `potential_popclass`를 반드시 계산합니다.
- 갱신 데이터가 들어와 `all_time_score`가 변경되면 `potential_popclass`도 반드시 재계산합니다.
- 갱신 데이터가 현재 버전 `version_score`를 변경하면 `display_popclass`를 재계산합니다.

### song

곡 단위로 변하지 않는 정보를 둡니다.

| 컬럼 | 설명 |
| --- | --- |
| `song_id` | 내부 PK |
| `song_hash` | 외부/API 식별자 |
| `genre_name` | 장르명 |
| `song_name` | 곡명 |
| `artist_name` | 작곡가/아티스트 |
| `version` | 원곡 또는 곡 그룹의 최초 수록 버전 |
| `jacket_url` | 자켓 경로 또는 URL |
| `created_at` | 생성일 |
| `updated_at` | 수정일 |

### song_search_tag

곡 검색에 사용하는 태그/별칭을 둡니다.

예를 들어 원곡명이 `moonchild`라면 사용자는 `문차일드`로 검색할 수 있습니다. 이런 한국어 별칭, 로마자 별칭, 줄임말, 비공식 검색어를 `songs` 본문 컬럼에 섞지 않고 별도 tag로 관리합니다.

| 컬럼 | 설명 |
| --- | --- |
| `tag_id` | 내부 PK |
| `song_id` | 대상 곡 id |
| `tag_value` | 사용자가 입력할 수 있는 검색어. 예: `문차일드` |
| `normalized_tag_value` | 정규화된 검색어. 소문자화, 공백 제거 등 |
| `tag_type` | `KOREAN_ALIAS`, `ROMANIZED`, `ABBREVIATION`, `COMMUNITY`, `ADMIN` 등 |
| `source` | `ADMIN`, `MIGRATION`, `USER_SUGGESTION` 등 |
| `is_active` | 검색 반영 여부 |
| `created_at` | 생성일 |
| `updated_at` | 수정일 |

정책:

- 검색 tag는 곡의 공식 제목을 대체하지 않습니다. 표시명은 항상 `songs.song_name`을 우선합니다.
- tag는 검색 후보를 늘리기 위한 alias/read model 입력입니다.
- MVP에서는 관리자 또는 migration seed로만 tag를 넣고, 유저 기여/승인 플로우는 추후 기능으로 둡니다.
- Redis 검색 read model은 `songs`, `charts`, `song_search_tags`를 기반으로 생성합니다.
- tag 삭제는 hard delete보다 `is_active = false`를 우선 검토합니다.

### chart

난이도별 채보 정보를 둡니다.

| 컬럼 | 설명 |
| --- | --- |
| `chart_id` | 내부 PK |
| `song_id` | 애플리케이션 참조용 song id |
| `difficulty_code` | 내부 난이도 코드 |
| `level` | 레벨 |
| `chart_version` | 해당 채보가 등장한 게임 버전. 같은 곡이라도 Upper가 나중 버전에 추가될 수 있으므로 `songs.version`과 분리 |
| `is_upper` | 어퍼 여부. 표시 딱지는 제거하되 데이터 보존 여부 검토 |
| `has_strict_judgement` | 짠판정 여부 |
| `has_strict_gauge` | 짠게이지 여부 |
| `is_deleted` | 삭제 여부 |
| `created_at` | 생성일 |
| `updated_at` | 수정일 |

짠게이지는 chart metadata로 관리합니다. 노트 수가 1536개를 넘는 채보에서 적용되므로, 같은 곡이라도 `EX` 같은 높은 난이도만 짠게이지가 될 수 있기 때문입니다. 곡 목록 API에서 곡 단위 표시가 필요하면 `charts`를 집계해 `hasAnyStrictGauge`, `strictGaugeDifficulties` 같은 응답 필드를 만들 수 있습니다.

Upper 역시 chart metadata로 관리합니다. 같은 song이라도 Upper 채보가 원곡보다 늦은 버전에 추가될 수 있으므로, 신곡/구곡 판정과 버전 필터는 `songs.version`이 아니라 `charts.chart_version`을 우선 사용합니다.

### playdata

유저별 chart의 현재 플레이 상태를 둡니다.

High☆Cheers에서 처음으로 점수 초기화가 확인되었고, 이후 다른 버전에서도 같은 정책이 나올 수 있습니다. 점수는 버전마다 초기화되지만 메달은 유지되므로, `playdata`는 유저별 chart당 1 row만 두고 현재 버전 점수, 역대 최고 점수, 유지 메달을 함께 저장합니다.

| 컬럼 | 설명 |
| --- | --- |
| `playdata_id` | 내부 PK |
| `user_id` | 유저 id |
| `chart_id` | 채보 id |
| `current_version` | 현재 버전 점수의 대상 게임 버전 |
| `version_score` | 현재 버전 최고 점수. 버전 전환 시 0점부터 시작 |
| `version_rank_code` | 현재 버전 점수에 대응하는 랭크 |
| `all_time_score` | 역대 최고 점수 |
| `all_time_score_version` | 역대 최고 점수가 나온 게임 버전 |
| `all_time_rank_code` | 역대 최고 점수에 대응하는 랭크 |
| `medal_code` | 버전이 바뀌어도 유지되는 현재 클리어 메달 |
| `popclass` | 현재 버전 점수 기준 계산 팝클 |
| `is_display_popclass_target` | 현재 표기 팝클 산정 대상 여부 |
| `popclass_bucket` | `CURRENT_VERSION`, `OLD_VERSION` |
| `popclass_bucket_rank` | bucket 안에서의 순위 |
| `updated_at` | 최종 갱신일 |

`rank_code`는 `score`에서 계산하지 않습니다. clear 여부에 따라 랭크가 달라질 수 있으므로, 갱신 원천 데이터에서 랭크를 함께 수집해서 저장합니다.

### 플레이데이터 버전 정책

| 정책 | 내용 |
| --- | --- |
| 버전 전환 정책 | `game_version_transitions.score_policy`로 `RESET` 또는 `CARRY_OVER`를 선언합니다. |
| 점수 초기화 | `RESET`이면 신규 버전의 `version_score`를 0 또는 관측 점수로 시작합니다. |
| 점수 승계 | `CARRY_OVER`이면 이전 버전의 `version_score`를 신규 버전 시작 점수로 유지합니다. |
| 현재 버전 베스트 | `current_version`, `version_score`, `version_rank_code`로 저장 |
| 역대 베스트 | `all_time_score`, `all_time_score_version`, `all_time_rank_code`로 저장 |
| 기존 DB 마이그레이션 | 기존 `playdata` 점수는 28버전 기록으로 보고 `current_version = 28`, `version_score = 기존 score`, `all_time_score = 기존 score`로 저장 |
| 크롤링 점수 | 크롤링된 점수는 무조건 현재 서버 게임 버전의 `version_score` 후보로 처리 |
| 메달 유지 | `medal_code`는 버전이 바뀌어도 유지되는 상태값으로 저장 |
| 팝클 계산 | 유저 팝클은 현재 버전 `version_score`만 기준으로 계산 |

업데이트 규칙:

- `playdata`는 `user_id + chart_id`로 조회하고, 없으면 생성합니다.
- 현재 서버 게임 버전과 `current_version`이 다르면 `game_version_transitions` 정책을 먼저 조회합니다.
- `RESET` 전환이면 `current_version`을 바꾸고 `version_score`를 0 또는 관측 점수로 초기화합니다.
- `CARRY_OVER` 전환이면 `current_version`을 바꾸되 기존 `version_score`를 유지합니다.
- 현재 버전 점수가 기존 `version_score`보다 높으면 `version_score`를 갱신합니다.
- 현재 버전 점수가 기존 `all_time_score`보다 높으면 `all_time_score`도 함께 갱신합니다.
- 관측된 메달이 기존 `medal_code`와 다르면 점수 상승이 없어도 `medal_code`를 갱신합니다.
- `all_time_score`가 갱신된 경우 `user_profiles.potential_popclass`를 재계산합니다.
- 현재 버전 `version_score`가 갱신된 경우 `user_profiles.display_popclass`를 재계산합니다.
- 현재 버전 `version_score`가 갱신된 경우 서버는 `charts.chart_version` 기준으로 이번 버전 채보 상위 20개, 구버전 채보 상위 40개를 다시 선정해 `is_display_popclass_target`, `popclass_bucket`, `popclass_bucket_rank`를 갱신합니다.
- `popclass_bucket`은 크롤러가 보내지 않습니다. 서버가 유저의 전체 playdata를 기준으로 계산합니다.

`playdata_history`는 기록 갱신, 메달 변경, 버전 초기화/승계 같은 의미 있는 변화가 있을 때만 append합니다. 모든 크롤링 snapshot은 저장하지 않습니다.

버전 전환은 운영 실수의 영향이 크므로, 전환 정책이 없는데 서버 현재 버전이 올라간 상태라면 갱신 API는 조용히 임의 처리하지 않습니다. 관리자에게 `RESET` 또는 `CARRY_OVER` 정책 등록이 필요하다는 오류를 남기고, 운영 알림으로 드러나게 합니다.

## 버전별 게임 코드/표시 정책

이 문서에서 말하는 “상수”는 수학 상수 같은 값이 아니라, 게임에서 정해진 코드표와 표시 규칙을 뜻합니다. 예를 들면 랭크 코드 `1`을 `S+`로 보여줄지, 난이도 코드 `1`을 `LIGHT`로 보여줄지, 메달 코드를 어떤 순서로 정렬할지가 여기에 해당합니다.

High☆Cheers에서 랭크와 난이도 표시가 변경되었습니다. MVP에서는 이런 값을 DB 테이블로 관리하기보다 애플리케이션 코드의 enum/policy object로 먼저 관리하고, 운영 중 자주 바뀌거나 관리자 화면에서 수정해야 할 필요가 생기면 DB 테이블과 관리 UI로 승격합니다.

### rank_policy

이 테이블은 랭크 계산용이 아니라 표시/정렬/검증용입니다.

| 컬럼 | 설명 |
| --- | --- |
| `rank_code` | 내부 코드 |
| `version_from` | 적용 시작 버전 |
| `version_to` | 적용 종료 버전. 현재 버전이면 null |
| `label` | 표시명. 예: `S+`, `AA+` |
| `sort_order` | 정렬 순서 |
| `reference_min_score` | 참고용 최소 점수 |
| `reference_max_score` | 참고용 최대 점수 |
| `requires_clear_for_reference` | 참고 점수 구간이 클리어 조건을 전제로 하는지 |

High☆Cheers 참고 구간:

| 랭크 | 참고 점수 구간 | 비고 |
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

### difficulty_policy

| 컬럼 | 설명 |
| --- | --- |
| `difficulty_code` | 내부 코드 |
| `version_from` | 적용 시작 버전 |
| `version_to` | 적용 종료 버전 |
| `label` | 표시명. 예: `LIGHT`, `NORMAL`, `HYPER`, `EX` |
| `short_label` | 짧은 표시명. 예: `L`, `N`, `H`, `EX` |
| `sort_order` | 정렬 순서 |

기존 `EASY`는 High☆Cheers 기준 표시에서 `LIGHT`로 보일 수 있도록 정책으로 관리합니다.

### medal_policy

| 컬럼 | 설명 |
| --- | --- |
| `medal_code` | 내부 코드 |
| `version_from` | 적용 시작 버전 |
| `version_to` | 적용 종료 버전 |
| `label` | 표시명 |
| `short_label` | 짧은 표시명 |
| `sort_order` | 정렬 순서 |

신규 메달 `어시이지`를 추가합니다.

## LONG POP ON/OFF와 팝클 검증

LONG POP OFF 여부는 클리어 메달로 파악할 수 있습니다. 예를 들어 LONG POP OFF 플레이는 어시스트 클리어 계열 메달로 남을 수 있습니다.

다음 사례는 실험으로 확인되었습니다.

```text
1. 95,000점 LONG POP OFF
2. 이후 90,000점 LONG POP ON
```

이 경우 점수는 `95,000`으로 유지되고, 최종 클리어 메달은 LONG POP ON 기준으로 바뀔 수 있습니다. 즉 `playdata.score`와 `playdata.medal_code`는 항상 같은 플레이의 결과로 함께 바뀐다고 가정하면 안 됩니다.

정책 초안:

- MVP에서는 크롤링 원천에 표시되는 현재 버전 `score`, `rank_code`, `medal_code`를 그대로 저장합니다.
- 팝클은 현재 버전 `version_score`, `medal_code`, chart level로 계산합니다.
- LONG POP ON/OFF 관련 원천값이 별도로 수집 가능하면 `playdata_history`에 raw value를 남기는 방안을 검토합니다.
- 검증 완료 전에는 서버가 LONG POP ON/OFF 상태를 추론해 score나 medal을 수정하지 않습니다.
- 다만 popclass가 “유지된 최고 score + 변경된 medal” 조합에 어떻게 반응하는지는 추가 실험으로 확정합니다.

## FK 제거 정책

DB FK는 제거하되, 애플리케이션에서 다음을 보장합니다.

- `playdata.user_id`가 존재하는 유저를 가리키는지 저장 전에 검증
- `playdata.chart_id`가 존재하는 채보를 가리키는지 저장 전에 검증
- 삭제는 hard delete보다 `is_deleted`를 우선 사용
- 정합성 점검 배치 또는 관리용 쿼리를 별도 운영

## songhash 후보

기존에는 장르명과 제목이 불변이라고 가정했지만, High☆Cheers 이후에는 장르명/제목/작곡가 같은 표시 메타데이터가 바뀔 수 있습니다. 특히 장르명이 없던 곡은 `genreName`에 제목과 같은 문자열을 넣어왔으므로, `genreName == songName`을 안정적인 식별 근거로 보면 안 됩니다.

기존 songhash 정책이 장르명이나 제목에 의존한다면 곡 메타데이터 보정 때 songhash가 바뀔 수 있습니다. 따라서 신규 설계에서는 내부 참조를 `song_id`, `chart_id` 기준으로 두고, `song_hash`는 외부 조회 alias로 제한하는 방향을 우선합니다.

| 옵션 | 구성 | 장점 | 리스크 |
| --- | --- | --- | --- |
| Option 1 | 곡명 + 작곡가 + Upper | 장르명 변경에 강함 | 동명/동작곡가 곡 충돌 가능 |
| Option 2 | 장르명 + 곡명 + 작곡가 + Upper | 현재 표시 정보 반영 | 장르명 추가/변경 시 hash 변경 |
| Option 3 | 장르명 + 곡명 + 작곡가 + Upper 정책 + 곡 버전 | 충돌 가능성 낮음 | 버전 정정 시 hash 변경 |

## 권장 검증 쿼리

마이그레이션 전 실제 데이터로 후보별 중복을 확인합니다.

```sql
-- Option 1 중복 확인
SELECT song_name, artist_name, is_upper, COUNT(*) AS cnt
FROM source_chart
GROUP BY song_name, artist_name, is_upper
HAVING COUNT(*) > 1;

-- Option 2 중복 확인
SELECT genre_name, song_name, artist_name, is_upper, COUNT(*) AS cnt
FROM source_chart
GROUP BY genre_name, song_name, artist_name, is_upper
HAVING COUNT(*) > 1;

-- Option 3 중복 확인
SELECT genre_name, song_name, artist_name, is_upper, version, COUNT(*) AS cnt
FROM source_chart
GROUP BY genre_name, song_name, artist_name, is_upper, version
HAVING COUNT(*) > 1;
```

Upper를 같은 song의 chart 속성으로 둘 경우에는 `is_upper`와 `chart_version`을 songhash seed에 넣지 않는 방향을 우선 검토합니다. 이 경우 같은 곡의 일반 채보와 Upper 채보는 같은 `song_hash`를 공유하고, 실제 채보 식별은 `chart_id`를 우선 사용합니다.

`song_hash`가 변경될 수 있으므로 `playdata`, `playdata_history`, 이미지, 검색 index, 캐시는 `song_hash`에 직접 종속되지 않게 합니다. 곡 표시 정보 보정은 `song_id` 기준 변경 API로 처리하고, 변경 전후 `song_hash` mapping을 남깁니다.

### song_hash와 자켓 이미지 key

레거시에서는 곡 자켓을 S3에 기존 `songHash` 값을 파일명/key로 저장했습니다. 이번 리팩토링에서는 `song_hash` 생성 방식이 바뀌므로 모든 곡의 `song_hash`가 다시 계산될 예정입니다.

정책:

- DB의 원본 참조는 `song_id`를 기준으로 합니다.
- 외부 호환 또는 정적 이미지 key가 필요하면 신규 `song_hash` 기반 key를 새로 생성합니다.
- S3 object를 rename하려고 하지 않습니다. S3 rename은 실제 rename이 아니라 copy/delete에 가까우므로, 기존 object를 보존한 채 신규 key로 copy 또는 upload합니다.
- 마이그레이션에서는 기존 `oldSongHash` key의 자켓을 읽어 신규 `newSongHash` key로 새 object를 생성하고, `songs.jacket_url` 또는 `jacket_key`를 신규 key로 갱신합니다.
- 추후 관리자 API로 `song_hash`가 바뀌는 곡도 같은 방식으로 신규 key에 자켓을 새로 저장하고 DB 참조를 전환합니다.
- 기존 key는 즉시 삭제하지 않고 검증/롤백 기간 이후 정리합니다.

예시:

```text
legacy key: jackets/{oldSongHash}.png
new key:    jackets/{newSongHash}.png
```

## 인덱스 초안

| 테이블 | 인덱스 | 목적 |
| --- | --- | --- |
| `users` | unique `poptomo_id` | 로그인, 프로필/갱신 대상 조회 |
| `users` | unique `email` | 비밀번호 복구 대상 조회 |
| `user_profiles` | `display_popclass` | 현재 표기 기준 유저 랭킹 |
| `user_profiles` | `potential_popclass` | 최고 기록 기준 포텐셜 랭킹 |
| `user_profiles` | `is_hidden`, `display_popclass` | 비공개 유저 제외 랭킹 |
| `song` | `song_hash` 후보 unique | API 식별자 조회. seed 정책 확정과 backfill 이후 hard unique 적용 |
| `song` | `genre_name`, `song_name` | 검색 |
| `song` | `version` | 원곡 수록 버전 필터 |
| `song_search_tag` | `normalized_tag_value`, `is_active` | 태그/별칭 검색 |
| `song_search_tag` | unique `song_id`, `normalized_tag_value`, `tag_type` | 같은 곡의 중복 태그 방지 |
| `chart` | unique `song_id`, `difficulty_code`, `is_upper` | 곡별 일반/Upper 난이도 단일화 |
| `chart` | `difficulty_code`, `level` | 레벨/난이도 검색 |
| `chart` | `chart_version`, `is_upper` | 채보 출시 버전과 Upper 필터 |
| `playdata` | unique `user_id`, `chart_id` | 유저별 채보 current state 단일화 |
| `playdata` | `chart_id`, `current_version`, `version_score` | 곡별 현재 버전 랭킹 |
| `playdata` | `chart_id`, `all_time_score` | 곡별 역대 랭킹 |
| `playdata` | `user_id`, `current_version`, `popclass` | 현재 버전 유저 팝클 |

## 비밀번호 전환 정책

기존 `user.password` 저장값이 평문인지, legacy hash인지, 외부 secret이 섞인 값인지 아직 확정되지 않았습니다. 따라서 현재 문서에서는 특정 salt 조합이나 일괄 재해싱 수식을 확정하지 않습니다.

검토 후보:

| 후보 | 방식 | 필요한 확인 |
| --- | --- | --- |
| A | 기존 로그인 검증 로직으로 성공한 시점에 신규 `PasswordEncoder` hash로 점진 업그레이드 | legacy 검증 로직을 안전하게 재현할 수 있는지 |
| B | 사용자가 입력한 원문 비밀번호를 legacy hash 함수로 먼저 검증하고, 성공 시 신규 hash 저장 | legacy hash 함수와 secret/salt 정책 |
| C | 안전한 검증 재현이 어렵다면 비밀번호 재설정 플로우로 전환 | 이메일/복구 수단과 사용자 안내 정책 |

주의:

- 저장된 legacy hash만 다시 hash하면 사용자가 입력한 원문 비밀번호와 비교 가능한 값이 된다고 가정하지 않습니다.
- bcrypt/argon2 계열은 자체 salt를 포함하므로, 별도 player salt가 필요한지 먼저 검증합니다.
- 마이그레이션 후에는 `loginWithoutHash` 같은 우회 로그인 경로를 제거해야 합니다.

## 비밀번호 찾기

비밀번호 찾기는 이메일 기반 복구로 진행합니다.

필요 컬럼/테이블:

- `users.email`
- `users.email_verified_at`
- `password_reset_tokens`

`password_reset_tokens`는 로그인 전 비밀번호 재설정 권한을 검증하기 위한 일회용 토큰 저장소입니다. 서버는 이메일 링크에 담을 원문 token을 생성하지만 DB에는 원문을 저장하지 않고 hash만 저장합니다.

토큰 정책:

- 원문 토큰은 DB에 저장하지 않습니다.
- `sha256(token)`만 저장합니다.
- 토큰은 짧은 TTL과 1회 사용을 전제로 합니다.
- 이메일 존재 여부는 API 응답에서 노출하지 않습니다.
