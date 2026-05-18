# MVP DB 설계 초안

이 문서는 빠른 MVP 출시를 목표로 한 신규 DB 설계 초안입니다. 원칙은 단순합니다.

- 사용자에게 익숙한 공개 화면 흐름은 유지하되, 내부 구조는 새 기준으로 설계합니다.
- `song`과 `chart`는 분리합니다.
- DB foreign key constraint는 만들지 않습니다.
- 대신 id 컬럼, unique key, index, 애플리케이션 검증으로 정합성을 유지합니다.
- 랭크는 점수로 계산하지 않고 크롤링된 값을 저장합니다.
- 확장 기능은 막지 않되, MVP에서 당장 필요하지 않은 테이블은 뒤로 미룹니다.

## MVP 범위

### 포함

- 유저 등록/갱신/로그인
- 이메일 기반 비밀번호 복구
- 곡/채보 조회
- 플레이데이터 갱신
- 유저별 전체 플레이데이터
- 유저 팝클 테이블
- 곡별 랭킹
- 레벨별 랭크/메달 집계
- 갱신 로그
- 플레이데이터 히스토리

### MVP 이후

- 검색 태그 기여
- 한국어 검색 태그 승인 플로우
- 이메일 인증
- 상세 모니터링 테이블
- 관리자 데이터 검수 UI
- 게임 코드/표시 정책 DB 관리 UI

## 테이블 요약

MVP에서는 다음 테이블을 제안합니다.

| 테이블 | 역할 | 레거시 대응 |
| --- | --- | --- |
| `users` | 유저 계정과 프로필 | `"user"` |
| `songs` | 곡 단위 메타데이터 | `chart` 일부 |
| `charts` | 난이도별 채보 메타데이터 | `chart` 일부 |
| `playdata` | 유저별 채보 베스트 플레이데이터. 버전 베스트와 역대 베스트를 구분 | `playdata` |
| `playdata_history` | 플레이데이터 변경 이력 | `history` |
| `renew_logs` | 갱신/등록 로그 | `renew_log` |
| `login_logs` | 로그인 로그 | `login_log` |
| `password_reset_tokens` | 이메일 기반 비밀번호 복구 토큰 | 신규 |

MVP에서는 `rank_policy`, `medal_policy`, `difficulty_policy`를 별도 테이블로 만들지 않고 애플리케이션 코드의 enum/policy object로 둡니다. 여기서 말하는 정책은 랭크/메달/난이도 같은 게임 코드와 화면 표시명을 관리하는 기준입니다. 버전별 정책 변경을 코드로 감당하기 어려워지거나 운영자가 화면에서 수정해야 하는 시점에 테이블로 승격합니다.

## ERD

MVP DB 구조를 읽기 쉽게 그리면 다음과 같습니다.

DB foreign key constraint는 만들지 않지만, 아래 관계는 애플리케이션에서 보장해야 하는 참조 관계입니다.

```mermaid
erDiagram
    USERS {
        bigint user_id PK
        varchar poptomo_id UK
        varchar user_name
        varchar password_hash
        varchar email UK
        datetime email_verified_at
        int display_popclass
        int potential_popclass
        int legacy_popclass
        varchar character_name
        varchar comment
        boolean is_hidden
        int normal_credit
        int extra_credit
        int time_play_10_credit
        int time_play_16_credit
        varchar role
        datetime created_at
        datetime updated_at
    }

    SONGS {
        bigint song_id PK
        char song_hash
        varchar genre_name
        varchar song_name
        varchar artist_name
        int version
        varchar jacket_url
        datetime created_at
        datetime updated_at
    }

    CHARTS {
        bigint chart_id PK
        bigint song_id
        tinyint difficulty_code
        varchar difficulty_label
        tinyint level
        int chart_version
        boolean has_strict_judgement
        boolean has_strict_gauge
        boolean is_upper
        boolean is_deleted
        datetime created_at
        datetime updated_at
    }

    PLAYDATA {
        bigint playdata_id PK
        bigint user_id
        bigint chart_id
        varchar best_type
        int target_version
        int score_version
        int score
        tinyint rank_code
        tinyint medal_code
        int popclass
        boolean is_display_popclass_target
        varchar popclass_bucket
        int popclass_bucket_rank
        datetime last_played_at
        datetime created_at
        datetime updated_at
    }

    PLAYDATA_HISTORY {
        bigint history_id PK
        bigint user_id
        bigint chart_id
        varchar best_type
        int target_version
        int score_version
        int score
        tinyint rank_code
        tinyint medal_code
        int popclass
        varchar event_type
        datetime created_at
    }

    RENEW_LOGS {
        bigint renew_log_id PK
        varchar poptomo_id
        bigint user_id
        varchar status
        varchar mode
        int input_chart_count
        int matched_chart_count
        int updated_playdata_count
        varchar failure_reason
        varchar ip
        datetime created_at
    }

    LOGIN_LOGS {
        bigint login_log_id PK
        varchar poptomo_id
        bigint user_id
        varchar status
        varchar failure_reason
        varchar ip
        datetime created_at
    }

    PASSWORD_RESET_TOKENS {
        bigint reset_token_id PK
        bigint user_id
        char token_hash UK
        varchar email
        datetime expires_at
        datetime used_at
        varchar requested_ip
        datetime created_at
    }

    SONGS ||--o{ CHARTS : "has charts"
    USERS ||--o{ PLAYDATA : "has scoped best playdata"
    CHARTS ||--o{ PLAYDATA : "is played as"
    USERS ||--o{ PLAYDATA_HISTORY : "has history"
    CHARTS ||--o{ PLAYDATA_HISTORY : "records history"
    USERS ||--o{ PASSWORD_RESET_TOKENS : "requests reset"
    USERS ||--o{ RENEW_LOGS : "has renew logs"
    USERS ||--o{ LOGIN_LOGS : "has login logs"
```

### 관계 요약

| 관계 | 의미 | DB FK |
| --- | --- | --- |
| `songs 1:N charts` | 한 곡은 여러 난이도 채보를 가집니다. | 없음 |
| `users 1:N playdata` | 한 유저는 여러 스코프별 베스트 플레이데이터를 가집니다. | 없음 |
| `charts 1:N playdata` | 한 채보는 여러 유저의 플레이데이터를 가집니다. | 없음 |
| `users + charts + best_type + target_version -> playdata unique` | 유저별 채보의 버전 베스트와 역대 베스트는 스코프별로 하나만 존재합니다. | unique key |
| `users 1:N playdata_history` | 유저의 변경 이력을 저장합니다. | 없음 |
| `charts 1:N playdata_history` | 채보별 변경 이력을 추적할 수 있습니다. | 없음 |
| `users 1:N password_reset_tokens` | 이메일 비밀번호 복구 토큰을 저장합니다. | 없음 |
| `users 1:N renew_logs/login_logs` | 갱신/로그인 시도 추적용입니다. | 없음 |

