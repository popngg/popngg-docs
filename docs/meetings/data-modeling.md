# 데이터 모델링

이번 리팩토링에서 가장 크게 바뀌는 영역입니다.

회의에서 최소한 아래 내용을 확정해야 합니다.

## 팝클래스

- 팝클래스 계산식을 어떤 입력값으로 구현할 것인가?
- 현재 버전곡 20개, 구버전곡 40개 선정 기준은 `charts.chart_version`만으로 충분한가?
- `display_popclass`, `potential_popclass`, `legacy_popclass`를 언제 계산하고 언제 갱신할 것인가?
- 마이그레이션 시 `potential_popclass`를 어떤 순서로 계산할 것인가?

## 플레이데이터

- 현재 버전 베스트와 역대 베스트를 `playdata`에 어떻게 저장할 것인가?
- 기존 플레이데이터를 28버전 기록으로 마이그레이션할 때 `VERSION_BEST`도 복제할 것인가, `ALL_TIME_BEST`만 만들 것인가?
- 크롤링된 점수는 무조건 현재 버전 기록으로 저장한다는 정책을 유지할 것인가?
- `playdata_history`는 모든 갱신 시점의 원천 데이터를 남길 것인가, 변경된 경우만 남길 것인가?

## 곡별 성장 추세

추후 곡별로 사용자의 성장 추세를 보여주려면 `playdata_history`를 단순 변경 로그가 아니라 분석 가능한 시계열 데이터로 남겨야 합니다.

예상 화면:

- 특정 곡/채보에서 내 score 변화 그래프
- rank, medal이 올라간 시점 표시
- 같은 곡의 일반/Upper 성장 비교
- 특정 기간 동안 가장 많이 오른 곡 목록
- 유저 프로필에서 최근 성장한 채보 목록

이 기능을 고려하면 회의에서 아래를 결정해야 합니다.

- history를 점수/랭크/메달이 상승한 경우에만 남길 것인가, 크롤링 시점마다 snapshot으로 남길 것인가?
- score가 그대로여도 medal만 바뀐 경우를 성장 이벤트로 볼 것인가?
- 감소한 score도 원천 데이터로 남길 것인가, best만 남길 것인가?
- `playdata_history.created_at`만으로 충분한가, 실제 플레이일/크롤링일을 분리해야 하는가?
- 일별/주별 그래프를 빠르게 만들기 위해 `playdata_daily_snapshots` 같은 집계 테이블을 추후 둘 것인가?

### Option A. best 변경 이력만 저장

장점:

- 저장량이 적습니다.
- MVP 구현이 간단합니다.
- 성장 그래프가 “최고 기록이 오른 순간” 중심으로 깔끔합니다.

단점:

- 정체 기간, 갱신 시도 빈도, 점수 하락 같은 흐름은 볼 수 없습니다.
- 크롤링 시점별 상태 복원이 어렵습니다.
- 나중에 더 자세한 분석을 만들고 싶을 때 과거 데이터가 부족할 수 있습니다.

### Option B. 크롤링 snapshot을 모두 저장

장점:

- 사용자의 곡별 성장 추세를 가장 자세히 보여줄 수 있습니다.
- 점수 상승 전 정체 기간, 갱신 빈도, medal 변화만 있는 케이스도 분석할 수 있습니다.
- 나중에 통계 기능을 확장하기 좋습니다.

단점:

- 저장량이 빠르게 늘어납니다.
- 중복 snapshot 제거, 보관 기간, 압축 정책이 필요합니다.
- MVP에서는 구현과 운영 부담이 큽니다.

### Option C. best 변경 이력 + 추후 snapshot 확장

장점:

- MVP 저장량과 구현 부담을 낮출 수 있습니다.
- 성장 그래프의 핵심인 최고 기록 변화는 보존합니다.
- 추후 필요하면 `playdata_snapshots` 또는 `playdata_daily_snapshots`를 추가할 수 있습니다.

단점:

- MVP 기간 동안의 상세 크롤링 이력은 복원할 수 없습니다.
- 나중에 snapshot을 추가하면 그래프 기준이 중간에 바뀔 수 있습니다.

현재는 **Option C**가 현실적입니다. 다만 `playdata_history`에는 최소한 `best_type`, `target_version`, `score_version`, `score`, `rank_code`, `medal_code`, `popclass`, `event_type`, `created_at`을 남겨서 최고 기록 변화 그래프를 만들 수 있게 둡니다.

