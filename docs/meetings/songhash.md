# songhash 생성 규칙

High☆Cheers에서 장르명이 다시 표시되고, 기존 곡의 장르명도 바뀔 수 있습니다. 따라서 기존 `songhash = 장르명 + 곡명 + 버전` 계열 규칙은 장르명 변경에 취약할 수 있습니다.

크롤링 시점에서 같은 곡/채보를 안정적으로 판별하려면 실제 데이터로 후보별 유니크 여부를 확인해야 합니다.

## 후보

| 옵션 | 구성 | 확인할 것 |
| --- | --- | --- |
| Option 1 | 곡명 + 작곡가 + Upper | 장르명 변경에 강한지, 동명/동작곡가 충돌이 있는지 |
| Option 2 | 장르명 + 곡명 + 작곡가 + Upper | 현재 표시 정보와 잘 맞는지, 장르명 변경 시 hash가 흔들리는지 |
| Option 3 | 장르명 + 곡명 + 작곡가 + Upper + 버전 | 충돌은 줄어드는지, 버전 정정이나 Upper 등장 버전 차이 때문에 hash가 바뀌는지 |

## 회의에서 결정할 질문

1. `songhash`는 곡 단위 식별자인가, 채보 그룹 단위 식별자인가?
2. Upper를 같은 song의 chart로 둘 경우 `Upper`를 hash seed에 넣을 것인가?
3. 장르명은 표시/검색 필드로만 쓰고 hash seed에서는 제외할 것인가?
4. `version`은 `songs.version`을 쓸 것인가, `charts.chart_version`을 쓸 것인가?
5. 크롤링 데이터에서 artistName을 안정적으로 얻을 수 있는가?
6. old/new songhash mapping을 어떤 파일 또는 테이블로 남길 것인가?

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