## users

기존 `"user"`는 예약어 회피가 번거로우므로 `users`로 바꿉니다.

| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| `user_id` | BIGINT | PK, auto increment | 내부 id |
| `poptomo_id` | VARCHAR(32) | NOT NULL, UNIQUE | 외부 유저 식별자 |
| `user_name` | VARCHAR(64) | NOT NULL | 유저명 |
| `password_hash` | VARCHAR(255) | NOT NULL | 해싱된 비밀번호 |
| `email` | VARCHAR(255) | NULL, UNIQUE | 비밀번호 복구용 이메일 |
| `email_verified_at` | DATETIME | NULL | 이메일 인증 완료 시각 |
| `display_popclass` | INT | NOT NULL DEFAULT 0 | 현재 서비스 표기용 팝클. 기본은 현재 버전 `VERSION_BEST` 기준 |
| `potential_popclass` | INT | NOT NULL DEFAULT 0 | 최고 기록 기준으로 산출한 포텐셜 팝클래스. `ALL_TIME_BEST` 기준 |
| `legacy_popclass` | INT | NOT NULL DEFAULT 0 | 28버전 이전 기준 팝클. 기존 DB 마이그레이션 값 보존 |
| `character_name` | VARCHAR(128) | NOT NULL DEFAULT '' | 캐릭터 |
| `comment` | VARCHAR(255) | NOT NULL DEFAULT '' | 코멘트 |
| `is_hidden` | BOOLEAN | NOT NULL DEFAULT FALSE | 비공개 여부 |
| `normal_credit` | INT | NOT NULL DEFAULT 0 | `NORMAL` credit |
| `extra_credit` | INT | NOT NULL DEFAULT 0 | `EXTRA` credit |
| `time_play_10_credit` | INT | NOT NULL DEFAULT 0 | `TIME PLAY(10분)` credit |
| `time_play_16_credit` | INT | NOT NULL DEFAULT 0 | `TIME PLAY(16분)` credit |
| `role` | VARCHAR(20) | NOT NULL DEFAULT 'USER' | `USER`, `ADMIN`, `BOT` |
| `created_at` | DATETIME | NOT NULL | 생성일 |
| `updated_at` | DATETIME | NOT NULL | 수정일 |

### 인덱스

| 인덱스 | 목적 |
| --- | --- |
| unique `poptomo_id` | 로그인/프로필/갱신 조회 |
| unique `email` | 비밀번호 복구 대상 조회 |
| `display_popclass desc` | 현재 표기 기준 유저 랭킹 |
| `potential_popclass desc` | 최고 기록 기준 포텐셜 랭킹 |
| `legacy_popclass desc` | 28버전 이전 기준 보존/비교 |
| `role`, `display_popclass desc` | BOT 제외 현재 랭킹 |

### 팝클래스 정책

`users`는 화면과 랭킹에서 자주 쓰는 유저 단위 팝클 값을 캐시합니다. High☆Cheers부터 점수와 팝클 기준이 버전별로 갈라지므로 단일 `popclass` 컬럼으로는 부족합니다.

| 컬럼 | 계산 기준 | 용도 |
| --- | --- | --- |
| `display_popclass` | 현재 서비스가 표기하는 기준. MVP에서는 현재 버전 `VERSION_BEST` 상위 50개 | 유저 프로필, 기본 랭킹 |
| `potential_popclass` | 최고 기록 기준. `ALL_TIME_BEST` 상위 50개 | 포텐셜 팝클래스, 장기 실력 지표 |
| `legacy_popclass` | 28버전 이전 기존 기준 | 마이그레이션 값 보존, 이전 시즌 비교 |

갱신 정책:

- 현재 버전 score 갱신 후 `display_popclass`를 재계산합니다.
- `ALL_TIME_BEST`가 갱신되면 `potential_popclass`도 반드시 재계산합니다.
- 기존 DB 마이그레이션 시 기존 `users.popclass`는 `legacy_popclass`에 보존합니다.
- 마이그레이션 시 기존 playdata를 `ALL_TIME_BEST(score_version = 28)`로 넣은 뒤, 초기 `potential_popclass`를 반드시 한 번 계산해 채웁니다.
- 마이그레이션 중 계산식 검증이 끝나지 않았다면 기존 `users.popclass`를 임시 복사할 수 있지만, 전환 완료 전 재계산 결과로 덮어써야 합니다.

### 이메일 정책

- 이메일은 MVP에서 비밀번호 복구용으로 사용합니다.
- 기존 유저 중 이메일이 없는 유저는 로그인 후 이메일 등록을 유도합니다.
- 이메일 인증 전에도 저장은 가능하지만, 비밀번호 복구 메일 발송을 `email_verified_at`이 있는 계정으로 제한할지는 회의에서 확정합니다.
- 보수적인 기본 후보는 인증된 이메일만 복구에 사용하는 것입니다.
- MVP 1차에서 인증 플로우를 늦춘다면, 이메일 등록 즉시 복구를 허용하는 대신 rate limit, 감사 로그, 안내 문구를 함께 둡니다.

### Credit 정책

High☆Cheers 기준 credit 종류는 기존 `normal/battle/local`이 아니라 다음 4종입니다.

| 컬럼 | 게임 표시 |
| --- | --- |
| `normal_credit` | `NORMAL` |
| `extra_credit` | `EXTRA` |
| `time_play_10_credit` | `TIME PLAY(10分)` |
| `time_play_16_credit` | `TIME PLAY(16分)` |

기존 DB의 `normal_credit`, `battle_credit`, `local_credit`은 신규 credit 체계와 1:1 매핑하지 않습니다. 데이터 마이그레이션에서는 기존 코인수를 이어받지 않고 신규 4종 credit을 모두 0으로 초기화합니다.

갱신/크롤링 입력도 신규 4종 credit 이름으로 받습니다. 이전 `battle/local` 이름을 신규 API에 유지하지 않습니다.

## songs

곡 단위 메타데이터입니다. 기존 `chart`에 중복 저장되던 곡 정보를 분리합니다.

| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| `song_id` | BIGINT | PK, auto increment | 내부 id |
| `song_hash` | CHAR(32) | NULL, UNIQUE 후보 | 외부/API 식별자 후보. seed 정책 확정 후 `NOT NULL`, `UNIQUE` 적용 |
| `genre_name` | VARCHAR(255) | NOT NULL | High☆Cheers 기준 장르명 |
| `song_name` | VARCHAR(255) | NOT NULL | 곡명 |
| `artist_name` | VARCHAR(255) | NULL | 작곡가/아티스트. MVP 마이그레이션 때 없으면 null |
| `version` | INT | NOT NULL | 원곡 또는 곡 그룹의 최초 수록 버전 |
| `jacket_url` | VARCHAR(512) | NULL | 자켓 URL 또는 key |
| `created_at` | DATETIME | NOT NULL | 생성일 |
| `updated_at` | DATETIME | NOT NULL | 수정일 |