## 유저 비밀번호와 복구

- 기존 비밀번호 해시는 어떤 salt 정책으로 재해싱할 것인가?
- salt로 `poptomo_id`를 쓰는 정책이 충분한가?
- 이메일 기반 비밀번호 복구 token의 만료 시간은 얼마로 둘 것인가?
- token 재사용 방지와 rate limit을 어떻게 둘 것인가?
- 이메일 인증 전에도 비밀번호 복구를 허용할 것인가?

## 유저 테이블 책임 분리

초기 DB 설계 초안은 `users`에 계정, 프로필, 팝클래스, 크레딧 정보를 함께 두는 안이었습니다. MVP에서는 단순하지만, 장기적으로는 책임이 많아질 수 있습니다.

회의에서는 `users` 단일 테이블로 갈지, 계정/프로필/게임 상태를 분리할지 결정해야 합니다.

### Option A. users 단일 테이블 유지

```text
users
- user_id
- poptomo_id
- password_hash
- email
- email_verified_at
- user_name
- character_name
- comment
- is_hidden
- display_popclass
- potential_popclass
- legacy_popclass
- normal_credit
- extra_credit
- time_play_10_credit
- time_play_16_credit
- role
```

장점:

- MVP 구현이 가장 빠릅니다.
- 유저 프로필 조회 시 join이 필요 없습니다.
- 기존 DB에서 이전하기 쉽습니다.
- 조회 API와 관리자 화면을 단순하게 만들 수 있습니다.

단점:

- 인증 정보, 공개 프로필, 게임 통계 캐시가 한 테이블에 섞입니다.
- 공개 프로필 조회에서도 비밀번호/이메일 컬럼이 있는 테이블을 접근하게 됩니다.
- popclass와 credit처럼 갱신 때 자주 바뀌는 값이 계정 row를 계속 수정합니다.
- 추후 버전별 통계, 시즌별 팝클래스, 프로필 이미지 확장 시 컬럼이 계속 늘어납니다.

적합한 경우:

- MVP 출시 속도가 가장 중요합니다.
- 유저 수와 갱신 빈도가 아직 크지 않습니다.
- 테이블 분리보다 단순한 마이그레이션을 우선합니다.

### Option B. 계정, 프로필, 게임 상태 분리

```text
users
- user_id
- poptomo_id
- password_hash
- email
- email_verified_at
- role
- created_at
- updated_at

user_profiles
- user_id
- user_name
- character_name
- comment
- is_hidden
- profile_image_url
- updated_at

user_game_stats
- user_id
- display_popclass
- potential_popclass
- legacy_popclass
- normal_credit
- extra_credit
- time_play_10_credit
- time_play_16_credit
- updated_at
```

장점:

- `users`는 인증/식별 책임만 가집니다.
- 공개 프로필 조회에서 비밀번호/이메일 컬럼에 접근하지 않아도 됩니다.
- 갱신이 잦은 popclass/credit을 `user_game_stats`로 격리할 수 있습니다.
- 추후 `user_stats_by_version`, 시즌별 통계, 공개 프로필 확장이 쉬워집니다.
- hexagonal architecture에서 account/profile/game stats use case를 나누기 쉽습니다.

단점:

- MVP 구현량이 늘어납니다.
- 유저 조회 API에서 join 또는 조합 로직이 필요합니다.
- 마이그레이션 시 기존 `"user"` row를 여러 테이블로 나누어 적재해야 합니다.
- 모든 유저 생성/삭제/비공개 처리에서 여러 테이블 정합성을 애플리케이션이 보장해야 합니다.

적합한 경우:

- 장기 운영과 오픈소스 공개를 고려합니다.
- 계정 보안 정보와 공개 프로필을 명확히 분리하고 싶습니다.
- popclass/credit 갱신이 자주 일어날 가능성이 큽니다.

### Option C. MVP는 단일 테이블, 마이그레이션 여지 남기기

```text
users
- 계정/프로필/게임 상태를 우선 함께 저장

추후
- user_profiles
- user_game_stats
- user_stats_by_version
```

장점:

- MVP 구현 속도와 장기 확장성을 절충할 수 있습니다.
- 초기 API와 마이그레이션이 단순합니다.
- 실제 갱신 빈도와 화면 요구사항을 본 뒤 분리할 수 있습니다.

단점:

