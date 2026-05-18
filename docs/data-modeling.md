# 데이터 모델링

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

### users

유저 단위 팝클래스는 3개 값으로 분리합니다.

| 컬럼 | 설명 |
| --- | --- |
| `display_popclass` | 현재 표기용 팝클래스. MVP에서는 현재 버전 `VERSION_BEST` 기준 |
| `potential_popclass` | 최고기록 기준으로 산출된 포텐셜 팝클래스. `ALL_TIME_BEST` 기준 |
| `legacy_popclass` | 28버전 이전 기준 팝클래스. 기존 DB 값 보존 |

`display_popclass`는 서비스 기본 랭킹과 유저 프로필에서 우선 보여줄 값입니다. `potential_popclass`는 역대 최고 기록 기준 실력 지표이고, `legacy_popclass`는 High☆Cheers 이전 기록 비교와 마이그레이션 검증을 위해 보존합니다.

High☆Cheers 기준 credit은 다음 4종으로 저장합니다.

| 컬럼 | 게임 표시 |
| --- | --- |
| `normal_credit` | `NORMAL` |
| `extra_credit` | `EXTRA` |
| `time_play_10_credit` | `TIME PLAY(10分)` |
| `time_play_16_credit` | `TIME PLAY(16分)` |

기존 `normal_credit`, `battle_credit`, `local_credit`은 High☆Cheers 기준 신규 credit 체계로 이어받지 않고 0으로 초기화합니다. 새 버전에서 크롤링/갱신한 값만 신규 4종 credit에 반영합니다.

계산 시점:

- 마이그레이션 시 기존 playdata를 `ALL_TIME_BEST`로 적재한 뒤 `potential_popclass`를 반드시 계산합니다.
- 갱신 데이터가 들어와 `ALL_TIME_BEST`가 변경되면 `potential_popclass`도 반드시 재계산합니다.
- 갱신 데이터가 현재 버전 `VERSION_BEST`만 변경하면 `display_popclass`를 재계산합니다.

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

유저별 chart 베스트 플레이 상태를 둡니다.

High☆Cheers에서 처음으로 점수 초기화가 확인되었고, 이후 다른 버전에서도 같은 정책이 나올 수 있습니다. 따라서 `playdata`는 이번 버전만 예외적으로 처리하지 않고, 유저별 chart당 하나가 아니라 베스트 스코프별로 row를 저장하는 일반 구조로 설계합니다.

| 컬럼 | 설명 |
| --- | --- |
| `playdata_id` | 내부 PK |
| `user_id` | 유저 id |
| `chart_id` | 채보 id |
| `best_type` | `VERSION_BEST`, `ALL_TIME_BEST` |
| `target_version` | `VERSION_BEST` 대상 게임 버전. `ALL_TIME_BEST`는 `0` |
| `score_version` | 해당 점수가 실제로 나온 게임 버전 |
| `rank_code` | 크롤링된 랭크 코드 |
| `medal_code` | 크롤링된 메달 코드 |
| `score` | 점수 |
| `popclass` | row 기준 계산 팝클 |
| `is_display_popclass_target` | 현재 표기 팝클 산정 대상 여부 |
| `popclass_bucket` | `CURRENT_VERSION`, `OLD_VERSION` |
| `popclass_bucket_rank` | bucket 안에서의 순위 |
| `updated_at` | 최종 갱신일 |

`rank_code`는 `score`에서 계산하지 않습니다. clear 여부에 따라 랭크가 달라질 수 있으므로, 갱신 원천 데이터에서 랭크를 함께 수집해서 저장합니다.

### 플레이데이터 버전 정책

| 정책 | 내용 |
| --- | --- |
| 기존 점수 초기화 | High☆Cheers에서는 기존 점수가 현재 버전 점수로 이어지지 않습니다. |
| 현재 버전 베스트 | `best_type = VERSION_BEST`, `target_version = 현재 버전`, `score_version = 현재 버전` |
| 역대 베스트 | `best_type = ALL_TIME_BEST`, `target_version = 0`, `score_version = 실제 점수가 나온 버전` |
| 기존 DB 마이그레이션 | 기존 `playdata` 점수는 28버전 기록으로 보고 `score_version = 28`로 저장 |
| 크롤링 점수 | 크롤링된 점수는 무조건 현재 버전에서 나온 점수로 저장 |
| 팝클 계산 | 유저 팝클은 현재 버전 `VERSION_BEST`만 기준으로 계산 |

업데이트 규칙:

- 현재 버전 크롤링 점수는 현재 버전 `VERSION_BEST` row에 upsert합니다.
- 현재 버전 점수가 기존 `ALL_TIME_BEST`보다 높으면 `ALL_TIME_BEST`도 함께 갱신합니다.
- 현재 버전 점수가 기존 `ALL_TIME_BEST`보다 낮으면 `ALL_TIME_BEST`는 유지합니다.
- 랭크와 메달은 각 row의 score와 같은 원천에서 수집된 값을 저장합니다.
- `ALL_TIME_BEST`가 갱신된 경우 `users.potential_popclass`를 재계산합니다.
- 현재 버전 `VERSION_BEST`가 갱신된 경우 `users.display_popclass`를 재계산합니다.
- 현재 버전 `VERSION_BEST`가 갱신된 경우 서버는 `charts.chart_version` 기준으로 이번 버전 채보 상위 20개, 구버전 채보 상위 40개를 다시 선정해 `is_display_popclass_target`, `popclass_bucket`, `popclass_bucket_rank`를 갱신합니다.
- `popclass_bucket`은 크롤러가 보내지 않습니다. 서버가 유저의 전체 playdata를 기준으로 계산합니다.

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
- 팝클은 현재 버전 `VERSION_BEST` row의 `score`, `medal_code`, chart level로 계산합니다.
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

## 인덱스 초안

| 테이블 | 인덱스 | 목적 |
| --- | --- | --- |
| `song` | `song_hash` 후보 unique | API 식별자 조회. seed 정책 확정과 backfill 이후 hard unique 적용 |
| `song` | `genre_name`, `song_name` | 검색 |
| `song` | `version` | 원곡 수록 버전 필터 |
| `chart` | unique `song_id`, `difficulty_code`, `is_upper` | 곡별 일반/Upper 난이도 단일화 |
| `chart` | `difficulty_code`, `level` | 레벨/난이도 검색 |
| `chart` | `chart_version`, `is_upper` | 채보 출시 버전과 Upper 필터 |
| `playdata` | unique `user_id`, `chart_id`, `best_type`, `target_version` | 유저별 채보/스코프 베스트 |
| `playdata` | `chart_id`, `best_type`, `target_version`, `score` | 곡별 현재 버전/역대 랭킹 |
| `playdata` | `user_id`, `best_type`, `target_version`, `popclass` | 현재 버전 유저 팝클 |

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