### song_hash 정책

이 항목은 아직 확정되지 않았습니다. 현재는 후보를 비교하는 단계입니다.

- 후보 A: `genreName + songName + artistName + version + upperGroupPolicy`
- 후보 B: `songName + artistName + version + upperGroupPolicy`
- 후보 C: `genreName + songName + version + upperGroupPolicy`

주의:

- 장르명과 제목은 더 이상 불변값으로 보지 않습니다. 기존 데이터에서 장르명이 없는 곡은 제목과 같은 문자열을 장르명에 넣어왔으므로, 장르명 자체를 안정적인 식별자로 보지 않습니다.
- `isUpper`와 `chartVersion`을 hash seed에 넣을지 여부는 회의에서 확정합니다.
- 기본 방향은 Upper를 별도 song으로 나누지 않고 같은 song의 chart 속성으로 두는 쪽이지만, 최종 결정은 후보 비교 후 확정합니다.
- 기존 hash와 신규 hash 매핑은 마이그레이션 산출물로 남길 수 있게 준비합니다.
- seed 정책 확정 전에는 `song_hash`를 스키마의 hard unique 기준으로 사용하지 않습니다.
- 후보 검증이 끝나면 migration에서 `song_hash`를 backfill하고 `NOT NULL`, `UNIQUE` 제약을 적용합니다.
- `song_hash`가 바뀔 수 있으므로 `playdata`, `playdata_history`, jacket/image, 검색 index, cache는 `song_hash`가 아니라 `song_id` 또는 `chart_id`를 기준으로 연결합니다.
- 곡 메타데이터 변경 API는 `song_id`로 대상을 지정하고, 변경 결과로 songhash가 바뀌면 old/new mapping 또는 alias를 남깁니다.

### 인덱스

| 인덱스 | 목적 |
| --- | --- |
| unique `song_hash` 후보 | 외부/API 조회. seed 정책 확정과 backfill 이후 적용 |
| `version`, `song_name` | 원곡 수록 버전 기준 곡 목록 정렬 |
| `genre_name`, `song_name` | 기본 검색 |
| `song_name` | 곡명 검색 |

## charts

난이도별 채보 메타데이터입니다.

| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| `chart_id` | BIGINT | PK, auto increment | 내부 id |
| `song_id` | BIGINT | NOT NULL | `songs.song_id`를 가리키는 애플리케이션 참조 |
| `difficulty_code` | TINYINT | NOT NULL | `1~4`, MVP에서는 기존 코드 유지 |
| `difficulty_label` | VARCHAR(16) | NOT NULL | `LIGHT`, `NORMAL`, `HYPER`, `EX` |
| `level` | TINYINT | NOT NULL | 레벨 |
| `chart_version` | INT | NOT NULL | 해당 채보가 등장한 게임 버전. 일반 채보는 대개 `songs.version`과 같지만 Upper는 다를 수 있음 |
| `has_strict_judgement` | BOOLEAN | NOT NULL DEFAULT FALSE | 짠판정 여부 |
| `has_strict_gauge` | BOOLEAN | NOT NULL DEFAULT FALSE | 짠게이지 여부 |
| `is_upper` | BOOLEAN | NOT NULL DEFAULT FALSE | Upper 여부. 표시 딱지는 제거해도 데이터는 보존 |
| `is_deleted` | BOOLEAN | NOT NULL DEFAULT FALSE | 삭제 여부 |
| `created_at` | DATETIME | NOT NULL | 생성일 |
| `updated_at` | DATETIME | NOT NULL | 수정일 |

팝픈은 곡 또는 채보마다 짠판정, 짠게이지 특성이 존재합니다. 특히 짠게이지는 노트 수가 1536개를 넘는 채보에서 적용되므로 같은 곡이라도 높은 난이도 채보만 짠게이지일 수 있습니다. 따라서 MVP에서는 곡 단위인 `songs`가 아니라 난이도별 채보 단위인 `charts`에 `has_strict_gauge`를 둡니다.

`has_strict_judgement`도 난이도별 차이가 발생할 가능성을 열어두기 위해 `charts`에 둡니다. 실제 데이터가 곡 단위로만 존재한다고 확인되면 API 응답에서 곡 단위 요약값으로 집계할 수 있습니다.

`chart_version`은 팝클의 이번 버전곡/구곡 bucket 판정에도 사용합니다. 같은 `song`이라도 Upper가 나중 버전에 추가될 수 있으므로, 현재 버전 신곡 여부를 `songs.version`만으로 판단하면 Upper 채보가 잘못 분류될 수 있습니다.

### 인덱스

| 인덱스 | 목적 |
| --- | --- |
| unique `song_id`, `difficulty_code`, `is_upper` | 곡별 일반/Upper 난이도 중복 방지 |
| `level`, `is_deleted` | 레벨별 목록/집계 |
| `difficulty_code`, `level` | 난이도/레벨 필터 |
| `song_id`, `is_deleted` | 곡 상세에서 채보 목록 조회 |
| `chart_version`, `is_upper` | 버전별 채보/Upper 필터 |

## playdata

유저별 채보 베스트 플레이데이터입니다.

High☆Cheers에서 처음으로 기존 점수 초기화가 확인되었고, 이후 다른 버전에서도 같은 정책이 반복될 수 있습니다. 따라서 `playdata`는 단순히 유저별 최신 점수 하나를 저장하지 않고, 어떤 스코프의 베스트인지와 그 점수가 실제로 나온 게임 버전을 함께 저장하는 일반 구조로 설계합니다.

핵심 개념:

| 개념 | 설명 |
| --- | --- |
| `best_type` | 이 row가 어떤 베스트인지 나타냅니다. `VERSION_BEST`, `ALL_TIME_BEST` |
| `target_version` | `VERSION_BEST`가 대상으로 하는 게임 버전입니다. `ALL_TIME_BEST`는 `0`을 사용합니다. |
| `score_version` | 이 점수가 실제로 나온 게임 버전입니다. |

예:

| 상황 | best_type | target_version | score_version |
| --- | --- | --- | --- |
| High☆Cheers에서 크롤링한 이번 버전 베스트 | `VERSION_BEST` | `29` | `29` |
| High☆Cheers에서 역대 베스트가 이전작 기록인 경우 | `ALL_TIME_BEST` | `0` | `28` |
| High☆Cheers에서 역대 베스트도 이번작 기록인 경우 | `ALL_TIME_BEST` | `0` | `29` |
| 기존 DB 마이그레이션 점수 | `ALL_TIME_BEST` | `0` | `28` |

기존 DB 마이그레이션 시 현재 `playdata`는 28버전에서 나온 점수로 간주합니다. 즉 `score_version = 28`로 저장합니다. 이전 버전별 베스트를 별도로 보존하고 싶으면 `best_type = VERSION_BEST`, `target_version = 28`, `score_version = 28` row도 함께 생성할 수 있지만, MVP 필수는 `ALL_TIME_BEST` 보존입니다.

| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| `playdata_id` | BIGINT | PK, auto increment | 내부 id |
| `user_id` | BIGINT | NOT NULL | `users.user_id`를 가리키는 애플리케이션 참조 |
| `chart_id` | BIGINT | NOT NULL | `charts.chart_id`를 가리키는 애플리케이션 참조 |
| `best_type` | VARCHAR(20) | NOT NULL | `VERSION_BEST`, `ALL_TIME_BEST` |
| `target_version` | INT | NOT NULL | `VERSION_BEST` 대상 버전. `ALL_TIME_BEST`는 `0` |
| `score_version` | INT | NOT NULL | 해당 점수가 실제로 나온 게임 버전 |
| `score` | INT | NOT NULL | 점수 |
| `rank_code` | TINYINT | NOT NULL | 크롤링된 랭크 코드 |
| `medal_code` | TINYINT | NOT NULL | 크롤링된 메달 코드 |
| `popclass` | INT | NOT NULL DEFAULT 0 | 해당 row 기준 채보 팝클. 유저 팝클 계산에는 현재 버전 `VERSION_BEST`만 사용 |
| `is_display_popclass_target` | BOOLEAN | NOT NULL DEFAULT FALSE | 현재 표기 팝클 산정 대상 여부 |
| `popclass_bucket` | VARCHAR(20) | NULL | `CURRENT_VERSION`, `OLD_VERSION`. 산정 대상이 아니면 null |
| `popclass_bucket_rank` | INT | NULL | bucket 안에서의 순위. 현재 버전 1~20, 구곡 1~40 |
| `last_played_at` | DATETIME | NULL | 원천 데이터에서 플레이일을 얻을 수 있으면 저장 |
| `created_at` | DATETIME | NOT NULL | 생성일 |
| `updated_at` | DATETIME | NOT NULL | 수정일 |

### 중요 정책

- `rank_code`는 서버가 `score`로 계산하지 않습니다.
- 갱신/크롤링 입력에 `score`, `rank_code`, `medal_code`가 함께 들어와야 합니다.
- 크롤링한 점수는 무조건 현재 버전 점수로 간주합니다.
- 이번 버전 팝클은 현재 게임 버전의 `VERSION_BEST` row만 기준으로 계산합니다.
- `ALL_TIME_BEST` row는 랭킹/비교/표시에는 쓰지만, 이번 버전 팝클 계산의 source of truth가 아닙니다.
- `popclass`는 row별 score/medal/chart level로 계산해 저장하되, 유저 `display_popclass`는 현재 버전 `VERSION_BEST` 상위 50개 기준으로 계산합니다.
- 현재 버전 score가 역대 베스트보다 높으면 `VERSION_BEST(target_version = currentVersion)`와 `ALL_TIME_BEST(target_version = 0)`를 함께 갱신합니다.
- 현재 버전 score가 역대 베스트보다 낮으면 `VERSION_BEST`만 갱신하고 `ALL_TIME_BEST`는 유지합니다.
- `ALL_TIME_BEST`가 변경된 갱신 요청에서는 유저의 `potential_popclass`도 같은 트랜잭션 안에서 재계산하거나, 최소한 같은 갱신 job의 후속 step에서 반드시 재계산합니다.

### 팝클 산정 대상 마킹

팝클표 조회 성능을 위해 서버는 현재 표기 팝클에 들어가는 `playdata` row를 미리 마킹합니다.

현재 표기 팝클은 다음 구성으로 계산합니다.

| bucket | 대상 | 개수 |
| --- | --- | --- |
| `CURRENT_VERSION` | 이번 버전에 등장한 채보의 현재 버전 베스트. `charts.chart_version = currentVersion` 기준 | 20개 |
| `OLD_VERSION` | 이전 버전에 등장한 채보의 현재 버전 베스트. `charts.chart_version < currentVersion` 기준 | 40개 |

정책:

- 크롤러는 `popclass_bucket`을 보내지 않습니다.
- 크롤러는 원천 데이터인 score/rank/medal/chart 식별자만 보냅니다.
- 서버가 playdata upsert 후 유저 전체 현재 버전 `VERSION_BEST`를 조회해 bucket을 재계산합니다.
- 서버는 기존 마킹을 초기화한 뒤 상위 20/40개 row에만 `is_display_popclass_target = true`를 설정합니다.
- `popclass_bucket_rank`는 각 bucket 안에서 `1`부터 시작합니다.
- `display_popclass`는 마킹된 row를 기준으로 계산합니다.
- `potential_popclass`는 `ALL_TIME_BEST` 기준이므로 이 마킹 필드를 사용하지 않고 별도 계산합니다.
- 갱신 도중 마킹 재계산이 실패하면 해당 갱신 job은 성공으로 처리하지 않습니다.

### 인덱스

`playdata`는 서비스에서 가장 커질 가능성이 높은 테이블입니다. 유저 수, 채보 수, 베스트 스코프가 모두 곱해지기 때문입니다.

```text
예: 유저 10,000명 * 채보 6,000개 * VERSION_BEST/ALL_TIME_BEST 2종
= 최대 120,000,000 row 후보
```

따라서 `playdata` 조회는 항상 다음 원칙을 따릅니다.

1. `playdata`에서 `user_id`, `chart_id`, `best_type`, `target_version`으로 먼저 row를 줄입니다.
2. 줄어든 row에만 `charts`, `songs`, `users`를 join합니다.
3. 목록/집계 화면이 커지면 정규화 테이블을 계속 join하지 않고 read summary table을 추가합니다.

| 인덱스 | 목적 |
| --- | --- |
| unique `user_id`, `chart_id`, `best_type`, `target_version` | 스코프별 베스트 upsert |
| `user_id`, `best_type`, `target_version`, `popclass desc`, `score desc` | 현재 버전 팝클 상위 50 |
| `user_id`, `chart_id`, `best_type`, `target_version` | 유저별 단일 채보/스코프 조회 |
| `chart_id`, `best_type`, `target_version`, `score desc` | 곡별 현재 버전 또는 역대 랭킹 |
| `chart_id`, `best_type`, `target_version`, `medal_code`, `score desc` | 곡별 메달 우선 랭킹 |
| `user_id`, `best_type`, `target_version`, `rank_code` | 유저 rank 집계 |
| `user_id`, `best_type`, `target_version`, `medal_code` | 유저 medal 집계 |
| `user_id`, `best_type`, `target_version`, `is_display_popclass_target`, `popclass_bucket`, `popclass_bucket_rank` | 팝클표 빠른 조회 |

### 조회 패턴과 설계 근거

인덱스는 컬럼마다 무작정 추가하지 않습니다. 실제 API가 사용하는 `WHERE`, `ORDER BY`, `LIMIT` 패턴에 맞춰 최소한으로 둡니다.

