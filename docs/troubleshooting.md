# 트러블슈팅 기록

이 문서는 `popngg-old`에서 실제로 겪었거나 코드에서 유추한 문제를 남기고, 당시에는 어떻게 완화했는지, 이번 refactor에서는 어떻게 재발을 막을지 정리합니다.

레거시 코드는 참고 자료입니다. 새 프로젝트의 기준은 이 문서와 설계 문서에서 다시 확정합니다.

## 기록 방식

각 항목은 다음 순서로 기록합니다.

| 구분 | 의미 |
| --- | --- |
| 증상 | 사용자가 경험했거나 운영 중 확인한 문제 |
| 원인 추정 | `popngg-old` 코드와 구조에서 유추한 원인 |
| 당시 해결 | 레거시에서 문제를 줄이기 위해 적용한 방식 |
| 신규 반영 | 새 프로젝트에서 처음부터 가져갈 개선안 |
| 확인 기준 | 구현 후 재발하지 않았다고 판단할 수 있는 기준 |

## 1. 전체 플레이데이터 조회가 특정 유저에서 20초 이상 걸림

### 증상

일반 유저는 약 1,000개 수준의 playdata를 조회했지만, 어떤 유저는 5,000개 이상을 가지고 있어 전체 플레이데이터 조회가 20초 이상 걸렸던 것으로 보입니다.

가장 가능성이 높은 API는 팝클표가 아니라 다음 API입니다.

```text
GET /playdata/all/{poptomoId}
GET /secure/playdata/all/{poptomoId}
```

### 원인 추정

초기 구현은 `Playdata` entity 목록을 가져온 뒤 Java service에서 DTO로 변환했습니다.

```java
List<Playdata> playdatas = playdataRepository.findPlaydataByUser(user);

for (Playdata pd : playdatas) {
    pd.getChart().getGenreName();
    pd.getChart().getSongName();
    pd.getChart().getVersion();
}
```

`Playdata.chart`는 `LAZY` 연관입니다. 따라서 row가 많아지면 다음 문제가 겹칠 수 있습니다.

- `playdata` entity를 대량으로 영속성 컨텍스트에 올림
- DTO 변환 중 `chart` 접근으로 N+1 query 발생 가능
- request thread가 DB 조회와 DTO 변환을 오래 점유
- 응답 payload가 커져 network 전송과 JSON serialization 비용 증가

### 당시 해결

커밋 메시지 기준으로 `전체 플레이데이터 수집 속도 향상` 변경이 있었습니다.

Repository에 JPQL constructor projection을 추가해 entity 전체가 아니라 화면에 필요한 DTO 필드만 조회하도록 바꿨습니다.

```java
@Query("select " +
        "new gg.popn.popngg.dto.PlaydataOutputDto(" +
        "pd.chart.genreName, pd.chart.songName, pd.chart.isUpper, " +
        "pd.chart.version, pd.chart.difficulty, pd.chart.level, " +
        "pd.score, pd.medal, pd.rank, pd.popclass, pd.chart.songHash)" +
        "from Playdata pd " +
        "where pd.user = :user")
List<PlaydataOutputDto> findPlaydataByUser(User user);
```

이 방식은 다음 이점이 있었습니다.

- entity hydration 감소
- lazy loading으로 인한 N+1 위험 감소
- DTO 변환 루프 제거
- 조회 결과 크기와 객체 생성 비용 감소

### 신규 반영

새 프로젝트에서는 전체 playdata 조회에 entity 반환을 사용하지 않습니다.

원칙:

- 조회 API는 `QueryService` 또는 query adapter에서 DTO projection으로 반환합니다.
- 기본 조회는 `gameVersion`, pagination 또는 limit을 반드시 가집니다.
- 현재 버전 점수와 역대 최고 점수를 함께 내려줘야 하는 API는 같은 `playdata` row에서 `versionBest`, `allTimeBest`, `medal` 응답 객체를 분리합니다.
- 화면에 필요하지 않은 필드는 반환하지 않습니다.
- `song_hash`가 아니라 `song_id`, `chart_id` 기준으로 join합니다.

권장 API 기준:

```text
GET /users/{poptomoId}/playdata?gameVersion=29&page=0&size=100
```

권장 index:

```sql
KEY idx_playdata_user_scope_chart (
    user_id,
    current_version,
    chart_id
)
```

### 확인 기준

- 5,000개 이상 playdata를 가진 테스트 유저 조회가 목표 시간 안에 끝납니다.
- query count가 row 수에 비례해서 증가하지 않습니다.
- slow query log에 전체 playdata 조회가 반복적으로 남지 않습니다.
- API 응답은 pagination 기준을 지킵니다.

## 2. 랭크/메달 통계 API가 전체 playdata를 애플리케이션에서 계산함

### 증상

레벨별 랭크/메달 count와 평균 점수 조회에서 유저의 전체 playdata를 가져와 Java loop로 집계했습니다.

관련 API:

```text
GET /playdata/rank/{poptomoId}
GET /playdata/medal/{poptomoId}
```

### 원인 추정

초기 구현은 다음 흐름이었습니다.

```java
List<Playdata> playdatas = playdataRepository.findPlaydataByUserOrderByPopclassDesc(user);

for (Playdata pd : playdatas) {
    cnt[pd.getChart().getLevel() - 1][pd.getRank()]++;
    scoreSum[pd.getChart().getLevel() - 1] += pd.getScore();
}
```

문제:

- 통계 결과는 작은데 원본 row는 모두 가져옴
- chart level 접근으로 N+1 가능
- row 수가 많은 유저일수록 service layer CPU와 heap 사용량 증가
- 같은 계산을 요청마다 반복

### 당시 해결

커밋 메시지 기준으로 `랭크/메달 속도 향상` 변경이 있었습니다.

JPQL `group by`, `sum`으로 DB에서 집계하고, service는 결과를 표 형태로 조립하도록 바꿨습니다.

```java
@Query(value = "select " +
        "new gg.popn.popngg.dto.CountChartByLevelAndRankDto(pd.chart.level, pd.rank, count(*)) " +
        "from Playdata pd " +
        "where pd.user = :user " +
        "group by pd.chart.level, pd.rank")
List<CountChartByLevelAndRankDto> countChartByLevelAndRank(User user);

@Query(value = "select " +
        "new gg.popn.popngg.dto.CountChartByLevelAndMedalDto(pd.chart.level, pd.medal, count(*)) " +
        "from Playdata pd " +
        "where pd.user = :user " +
        "group by pd.chart.level, pd.medal")
List<CountChartByLevelAndMedalDto> countChartByLevelAndMedal(User user);
```

### 신규 반영

랭크/메달 집계는 처음부터 DB 집계 또는 summary table 기준으로 설계합니다.

MVP 기준:

- `GET /users/{poptomoId}/playdata/counts`로 통합합니다.
- 기본 응답은 현재 버전 rank count와 유지 medal count를 제공합니다.
- 필요하면 `gameVersion` query parameter로 특정 버전을 조회할 수 있게 합니다.
- entity list를 가져와 Java에서 count하지 않습니다.

권장 API:

```text
GET /users/{poptomoId}/playdata/counts?groupBy=rank
GET /users/{poptomoId}/playdata/counts?groupBy=medal
GET /users/{poptomoId}/playdata/counts?gameVersion=29&groupBy=rank
```

데이터가 더 커지면 다음 summary table을 고려합니다.

```text
user_playdata_counts
```

### 확인 기준

- 집계 API가 원본 playdata row 수만큼 entity를 생성하지 않습니다.
- `group by` query 또는 summary table query만 실행됩니다.
- 5,000개 이상 playdata 유저도 1초 이내 응답을 목표로 합니다.

## 3. 팝클표 조회가 top 50만 필요하지만 전체 정렬 결과를 가져옴

### 증상

팝클표는 상위 50개 playdata만 필요합니다. 하지만 레거시의 현재 코드는 전체 결과를 가져온 뒤 Java에서 50개로 자릅니다.

```java
playdataRepository.findPlaydataByUserAndChart_IsDeletedOrderByPopclassDescScoreDesc(user, 0)
    .stream().limit(50).toList();
```

