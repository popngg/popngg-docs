# 의사결정 기록

확정되지 않은 내용은 `Proposed`로 두고, 합의되면 `Accepted`로 바꿉니다.
레거시 코드는 결정의 참고 자료일 뿐이고, 최종 판단은 신규 설계와 현재 요구사항을 기준으로 합니다.

## ADR-001: DB FK 제거

- 상태: Proposed
- 결정: DB foreign key를 제거한다.
- 이유: 강제 cascading과 FK 유지 비용이 현재 기대 리턴보다 크다.
- 영향: 애플리케이션 저장 로직과 정합성 점검 쿼리가 더 중요해진다.

## ADR-002: chart와 song 분리

- 상태: Proposed
- 결정: 곡 메타데이터는 `song`, 난이도별 채보 정보는 `chart`에 둔다.
- 이유: 장르명, 곡명, 자켓 같은 곡 단위 정보와 난이도/레벨/판정/채보 등장 버전 정보를 분리하기 위함.
- 영향: 기존 `chart.song_hash` 기반 조회는 `song -> chart` join으로 바뀐다.
- 영향: `songs.version`은 원곡 또는 곡 그룹의 최초 수록 버전으로 두고, Upper처럼 나중에 추가될 수 있는 채보의 등장 버전은 `charts.chart_version`에 저장한다.

## ADR-003: songhash 생성 규칙

- 상태: Open
- 후보:
  - 곡명 + 작곡가 + Upper
  - 장르명 + 곡명 + 작곡가 + Upper
  - 장르명 + 곡명 + 작곡가 + Upper + 버전
- 다음 액션: 실제 데이터로 후보별 중복을 확인한다.

## ADR-004: 비밀번호 찾기 방식

- 상태: Accepted
- 결정: 이메일 기반 비밀번호 복구를 제공한다.
- 이유: 질문/답 방식보다 보안성과 운영성이 낫고, 이번 MVP 범위에 포함하기로 했다.
- 영향: 이메일 인증/발송 인프라가 필요하다.
- 영향: `users.email`, `users.email_verified_at`, `password_reset_tokens`가 필요하다.

## ADR-005: 짠판정/짠게이지 위치

- 상태: Open
- 후보:
  - Song metadata
  - Chart metadata
- 권장: 난이도별 차이가 가능하면 Chart metadata에 둔다.

## ADR-006: 프론트 데이터 가공 제거

- 상태: Proposed
- 결정: 프론트가 계산/그룹핑하지 않도록 백엔드 API 응답에 표시용 데이터를 포함한다.
- 이유: 클라이언트별 중복 로직을 줄이고 정책 변경을 서버에서 통제한다.
- 영향: application service와 response DTO가 더 풍부해진다.

## ADR-007: High☆Cheers를 리팩토링 기준 버전으로 사용

- 상태: Accepted
- 결정: 이번 리팩토링은 `pop'n music High☆Cheers!!` 기준으로 게임 시스템을 설계한다.
- 이유: High☆Cheers에서 장르명 표기 부활, 랭크 변경, 난이도 표시 변경이 발생했다.
- 영향: `rank`, `difficulty`, `song` 표시 정보는 버전별 정책 변경을 견딜 수 있어야 한다.

## ADR-008: 랭크는 점수로 계산하지 않고 원천 데이터에서 수집한다

- 상태: Accepted
- 결정: 서버 내부에서 `score`로 `rank`를 산출하지 않는다. 갱신/크롤링 시 원천 데이터의 랭크를 함께 수집해서 `playdata.rank_code`로 저장한다.
- 이유: High☆Cheers 랭크는 clear 여부에 따라 달라질 수 있어 점수만으로 정확히 판단할 수 없다.
- 영향: 갱신 코드와 수동 업로드 API는 rank를 필수 데이터로 다뤄야 한다.
- 영향: `rank_policy`의 점수 구간은 표시/정렬/검증용 참고값이며, 핵심 판정 로직이 아니다.