#### 갱신/upsert

갱신 코드는 한 유저의 한 채보에 대해 현재 버전 베스트와 역대 베스트를 각각 upsert합니다.

```sql
SELECT *
FROM playdata
WHERE user_id = ?
  AND chart_id = ?
  AND best_type = ?
  AND target_version = ?;
```

이 쿼리는 다음 unique key로 처리합니다.

```sql
UNIQUE KEY uk_playdata_user_chart_scope (
    user_id, chart_id, best_type, target_version
)
```

이 key는 조회 성능뿐 아니라 중복 방지 역할도 합니다. 같은 유저, 같은 채보, 같은 베스트 스코프 row가 2개 생기면 팝클 계산과 랭킹이 흔들리므로 DB 레벨에서 막습니다.

#### 유저 팝클표

팝클표는 매번 전체 playdata를 정렬해서 이번 버전 20개와 구버전 40개를 고르면 비쌉니다. 그래서 갱신 시점에 서버가 `is_display_popclass_target`, `popclass_bucket`, `popclass_bucket_rank`를 미리 마킹합니다.

조회 쿼리는 다음처럼 작아져야 합니다.

```sql
SELECT p.chart_id,
       p.score,
       p.rank_code,
       p.medal_code,
       p.popclass,
       p.popclass_bucket,
       p.popclass_bucket_rank
FROM playdata p
WHERE p.user_id = ?
  AND p.best_type = 'VERSION_BEST'
  AND p.target_version = ?
  AND p.is_display_popclass_target = true
ORDER BY p.popclass_bucket, p.popclass_bucket_rank;
```

이 쿼리는 다음 인덱스가 담당합니다.

```sql
KEY idx_playdata_user_display_popclass_target (
    user_id,
    best_type,
    target_version,
    is_display_popclass_target,
    popclass_bucket,
    popclass_bucket_rank
)
```

이 인덱스를 두는 이유는 팝클표 API가 전체 playdata를 정렬하지 않고, 이미 선정된 최대 60개 row만 순서대로 가져오게 하기 위해서입니다.

#### 유저 전체 플레이데이터

유저 전체 플레이데이터는 반드시 베스트 스코프를 정해서 조회합니다.

```sql
SELECT *
FROM playdata
WHERE user_id = ?
  AND best_type = ?
  AND target_version = ?
ORDER BY chart_id;
```

이 쿼리는 다음 인덱스를 사용합니다.

```sql
KEY idx_playdata_user_scope_chart (
    user_id, best_type, target_version, chart_id
)
```

프론트에서 현재 버전 베스트와 역대 베스트가 모두 필요하면 API는 응답을 스코프별로 분리해서 함께 내려줍니다. 예를 들어 `versionBest[]`, `allTimeBest[]` 또는 `myVersionBest`, `myAllTimeBest`처럼 응답에서 구분합니다. 팝클 API도 계산 기준은 현재 버전이지만, 포함되는 playdata는 두 스코프를 함께 내려줄 수 있습니다.

#### 특정 곡 랭킹

곡별 랭킹은 `chart_id`를 기준으로 먼저 줄이고, 필요한 경우에만 유저 프로필을 붙입니다.

```sql
SELECT p.user_id,
       p.score,
       p.rank_code,
       p.medal_code
FROM playdata p
WHERE p.chart_id = ?
  AND p.best_type = 'VERSION_BEST'
  AND p.target_version = ?
ORDER BY p.score DESC
LIMIT 100;
```

이 쿼리는 다음 인덱스를 사용합니다.

```sql
KEY idx_playdata_chart_score (
    chart_id, best_type, target_version, score DESC
)
```

랭킹 목록에서 유저명이나 캐릭터가 필요하면, 먼저 `playdata`에서 상위 100명을 줄인 뒤 그 `user_id` 목록에 대해서만 `user_profiles` 또는 `users`를 join합니다.

#### 레벨/난이도별 rank, medal 집계

유저 프로필의 레벨/난이도별 rank, medal count는 `playdata`를 유저와 스코프로 먼저 줄인 뒤 `charts`를 붙입니다.

```sql
SELECT c.level,
       c.difficulty_code,
       p.medal_code,
       COUNT(*) AS count
FROM playdata p
JOIN charts c ON c.chart_id = p.chart_id
WHERE p.user_id = ?
  AND p.best_type = 'VERSION_BEST'
  AND p.target_version = ?
GROUP BY c.level, c.difficulty_code, p.medal_code;
```

MVP에서는 `idx_playdata_user_scope_chart`와 `charts.chart_id` PK로 처리합니다. 이 집계가 자주 호출되거나 느려지면 다음 read summary table을 추가합니다.

```text
user_playdata_counts
- user_id
- best_type
- target_version
- level
- difficulty_code
- rank_code
- medal_code
- count
```

#### join이 커질 때의 원칙

정규화된 테이블을 유지하되, 큰 API에서 항상 모든 테이블을 한 번에 join하지 않습니다.

나쁜 방향:

```sql
SELECT ...
FROM playdata p
JOIN charts c ON c.chart_id = p.chart_id
JOIN songs s ON s.song_id = c.song_id
JOIN users u ON u.user_id = p.user_id
WHERE ...
ORDER BY ...
LIMIT ...;
```

권장 방향:

```sql
SELECT p.*, c.level, c.difficulty_code, s.song_name, s.genre_name
FROM (
    SELECT *
    FROM playdata
    WHERE user_id = ?
      AND best_type = 'VERSION_BEST'
      AND target_version = ?
      AND is_display_popclass_target = true
    ORDER BY popclass_bucket, popclass_bucket_rank
) p
JOIN charts c ON c.chart_id = p.chart_id
JOIN songs s ON s.song_id = c.song_id;
```

먼저 `playdata`에서 작은 결과 집합을 만든 뒤, 그 결과에만 곡/채보 메타데이터를 붙입니다. 이 방식이 DB가 불필요한 join row를 크게 만들지 않게 해줍니다.

### read summary table 후보

다음 API는 트래픽이나 데이터가 커질 경우 read summary table 후보입니다.

| API/화면 | 위험한 쿼리 | 확장 후보 |
| --- | --- | --- |
| `/chart/all` | 모든 songs/charts/playdata 집계 join | `song_chart_summary` |
| `/chart/recent` | 버전/날짜 정렬 + chart 집계 | `recent_chart_summary` |
| `/user/ranking` | users와 stats 정렬/필터 | `user_ranking_summary` |
| `/playdata/count/{poptomoId}` | 매 요청마다 playdata/charts group by | `user_playdata_counts` |
| 성장 추세 목록 | history 전체 group by | `user_chart_growth_summary` |

MVP에서는 정규화 테이블과 위 인덱스로 시작합니다. 다만 API 구현 시 summary table로 옮길 수 있도록 application query service를 분리해 둡니다.

## playdata_history