- 나중에 테이블을 나눌 때 추가 마이그레이션이 필요합니다.
- 초기에 잘못 퍼진 API 응답 구조를 다시 바꾸기 어렵습니다.
- “나중에 분리”가 계속 밀리면 `users`가 과도하게 커질 수 있습니다.

적합한 경우:

- MVP 출시가 급하지만, 문서와 코드에서 계정/프로필/게임 상태 경계를 미리 지키고 싶습니다.
- DB는 단일 테이블이어도 application layer에서는 DTO와 use case를 분리할 수 있습니다.

### Option D. users + user_profiles 2테이블 분리

```text
users
- user_id
- poptomo_id
- password_hash
- email
- email_verified_at
- role
- created_at
- updated_at

user_profiles
- user_id
- user_name
- character_name
- comment
- profile_image_url
- is_hidden
- display_popclass
- potential_popclass
- legacy_popclass
- normal_credit
- extra_credit
- time_play_10_credit
- time_play_16_credit
- created_at
- updated_at
```

장점:

- `password_hash`, `email`, `role` 같은 계정/보안 정보가 공개 프로필/랭킹 조회 테이블과 분리됩니다.
- 프로필 화면과 랭킹 화면에서 함께 쓰이는 `character_name`, `display_popclass`, credit을 한 테이블에서 조회할 수 있습니다.
- 3테이블 구조보다 조인과 1:1 row 정합성 부담이 작습니다.
- 단일 `users`보다 헥사고널 아키텍처의 account/profile 책임 경계를 코드와 DB 모두에서 표현하기 쉽습니다.

단점:

- `user_profiles`가 공개 프로필뿐 아니라 랭킹 표시 캐시와 credit까지 포함하므로 이름보다 책임이 조금 넓습니다.
- 유저 생성 시 `users`와 `user_profiles`를 같은 transaction에서 함께 생성해야 합니다.
- 버전별 통계나 credit 이력이 필요해지면 추후 `user_stats_by_version`, `user_credit_history` 같은 테이블을 추가해야 합니다.

`character_name`은 갱신 때 함께 write될 수 있지만, 랭킹/프로필에 표시되는 공개 정보이므로 `user_profiles`에 둡니다. `display_popclass`, `potential_popclass`, credit도 프로필 주변 화면에서 함께 쓰이므로 MVP에서는 `user_game_stats`로 따로 쪼개지 않습니다.

### 현재 결정

MVP는 **Option D. users + user_profiles 2테이블 분리**로 진행합니다.

코드에서는 다음 경계를 지킵니다.

- 인증/계정 use case는 `password_hash`, `email`, `role`만 다룹니다.
- 공개 프로필 use case는 `user_name`, `character_name`, `comment`, `profile_image_url`, `is_hidden`을 다룹니다.
- playdata 갱신 use case는 필요하면 `user_profiles`의 `character_name`, credit, popclass cache를 함께 갱신합니다.
- 랭킹 조회 use case는 `user_profiles`를 기준으로 정렬하고, 필요한 경우 `users.poptomo_id`, `users.role`만 붙입니다.
- API 응답 DTO는 account와 profile 영역을 구분하되, DB에서 `user_profiles`를 다시 profile/stats로 과하게 나누지는 않습니다.

## 회의에서 결정할 질문

1. MVP의 팝클 계산 입력값은 `score`, `medal`, `level`, `chart_version`으로 충분한가?
2. playdata의 source of truth는 `VERSION_BEST`와 `ALL_TIME_BEST` 두 row 구조로 확정할 것인가?
3. 기존 DB 점수는 `ALL_TIME_BEST(score_version = 28)`만 만들 것인가?
4. 현재 버전 기록이 없는 유저의 `display_popclass`는 0으로 둘 것인가, 기존 값을 임시 표시할 것인가?
5. 비밀번호 전환은 legacy 검증 후 점진 업그레이드, 일괄 재해싱, 강제 재설정 중 무엇을 기준으로 할 것인가?
6. `users`와 `user_profiles`를 생성하는 transaction과 누락 row 복구 정책은 어떻게 둘 것인가?
7. `user_profiles`에서 추후 `user_stats_by_version`을 분리할 조건은 무엇인가?
8. 곡별 성장 추세는 MVP에서 best 변경 이력만으로 시작할 것인가, 크롤링 snapshot을 모두 저장할 것인가?
9. 추후 성장 그래프를 위해 `playdata_daily_snapshots` 같은 집계 테이블을 예약해 둘 것인가?
