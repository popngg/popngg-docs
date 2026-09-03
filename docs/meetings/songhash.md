# songHash 생성 규칙

## 확정 정책

곡 생성 요청의 `songHash` 값은 사용하지 않습니다. 백엔드는 `genreName`, `songName`, `artistName`, 곡의 최초 수록 버전(`debutVersion`)으로 canonical 문자열을 만들고 SHA-256을 계산합니다.

각 문자열 필드는 다음 순서로 정규화합니다.

1. Unicode NFC로 정규화합니다.
2. 앞뒤 공백을 제거합니다.
3. 연속된 공백 문자를 한 칸으로 합칩니다.
4. `Locale.ROOT` 기준으로 소문자화합니다.

필드 결합 시 필드명과 줄바꿈으로 경계를 구분합니다. 현재 canonical 형식은 다음과 같습니다.

```text
popngg-song:v2
genre={normalizedGenreName}
title={normalizedSongName}
artist={normalizedArtistName}
debutVersion={version}
```

결과는 64자리 소문자 SHA-256 16진수 문자열입니다. `songHash`는 URL 또는 화면 key로 사용할 수 있지만, 내부 영속 식별자와 React key 및 상세 URL에는 `songId`를 우선합니다.

High☆Cheers에서 장르명이 다시 표시되고, 기존 곡의 장르명도 바뀔 수 있습니다. 기존 데이터에서는 장르명이 없던 곡의 `genreName`에 제목과 동일한 문자열을 넣어왔으므로, `genreName == songName`은 안정적인 식별 근거가 아닙니다.

기존에는 장르명과 제목이 불변이라고 가정했지만, 이제는 장르명/제목/작곡가 같은 표시 메타데이터가 바뀔 수 있다고 봐야 합니다. 따라서 기존 `songhash = 장르명 + 곡명 + 버전` 계열 규칙은 장르명 변경뿐 아니라 제목 보정에도 취약할 수 있습니다.

크롤링 시점에서 같은 곡/채보를 안정적으로 판별하려면 실제 데이터로 후보별 유니크 여부를 확인해야 합니다.

## 검토했던 후보

| 옵션 | 구성 | 확인할 것 |
| --- | --- | --- |
| Option 1 | 곡명 + 작곡가 + Upper | 장르명 변경에 강한지, 동명/동작곡가 충돌이 있는지 |
| Option 2 | 장르명 + 곡명 + 작곡가 + Upper | 현재 표시 정보와 잘 맞는지, 장르명 변경 시 hash가 흔들리는지 |
| Option 3 | 장르명 + 곡명 + 작곡가 + Upper + 버전 | 충돌은 줄어드는지, 버전 정정이나 Upper 등장 버전 차이 때문에 hash가 바뀌는지 |

## 설계 기준

- 내부 참조는 `song_id`, `chart_id`를 우선합니다.
- `songhash`는 외부 조회 alias로 취급하고, 영속 데이터의 참조 기준으로 쓰지 않습니다.
- `playdata`, `history`, jacket/image, 검색 index, cache는 `songhash`가 아니라 내부 id에 종속되게 설계합니다.
- 곡 메타데이터 변경 API는 `song_id`로 대상을 지정합니다.
- 변경 결과로 songhash가 바뀌면 old/new mapping 또는 alias를 남깁니다.

## 후속 검토 질문

1. `songhash`는 곡 단위 식별자인가, 채보 그룹 단위 식별자인가?
2. Upper를 같은 song의 chart로 둘 경우 `Upper`를 hash seed에 넣을 것인가?
3. 장르명은 표시/검색 필드로만 쓰고 hash seed에서는 제외할 것인가?
4. `version`은 `songs.version`을 쓸 것인가, `charts.chart_version`을 쓸 것인가?
5. 크롤링 데이터에서 artistName을 안정적으로 얻을 수 있는가?
6. old/new songhash mapping을 어떤 파일 또는 테이블로 남길 것인가?
7. 기존 songhash URL을 새 songhash로 redirect 또는 alias 처리할 것인가?

## 검증 쿼리 초안

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