이력 테이블입니다. 기존 `history` 역할을 유지하되 이름을 명확하게 바꿉니다.

추후 곡별 사용자 성장 추세를 보여주려면 이 테이블이 중요합니다. MVP에서는 모든 크롤링 snapshot을 저장하기보다 best가 실제로 변경된 순간을 남기는 방향을 우선합니다. 이 정도만 보존해도 “이 곡에서 언제 score/rank/medal이 올랐는지”를 그래프로 보여줄 수 있습니다.

| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| `history_id` | BIGINT | PK, auto increment | 내부 id |
| `user_id` | BIGINT | NOT NULL | 유저 id |
| `chart_id` | BIGINT | NOT NULL | 채보 id |
| `best_type` | VARCHAR(20) | NOT NULL | 변경된 베스트 스코프 |
| `target_version` | INT | NOT NULL | 변경 대상 버전. 역대 베스트는 `0` |
| `score_version` | INT | NOT NULL | 점수가 나온 게임 버전 |
| `score` | INT | NOT NULL | 당시 점수 |
| `rank_code` | TINYINT | NOT NULL | 당시 랭크 |
| `medal_code` | TINYINT | NOT NULL | 당시 메달 |
| `popclass` | INT | NOT NULL | 당시 채보 팝클 |
| `event_type` | VARCHAR(32) | NOT NULL | `REGISTER`, `SCORE_UP`, `RANK_UP`, `MEDAL_UP`, `MANUAL` |
| `created_at` | DATETIME | NOT NULL | 이력 생성일 |

### 생성 조건

MVP에서는 다음 조건에서 history를 남깁니다.

- 신규 플레이데이터 등록
- 점수 상승
- 랭크 상승
- 메달 상승
- 현재 버전 베스트와 역대 베스트 중 하나라도 변경

랭크/메달의 우열 비교는 애플리케이션 상수의 `sortOrder`를 사용합니다.

### 성장 추세 확장

곡별 성장 그래프를 더 자세히 만들고 싶어질 경우 다음 테이블을 추가할 수 있습니다.

| 후보 테이블 | 역할 |
| --- | --- |
| `playdata_snapshots` | 크롤링 시점마다 원천 score/rank/medal snapshot 저장 |
| `playdata_daily_snapshots` | 유저별/채보별 일 단위 최고 기록 집계 |
| `user_growth_events` | score/rank/medal/popclass 상승 이벤트를 화면 표시용으로 정규화 |

MVP에서는 `playdata_history`를 source of truth로 두고, snapshot 계열 테이블은 실제 성장 추세 화면을 만들 때 추가합니다.

### 인덱스

| 인덱스 | 목적 |
| --- | --- |
| `user_id`, `chart_id`, `best_type`, `target_version`, `created_at desc` | 특정 유저/곡/스코프 히스토리 |
| `user_id`, `created_at desc` | 유저 최근 갱신 |
| `chart_id`, `created_at desc` | 곡 최근 갱신 |

## renew_logs

갱신/등록 로그입니다.

| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| `renew_log_id` | BIGINT | PK, auto increment | 내부 id |
| `poptomo_id` | VARCHAR(32) | NULL | 대상 팝토모 ID |
| `user_id` | BIGINT | NULL | 유저 id. 유저 생성 전 실패할 수 있어 nullable |
| `status` | VARCHAR(20) | NOT NULL | `SUCCESS`, `FAILED`, `PARTIAL` |
| `mode` | VARCHAR(20) | NOT NULL | `REGISTER`, `RENEW` |
| `input_chart_count` | INT | NOT NULL DEFAULT 0 | 입력 row 수 |
| `matched_chart_count` | INT | NOT NULL DEFAULT 0 | 매칭 성공 row 수 |
| `updated_playdata_count` | INT | NOT NULL DEFAULT 0 | 저장/갱신 row 수 |
| `failure_reason` | VARCHAR(1024) | NULL | 실패 사유 |
| `ip` | VARCHAR(45) | NULL | IPv4/IPv6 |
| `created_at` | DATETIME | NOT NULL | 생성일 |

기존처럼 비밀번호나 민감정보는 저장하지 않습니다.

## login_logs

로그인 로그입니다.

| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| `login_log_id` | BIGINT | PK, auto increment | 내부 id |
| `poptomo_id` | VARCHAR(32) | NULL | 시도한 팝토모 ID |
| `user_id` | BIGINT | NULL | 성공 또는 매칭된 유저 id |
| `status` | VARCHAR(20) | NOT NULL | `SUCCESS`, `FAILED` |
| `failure_reason` | VARCHAR(255) | NULL | 실패 사유 |
| `ip` | VARCHAR(45) | NULL | IPv4/IPv6 |
| `created_at` | DATETIME | NOT NULL | 생성일 |

주의: password는 절대 저장하지 않습니다.

## password_reset_tokens

비밀번호 복구 요청 시 발급하는 일회용 토큰입니다.

이 테이블이 필요한 이유는 이메일 링크를 누른 사람이 실제로 비밀번호 재설정 권한을 가진 요청자인지 확인하기 위해서입니다. 비밀번호 복구는 로그인 전 기능이므로 JWT나 세션을 사용할 수 없습니다. 대신 서버가 짧은 수명의 랜덤 토큰을 만들고, 사용자가 이메일로 받은 링크를 통해 그 토큰을 다시 제출하게 합니다.

동작 흐름:

1. 사용자가 비밀번호 복구를 요청합니다.
2. 서버는 이메일 존재 여부를 응답에 노출하지 않고, 계정이 있으면 랜덤 reset token을 생성합니다.
3. 서버는 원문 token을 DB에 저장하지 않고 `sha256(token)`만 `password_reset_tokens.token_hash`에 저장합니다.
4. 서버는 원문 token이 포함된 링크를 이메일로 보냅니다.
5. 사용자가 링크에서 새 비밀번호를 제출합니다.
6. 서버는 제출된 token을 다시 hash해서 `token_hash`로 조회합니다.
7. `expires_at`이 지나지 않았고 `used_at`이 비어 있으면 비밀번호를 변경합니다.
8. 성공하면 `used_at`을 채워 같은 token의 재사용을 막습니다.

`email`을 토큰 row에 함께 저장하는 이유는 발송 당시 이메일을 감사/추적하기 위해서입니다. 사용자가 이후 이메일을 바꾸더라도 어떤 주소로 복구 링크가 발송되었는지 확인할 수 있습니다.

| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| `reset_token_id` | BIGINT | PK, auto increment | 내부 id |
| `user_id` | BIGINT | NOT NULL | 대상 유저 id |
| `token_hash` | CHAR(64) | NOT NULL, UNIQUE | 원문 토큰의 SHA-256 해시 |
| `email` | VARCHAR(255) | NOT NULL | 발송 당시 이메일 |
| `expires_at` | DATETIME | NOT NULL | 만료 시각 |
| `used_at` | DATETIME | NULL | 사용 완료 시각 |
| `requested_ip` | VARCHAR(45) | NULL | 요청 IP |
| `created_at` | DATETIME | NOT NULL | 생성일 |