### 원인 추정

Spring Data method name에 `Top50`이나 `Pageable`이 없기 때문에 SQL에 `limit 50`이 들어간다고 보기 어렵습니다.

즉 정렬은 DB에서 하더라도, 사용자의 전체 playdata를 가져온 뒤 애플리케이션에서 `.limit(50)`을 적용하는 구조입니다.

### 당시 해결

팝클표 자체는 JPQL로 완전히 해결했다기보다, 다음 정도의 개선이 있었던 것으로 보입니다.

- `popclass desc` 기준 정렬을 repository method로 이동
- service에서 상위 50개만 응답 DTO로 조립
- 삭제된 chart를 제외하는 조건 추가

다만 DB 전송량을 top 50으로 줄이는 최종 최적화까지는 적용되지 않았습니다.

### 신규 반영

새 프로젝트에서는 팝클표를 요청마다 전체 정렬하지 않습니다.

갱신 시점에 서버가 다음 값을 계산해 `playdata`에 저장합니다.

- `popclass`
- `is_display_popclass_target`
- `popclass_bucket`
- `popclass_bucket_rank`

조회 시에는 이미 마킹된 row만 가져옵니다.

```sql
SELECT ...
FROM playdata p
WHERE p.user_id = :userId
  AND p.current_version = :gameVersion
  AND p.is_display_popclass_target = true
ORDER BY p.popclass_bucket, p.popclass_bucket_rank;
```

권장 index:

```sql
KEY idx_playdata_user_display_popclass_target (
    user_id,
    current_version,
    is_display_popclass_target,
    popclass_bucket,
    popclass_bucket_rank
)
```

### 확인 기준

- 팝클표 조회 query가 top 대상 row만 읽습니다.
- `EXPLAIN`에서 `idx_playdata_user_display_popclass_target` 또는 동등한 index를 사용합니다.
- 갱신 job 이후 display popclass와 bucket rank가 재계산됩니다.

## 4. 갱신 요청이 request thread와 DB connection을 오래 점유함

### 증상

플레이데이터 갱신은 입력 row를 순회하면서 다음 작업을 한 요청 안에서 처리했습니다.

- chart 조회
- playdata upsert
- history 저장
- user popclass 계산
- renew log 저장

입력 row가 많거나 동시 갱신이 발생하면 request thread, DB connection, heap을 오래 점유할 수 있습니다.

### 원인 추정

레거시 `RenewService`는 요청 처리 흐름 안에서 반복 조회와 저장을 수행했습니다.

문제:

- chart를 row마다 찾음
- playdata를 row마다 찾고 저장함
- transaction이 길어질 수 있음
- 실패 시 어느 row까지 처리됐는지 추적이 어려움
- 사용자 요청과 무거운 갱신 작업의 실행 경계가 분리되지 않음

### 당시 해결

레거시에서는 일부 튜닝과 repository query 개선이 있었지만, 구조적으로 job/worker 모델로 완전히 분리된 것은 아닙니다.

### 신규 반영

새 프로젝트에서는 갱신을 job 단위로 분리합니다.

권장 흐름:

```text
POST /playdata/imports
  -> request validation
  -> import job 생성
  -> job id 반환

worker
  -> chart matching bulk 처리
  -> playdata chunk upsert
  -> history append
  -> popclass target 재계산
  -> user summary 갱신
  -> job status 갱신
```

원칙:

- 같은 `poptomoId`의 import job은 동시에 하나만 실행합니다.
- chunk 단위 transaction을 사용합니다.
- 실패 row는 job result에 남깁니다.
- request thread는 긴 갱신 완료를 기다리지 않습니다.
- 갱신 상태는 `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `PARTIAL`로 조회 가능하게 합니다.

### 확인 기준

- 대량 import 요청이 HTTP timeout에 묶이지 않습니다.
- worker 실패 시 실패 row와 사유를 확인할 수 있습니다.
- 같은 유저의 동시 갱신이 중복 실행되지 않습니다.

## 5. thread pool 고갈로 애플리케이션과 EC2가 함께 불안정해짐

### 증상

지난 백엔드에서 thread pool 문제로 애플리케이션이 멈추거나 EC2까지 같이 꺼지는 상황이 있었다고 보고되었습니다.

### 원인 추정

정확한 장애 로그는 없지만, 레거시 구조와 일반적인 Spring 운영 문제를 기준으로 다음 가능성이 큽니다.

- 무거운 갱신/집계/S3 작업이 request thread 또는 무제한 executor에서 실행
- queue가 bounded가 아니어서 작업이 계속 쌓임
- DB connection pool보다 많은 thread가 DB 작업을 기다림
- timeout 없는 외부 호출이 thread를 오래 점유
- container memory limit과 JVM heap 설정이 맞지 않아 OOM 발생
- EC2 한 대에 여러 프로세스가 있고 memory pressure가 커짐

### 당시 해결

레거시에서 thread pool 경계를 체계적으로 분리한 흔적은 명확하지 않습니다. 따라서 이번 프로젝트에서는 장애 재현보다 예방 설계를 우선합니다.

### 신규 반영

executor를 작업 성격별로 분리하고, 모든 queue를 bounded로 둡니다.

| Executor | 용도 | 기준 |
| --- | --- | --- |
| request thread | HTTP 요청 처리 | 긴 작업 금지 |
| `playdataRefreshExecutor` | playdata import, popclass 재계산 | 작은 queue, 명시적 reject |
| `externalCallExecutor` | S3, 외부 HTTP | timeout 필수 |
| scheduler/worker | 주기 작업, BOT 데이터 재계산 | request path와 분리 |

운영 기준:

- `ThreadPoolExecutor.AbortPolicy` 또는 명시적인 backpressure를 사용합니다.
- queue depth, active thread, rejected count를 Prometheus로 수집합니다.
- Tomcat busy thread, JVM live thread, DB pool active count를 대시보드에 올립니다.
- container memory limit과 JVM `Xmx`를 함께 설정합니다.
- 무거운 작업은 request thread에서 직접 실행하지 않습니다.

### 확인 기준

- executor별 active/queue/rejected metric이 Grafana에서 보입니다.
- 부하 테스트에서 thread count가 무한히 증가하지 않습니다.
- DB pool exhaustion 시 요청이 무한 대기하지 않고 실패하거나 재시도 정책으로 이동합니다.

## 6. `song_hash`가 장르명/곡명 변경에 취약함

### 증상

레거시는 `genreName + songName + version` 기반으로 `song_hash`를 만들었습니다. 기존에는 장르명과 제목이 불변이라고 가정했지만, High☆Cheers 이후 이 가정이 깨졌습니다.

장르명이 없는 판권곡은 `genre_name` 컬럼에 제목과 동일한 문자열을 넣었던 것으로 확인되었습니다.

### 원인 추정

`song_hash`가 내부 식별자처럼 사용되면 다음 문제가 생깁니다.

- 장르명 또는 곡명 변경 시 같은 곡이 다른 곡처럼 보임
- 이미지, playdata, history, cache가 변경 가능한 문자열에 종속됨
- songhash 변경 API가 없으면 보정이 어려움

### 당시 해결

레거시는 일부 예외 곡에 대해 hash 생성 로직에서 특수 처리를 했습니다.

```text
MD5(genreName + songName + version + optionalUpperMarker)
```

하지만 이 방식은 예외가 늘어날수록 유지보수가 어려워집니다.

### 신규 반영

내부 식별자는 `song_id`, `chart_id`를 사용합니다.

`song_hash`는 외부 호환 또는 matching alias로만 사용합니다.

원칙:

- `playdata`, `history`, image, search index, cache는 `song_hash`에 직접 종속되지 않습니다.
- 곡 표시 정보 변경 API를 둡니다.
- 변경 전후 hash mapping을 남깁니다.
- matching 실패 row를 관리자 또는 migration 검증에서 확인할 수 있게 합니다.

### 확인 기준

- 곡명/장르명 변경 후에도 기존 playdata와 history가 유지됩니다.
- `song_hash` 변경이 cache key, image key, search index를 깨뜨리지 않습니다.

## 7. song_hash 변경으로 S3 자켓 key가 함께 바뀌어야 함

### 증상

레거시에서는 곡마다 존재하는 자켓을 S3에 기존 `songHash` 값을 제목/key로 저장했습니다. 이번 리팩토링에서는 `songHash` 생성 방식이 바뀌므로 모든 곡의 자켓 key도 새 기준으로 다시 만들어야 합니다.

또한 추후 곡 메타데이터 보정으로 특정 곡의 `songHash`가 바뀌면, 해당 곡의 자켓도 신규 `songHash` key로 접근 가능해야 합니다.

### 원인 추정

S3 자켓 key가 변경 가능한 외부 alias인 `songHash`에 묶여 있었습니다.

문제:

- `songHash`가 바뀌면 기존 S3 key와 DB의 `jacketUrl`이 어긋날 수 있음
- S3에는 일반 파일시스템의 rename 개념이 없고, 사실상 copy 후 delete에 가까움
- 기존 object를 바로 삭제하면 마이그레이션 검증과 롤백이 어려움

### 당시 해결

레거시에서는 기존 `songHash`를 안정적인 값으로 보고 S3 key로 사용했습니다.

### 신규 반영

정책:

- 마이그레이션 시 모든 곡의 신규 `songHash`를 계산합니다.
- 기존 S3 key에서 자켓을 읽어 신규 `songHash` 기반 key로 copy 또는 upload합니다.
- DB의 `songs.jacket_url` 또는 `jacket_key`를 신규 key로 갱신합니다.
- 기존 S3 object는 즉시 삭제하지 않고 검증/롤백 기간 이후 정리합니다.
- 추후 `songHash`가 변경되는 곡도 동일하게 신규 key에 자켓을 새로 저장하고 DB 참조를 전환합니다.

예시:

```text
legacy key: jackets/{oldSongHash}.png
new key:    jackets/{newSongHash}.png
```

### 확인 기준

- old/new songHash mapping과 old/new jacket key mapping이 산출물로 남습니다.
- 모든 `songs.jacket_url` 또는 `jacket_key`가 신규 key를 가리킵니다.
- 신규 key object 수가 마이그레이션 대상 자켓 수와 일치합니다.
- 기존 key는 검증/롤백 기간 동안 보존됩니다.

## 8. 점수와 메달이 항상 같은 플레이 결과라고 가정할 수 없음

### 증상

실험 결과, LONG POP OFF로 95,000점을 기록한 뒤 LONG POP ON으로 90,000점을 기록하면 점수는 95,000점으로 남고 메달만 바뀔 수 있습니다.

### 원인 추정

게임 원천 데이터가 `score`는 최고 점수 기준, `medal`은 최신 또는 별도 clear 상태 기준으로 저장할 수 있습니다.

따라서 서버가 `score`만 보고 `rank`나 `medal`을 재계산하면 실제 게임 상태와 달라질 수 있습니다.

### 당시 해결

레거시는 rank, medal을 정수 코드로 저장했지만, 일부 로직에서는 score 기반 계산과 원천 코드 저장이 섞여 있었습니다.

### 신규 반영

원천 데이터 정책:

- `score`는 원천에서 받은 점수를 저장합니다.
- `rank_code`는 score로 계산하지 않고 원천에서 받은 값을 저장합니다.
- `medal_code`도 원천에서 받은 값을 저장합니다.
- 서버는 LONG POP ON/OFF를 임의로 추론해 보정하지 않습니다.
- popclass가 “유지된 최고 score + 최신 medal” 조합에 어떻게 반응하는지는 추가 실험으로 확정합니다.

### 확인 기준

- 같은 score라도 원천 rank가 다르면 원천 rank를 보존합니다.
- LONG POP 실험 케이스가 테스트로 남아 있습니다.
- score와 medal이 함께 상승한다는 전제의 코드를 만들지 않습니다.

## 9. 운영/배포 기준이 수동 jar 교체와 오래된 환경 기준에 가까움

### 증상

레거시 운영 기준은 jar 교체, 앱 내부 SSH tunnel, 불명확한 migration 흐름에 가까웠습니다.

### 원인 추정

배포 산출물, schema migration, health check, smoke test가 명확히 분리되지 않으면 다음 문제가 생깁니다.

- 어느 버전이 배포되었는지 추적이 어려움
- migration 실패와 애플리케이션 실패를 구분하기 어려움
- rollback 기준이 불명확함
- 로그와 metric이 분산되어 장애 원인 추적이 늦어짐

### 당시 해결

레거시 기준에서는 운영 자동화가 제한적이었습니다.

### 신규 반영

두 대 서버 기준으로 운영합니다.

| 서버 | 역할 |
| --- | --- |
| 서버 1 | Jenkins, Prometheus, Grafana, Loki, Alertmanager, Grafana Alloy |
| 서버 2 | Spring Boot, MySQL, Redis, Grafana Alloy, node exporter |

배포 흐름:

```text
Git push
-> Jenkins
-> test
-> build
-> Docker image build
-> Flyway migration
-> deploy
-> health check
-> smoke test
```

로그/모니터링:

- Prometheus: metric 수집
- Grafana: dashboard
- Loki: log 저장
- Grafana Alloy: log/metric 수집 agent
- Alertmanager: alert routing

### 확인 기준

- Jenkins 배포 단계가 test/build/image/migration/deploy/health/smoke로 분리됩니다.
- 배포 실패 시 어느 단계에서 실패했는지 바로 확인할 수 있습니다.
- 애플리케이션 로그가 Loki에서 `requestId` 기준으로 추적됩니다.
- JVM, DB pool, executor, HTTP latency dashboard가 있습니다.

## 10. 검색을 클라이언트 전체 데이터 검색에 의존함

### 증상

기존에는 프론트에 모든 데이터를 내려주고 클라이언트에서 직접 검색해 빠른 경험을 제공했습니다.

데이터가 늘어나면 다음 문제가 생깁니다.

- 초기 payload 증가
- 모바일/저사양 환경에서 검색 성능 저하
- 검색 ranking, typo tolerance, alias 반영이 어려움
- song/chart 변경 시 프론트 캐시와 서버 데이터 정합성 관리가 어려움

### 당시 해결

레거시에서는 클라이언트 검색으로 빠른 체감을 얻었습니다.

### 신규 반영

검색은 서버 책임으로 옮기되, live search 경험은 유지합니다.

MVP 기준:

- Redis 기반 search read model/cache를 우선 고려합니다.
- 요청 debounce와 최소 검색어 길이를 둡니다.
- 서버 응답은 빠른 list item DTO만 반환합니다.
- song/chart 변경 시 search index rebuild 또는 cache invalidation 경로를 둡니다.

추후 확장:

- 검색 조건, typo tolerance, ranking이 복잡해지면 OpenSearch/Elasticsearch 도입을 검토합니다.

### 확인 기준

- live search p95 latency 목표를 정하고 측정합니다.
- 검색 index rebuild 절차가 있습니다.
- `song_hash` 변경이 검색 결과 정합성을 깨뜨리지 않습니다.

## 신규 프로젝트 공통 체크리스트

| 항목 | 확인 기준 |
| --- | --- |
| 대량 조회 | entity list 반환 대신 DTO projection/query model 사용 |
| 집계 | Java loop 대신 DB 집계 또는 summary table 사용 |
| 팝클표 | 전체 정렬 대신 미리 마킹된 top 대상 조회 |
| 갱신 | request thread에서 긴 import를 직접 처리하지 않음 |
| Thread pool | bounded queue, timeout, metric, reject policy 정의 |
| 식별자 | 내부 참조는 `song_id`, `chart_id` 사용 |
| 원천값 | rank/medal은 score로 재계산하지 않음 |
| 운영 | Jenkins, Docker, Flyway, health, smoke test 분리 |
| 관측 | Prometheus, Grafana, Loki, Alloy 기준 적용 |

## 다음에 추가할 항목

새로운 문제를 발견하면 아래 형식으로 추가합니다.

```markdown
## N. 문제 제목

### 증상
### 원인 추정
### 당시 해결
### 신규 반영
### 확인 기준
```