## ADR-009: playdata는 버전 베스트와 역대 베스트를 분리한다

- 상태: Accepted
- 결정: `playdata`는 `best_type`, `target_version`, `score_version`을 저장해 현재 버전 베스트와 역대 베스트를 분리한다.
- 이유: High☆Cheers에서 처음으로 기존 점수 초기화가 확인되었고, 이후 다른 버전에서도 같은 정책이 반복될 수 있으므로 버전 베스트와 역대 베스트를 일반 구조로 저장해야 하기 때문이다.
- 영향: 기존 DB의 플레이데이터는 28버전 기록으로 마이그레이션한다.
- 영향: 앞으로 크롤링한 점수는 현재 버전에서 나온 기록으로 저장한다.
- 영향: 유저 팝클은 현재 버전 `VERSION_BEST` 기준으로 계산한다.
- 영향: 조회 API는 현재 버전 전용 화면과 비교/상세 화면을 구분해 `VERSION_BEST`와 `ALL_TIME_BEST`를 명시적으로 내려줘야 한다.
- 열린 질문: 기존 playdata를 28버전 `VERSION_BEST` row로도 복제할지, MVP에서는 `ALL_TIME_BEST`만 보존할지 결정해야 한다.

## ADR-010: 팝클 산정 대상 bucket은 서버가 계산해 playdata에 마킹한다

- 상태: Accepted
- 결정: 크롤러는 `popclass_bucket`을 보내지 않는다. 서버가 playdata 갱신 후 `charts.chart_version` 기준으로 이번 버전 채보 20개, 구버전 채보 40개를 선정해 `playdata`에 산정 대상과 bucket 순위를 마킹한다.
- 이유: 팝클 산정 대상 여부는 단일 row 원천값이 아니라 유저의 전체 playdata 정렬 결과로 결정되기 때문이다.
- 이유: 같은 song이라도 Upper가 나온 버전은 다를 수 있으므로, `songs.version`으로 신곡/구곡을 판단하면 bucket이 틀릴 수 있다.
- 영향: `/playdata/popclass/{poptomoId}`는 매번 전체 정렬하지 않고 마킹된 row를 우선 조회할 수 있다.
- 영향: playdata 갱신 job은 upsert 이후 bucket 마킹 재계산을 필수 후속 step으로 가져야 한다.

## ADR-011: songhash는 내부 참조 기준으로 사용하지 않는다

- 상태: Accepted
- 결정: `song_hash`는 외부 조회 alias로 취급하고, 내부 영속 데이터와 변경 API는 `song_id`, `chart_id`를 기준으로 연결한다.
- 이유: 기존에는 장르명과 제목이 불변이라고 가정했지만, High☆Cheers 이후 장르명/제목/작곡가 같은 표시 메타데이터가 보정될 수 있다. 기존 데이터에서는 장르명이 없던 곡의 `genreName`에 제목과 같은 문자열을 넣어왔으므로 장르명도 안정적인 식별자가 아니다.
- 영향: `playdata`, `playdata_history`, 이미지, 검색 index, cache는 `song_hash`에 직접 종속되지 않아야 한다.
- 영향: 곡 메타데이터 변경 API는 `songId`를 사용하고, songhash가 바뀌면 old/new mapping 또는 alias를 남긴다.

## ADR-012: 기존 credit/코인수는 마이그레이션에서 초기화한다

- 상태: Accepted
- 결정: 기존 DB의 `normal_credit`, `battle_credit`, `local_credit` 값은 신규 High☆Cheers credit으로 매핑하지 않고 0으로 초기화한다.
- 이유: High☆Cheers 기준 credit 체계가 기존 3종과 다르고, 기존 코인수를 새 시즌 값처럼 보존하면 사용자에게 잘못된 상태를 보여줄 수 있다.
- 영향: 신규 `normal_credit`, `extra_credit`, `time_play_10_credit`, `time_play_16_credit`는 초기값 0으로 시작하고, 이후 크롤링/갱신으로 채운다.