### 보안 정책

- 원문 reset token은 DB에 저장하지 않습니다.
- DB에는 `sha256(token)`만 저장합니다.
- 토큰은 15~30분 정도의 짧은 TTL을 권장합니다.
- 토큰은 1회만 사용할 수 있습니다.
- 새 토큰 발급 시 같은 유저의 미사용 토큰을 만료시키거나, 최신 토큰만 허용합니다.
- 응답 메시지는 이메일 존재 여부를 노출하지 않습니다.
- 너무 잦은 요청은 IP와 `poptomo_id/email` 단위 rate limit을 둡니다.

### 인덱스

| 인덱스 | 목적 |
| --- | --- |
| unique `token_hash` | 토큰 검증 |
| `user_id`, `used_at`, `expires_at` | 유저별 활성 토큰 조회/무효화 |
| `email`, `created_at desc` | 복구 요청 추적 |

## 랭크/메달/난이도 코드

MVP에서는 게임 코드/표시 정책 테이블 없이 코드의 enum/policy object로 시작합니다.

### rank_code 초안

낮은 값이 좋은 랭크였던 기존 관성을 유지할 수 있습니다. 다만 외부 API에서는 label을 함께 내려줍니다.

| 코드 | 라벨 | 참고 점수 |
| --- | --- | --- |
| 1 | `S+` | 99,000 이상 |
| 2 | `S` | 98,000 - 98,999 |
| 3 | `AAA` | 95,000 - 97,999 |
| 4 | `AA+` | 93,000 - 94,999 |
| 5 | `AA` | 90,000 - 92,999 |
| 6 | `A+` | 86,000 - 89,999 |
| 7 | `A` | 82,000 이상 |
| 8 | `B+` | 77,000 - 81,999 |
| 9 | `B` | 72,000 - 76,999 |
| 10 | `C` | 62,000 - 71,999 |
| 11 | `D` | 50,000 - 61,999 |
| 12 | `E` | 49,999 이하 |

이 표는 정렬/표시/검증용입니다. 서버는 점수로 랭크를 산출하지 않습니다.

### difficulty_code 초안

| 코드 | 라벨 | 짧은 라벨 |
| --- | --- | --- |
| 1 | `LIGHT` | `L` |
| 2 | `NORMAL` | `N` |
| 3 | `HYPER` | `H` |
| 4 | `EX` | `EX` |

### medal_code

정확한 기존 코드표와 신규 `어시이지`의 위치 확인이 필요합니다. MVP에서는 기존 코드값을 최대한 유지하고, label mapping만 High☆Cheers 기준으로 갱신합니다.

## DDL 초안

MySQL 기준 초안입니다. 실제 구현에서는 애플리케이션 실행 classpath 기준 Flyway `db/migration/V*.sql` 파일로 나눠 관리합니다. 실제 저장 위치는 Flyway 의존성을 소유하는 모듈이 정해진 뒤 확정합니다.

권장 분할:

```text
V1__baseline_account_and_security.sql
V2__baseline_music_catalog.sql
V3__baseline_playdata_and_logs.sql
V4__baseline_support_tables.sql
V5__seed_constants.sql
```

이번 리팩토링은 DB 구조가 크게 바뀌므로 테이블 하나당 파일 하나로 잘게 쪼개기보다 큰 세션 단위로 묶습니다. 운영에 적용된 Flyway `V` 파일은 수정하지 않고, 변경이 필요하면 새 버전 파일을 추가합니다.

```sql
CREATE TABLE users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poptomo_id VARCHAR(32) NOT NULL,
    user_name VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    email_verified_at DATETIME NULL,
    display_popclass INT NOT NULL DEFAULT 0,
    potential_popclass INT NOT NULL DEFAULT 0,
    legacy_popclass INT NOT NULL DEFAULT 0,
    character_name VARCHAR(128) NOT NULL DEFAULT '',
    comment VARCHAR(255) NOT NULL DEFAULT '',
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    normal_credit INT NOT NULL DEFAULT 0,
    extra_credit INT NOT NULL DEFAULT 0,
    time_play_10_credit INT NOT NULL DEFAULT 0,
    time_play_16_credit INT NOT NULL DEFAULT 0,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_users_poptomo_id (poptomo_id),
    UNIQUE KEY uk_users_email (email),
    KEY idx_users_display_popclass (display_popclass DESC),
    KEY idx_users_potential_popclass (potential_popclass DESC),
    KEY idx_users_legacy_popclass (legacy_popclass DESC),
    KEY idx_users_role_display_popclass (role, display_popclass DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE songs (
    song_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    song_hash CHAR(32) NULL,
    genre_name VARCHAR(255) NOT NULL,
    song_name VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255) NULL,
    version INT NOT NULL,
    jacket_url VARCHAR(512) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    KEY idx_songs_song_hash (song_hash),
    KEY idx_songs_version_name (version, song_name),
    KEY idx_songs_genre_name (genre_name, song_name),
    KEY idx_songs_name (song_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE charts (
    chart_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    song_id BIGINT NOT NULL,
    difficulty_code TINYINT NOT NULL,
    difficulty_label VARCHAR(16) NOT NULL,
    level TINYINT NOT NULL,
    chart_version INT NOT NULL,
    has_strict_judgement BOOLEAN NOT NULL DEFAULT FALSE,
    has_strict_gauge BOOLEAN NOT NULL DEFAULT FALSE,
    is_upper BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_charts_song_difficulty_upper (song_id, difficulty_code, is_upper),
    KEY idx_charts_level_deleted (level, is_deleted),
    KEY idx_charts_difficulty_level (difficulty_code, level),
    KEY idx_charts_song_deleted (song_id, is_deleted),
    KEY idx_charts_version_upper (chart_version, is_upper)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE playdata (
    playdata_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    chart_id BIGINT NOT NULL,
    best_type VARCHAR(20) NOT NULL,
    target_version INT NOT NULL,
    score_version INT NOT NULL,
    score INT NOT NULL,
    rank_code TINYINT NOT NULL,
    medal_code TINYINT NOT NULL,
    popclass INT NOT NULL DEFAULT 0,
    is_display_popclass_target BOOLEAN NOT NULL DEFAULT FALSE,
    popclass_bucket VARCHAR(20) NULL,
    popclass_bucket_rank INT NULL,
    last_played_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_playdata_user_chart_scope (user_id, chart_id, best_type, target_version),
    KEY idx_playdata_user_popclass (user_id, best_type, target_version, popclass DESC, score DESC),
    KEY idx_playdata_user_scope_chart (user_id, best_type, target_version, chart_id),
    KEY idx_playdata_chart_score (chart_id, best_type, target_version, score DESC),
    KEY idx_playdata_chart_medal_score (chart_id, best_type, target_version, medal_code, score DESC),
    KEY idx_playdata_user_rank (user_id, best_type, target_version, rank_code),
    KEY idx_playdata_user_medal (user_id, best_type, target_version, medal_code),
    KEY idx_playdata_user_display_popclass_target (user_id, best_type, target_version, is_display_popclass_target, popclass_bucket, popclass_bucket_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE playdata_history (
    history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    chart_id BIGINT NOT NULL,
    best_type VARCHAR(20) NOT NULL,
    target_version INT NOT NULL,
    score_version INT NOT NULL,
    score INT NOT NULL,
    rank_code TINYINT NOT NULL,
    medal_code TINYINT NOT NULL,
    popclass INT NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL,
    KEY idx_history_user_chart_scope_created (user_id, chart_id, best_type, target_version, created_at DESC),
    KEY idx_history_user_created (user_id, created_at DESC),
    KEY idx_history_chart_created (chart_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE renew_logs (
    renew_log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poptomo_id VARCHAR(32) NULL,
    user_id BIGINT NULL,
    status VARCHAR(20) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    input_chart_count INT NOT NULL DEFAULT 0,
    matched_chart_count INT NOT NULL DEFAULT 0,
    updated_playdata_count INT NOT NULL DEFAULT 0,
    failure_reason VARCHAR(1024) NULL,
    ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL,
    KEY idx_renew_logs_poptomo_created (poptomo_id, created_at DESC),
    KEY idx_renew_logs_status_created (status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_logs (
    login_log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poptomo_id VARCHAR(32) NULL,
    user_id BIGINT NULL,
    status VARCHAR(20) NOT NULL,
    failure_reason VARCHAR(255) NULL,
    ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL,
    KEY idx_login_logs_poptomo_created (poptomo_id, created_at DESC),
    KEY idx_login_logs_status_created (status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_tokens (
    reset_token_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    requested_ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uk_password_reset_tokens_hash (token_hash),
    KEY idx_password_reset_tokens_user_active (user_id, used_at, expires_at),
    KEY idx_password_reset_tokens_email_created (email, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`song_hash` seed 정책이 확정되면 별도 migration에서 다음 변경을 적용합니다.

```sql
ALTER TABLE songs
    MODIFY song_hash CHAR(32) NOT NULL,
    DROP INDEX idx_songs_song_hash,
    ADD UNIQUE KEY uk_songs_song_hash (song_hash);
```

## 기존 DB에서 신규 DB로 매핑

| 기존 | 신규 | 변환 |
| --- | --- | --- |
| `"user"` | `users` | `password` -> `password_hash`, `"character"` -> `character_name`, 기존 `popclass` -> `legacy_popclass`, `potential_popclass`는 `ALL_TIME_BEST` 적재 후 재계산, 기존 credit/코인수는 이어받지 않고 신규 4종 credit을 0으로 초기화, `email`은 신규 nullable |
| `chart` | `songs` | `song_hash` 후보와 곡 메타데이터(`genre_name`, `song_name`, `version`, `jacket`)를 기준으로 곡 단위 분리 |
| `chart` | `charts` | `difficulty`, `level`, `is_upper`, `chart_version`, `is_deleted`를 난이도별로 이전. Upper가 원곡보다 늦게 나온 경우 `chart_version`에 Upper 등장 버전을 저장 |
| `playdata` | `playdata` | old `chart_id`를 new `chart_id`로 매핑. 기존 점수는 `ALL_TIME_BEST`, `target_version = 0`, `score_version = 28`로 저장 |
| `history` | `playdata_history` | old `chart_id`를 new `chart_id`로 매핑. 기존 이력도 가능한 경우 `score_version = 28`로 저장 |
| `renew_log` | `renew_logs` | 컬럼명 정리 |
| `login_log` | `login_logs` | password 폐기 |

## MVP에서 보류하는 것

| 항목 | 보류 이유 | 추후 방향 |
| --- | --- | --- |
| `rank_policy` 테이블 | MVP에서는 코드 상수로 충분 | 운영 중 변경이 잦아지면 테이블화 |
| `medal_policy` 테이블 | 신규 어시이지 코드 확정 필요 | 코드표 확정 후 테이블화 |
| `difficulty_policy` 테이블 | High☆Cheers 기준 4개 라벨이면 충분 | 버전별 표시가 복잡해지면 테이블화 |
| 검색 태그 | MVP 핵심 경로 아님 | `song_search_tags` 추가 |

## 남은 결정 사항

- 신규 `song_hash` seed에 `artist_name`을 넣을 수 있는가?
- Upper는 별도 song으로 볼 것인가, 같은 song의 chart 속성으로만 볼 것인가?
- 기존 medal 코드표와 신규 `어시이지` 코드값은 어디에 배치할 것인가?
- `last_played_at`을 크롤링 원천에서 얻을 수 있는가?
- 기존 password가 실제 원문인지, 외부 secret인지, 이미 hash인지 확인해야 합니다.
- 이메일 인증을 MVP 1차에 포함할 것인가, 이메일 등록 후 복구만 먼저 열 것인가?
- 비밀번호 복구 메일 발송 provider는 무엇을 쓸 것인가?
- LONG POP ON/OFF 전환 시 점수와 팝클 계산에 어떤 기록이 남는지 검증해야 합니다.
- 기존 playdata를 28버전 `VERSION_BEST` row로도 복제할지, MVP에서는 `ALL_TIME_BEST`만 보존할지 결정해야 합니다.

## 리서치 기반 확장 후보

High☆Cheers 공식/공개 자료를 보면 곡 목록에서 `GENRE`, `TITLE`, `ARTIST`, `CHARA`, `BPM`, `L/N/H/EX`가 중요한 표시 정보로 쓰입니다. MVP DDL에는 최소 필드만 넣지만, 다음 필드는 빠르게 추가될 가능성이 높습니다.

| 테이블 | 후보 필드 | 이유 |
| --- | --- | --- |
| `songs` | `bpm_min`, `bpm_max` | 곡 상세와 검색 필터 품질 개선 |
| `songs` | `default_character_name` | 곡 목록/상세에서 CHARA 표시 |
| `songs` | `release_date` | 최신 차트 정렬을 `created_at`보다 정확히 처리 |
| `songs` | `event_name` | 이벤트/해금 곡 분류 |
| `songs` | `source_category` | default, event, license, collab 등 구분 |
| `songs` | `source_url` | 크롤링 출처 추적 |
| `charts` | `note_count` | 점수/난이도 분석 확장 |
| `playdata` | `long_pop_mode` | LONG POP ON/OFF 원천값이 확인될 경우 후보 |
| `playdata_history` | `raw_score`, `raw_medal_code` | LONG POP ON/OFF 검증 중 원천 기록 보존 후보 |

자세한 리서치 결과는 [서비스와 게임 리서치](planning/service-research.md)를 참고합니다.
