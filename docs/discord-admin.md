# Discord 관리자 기능

Discord integration은 서명된 interaction을 `POST /api/v1/discord/interactions`로 받습니다. 설정된 guild와 관리자 role만 명령을 실행할 수 있습니다.

## 명령

- `/곡추가`: 자켓, 날짜, 곡명, 장르, 아티스트, 버전, L/N/H/EX 레벨, UPPER 여부를 받아 곡을 추가합니다.
- `/곡수정`: `song_id`와 변경할 필드만 받아 기존 곡을 수정합니다.
- `/곡조회 검색어:<text>`: catalog를 검색합니다.
- `/미등록목록`: 최근 갱신에서 매칭되지 않은 곡을 표시하고 곡 추가 양식으로 연결합니다.

채보 입력은 `N:30,H:42,EX:48` 형식이며 UPPER 채보는 앞에 `UPPER`를 붙입니다. 곡 추가와 수정은 JSON 미리보기 확인 후 실행되고 draft는 15분 뒤 만료됩니다. 자켓은 직사각형도 허용하며 원본 비율을 유지합니다.

## 알림

- catalog와 관리자 작업: `DISCORD_ADMIN_WEBHOOK_URL`
- 예기치 않은 API 5xx: `DISCORD_ERROR_WEBHOOK_URL`
- GitHub PR, merge, CI, 배포: Actions secret `DISCORD_ADMIN_WEBHOOK_URL`

같은 HTTP method, path, exception 조합의 오류 알림은 5분간 중복 억제합니다. request body, cookie, authorization 값, query string은 오류 알림에 포함하지 않습니다.

갱신 중 매칭되지 않은 곡은 `unknown_chart_reports`에 누적됩니다. 원천 페이지에서 신뢰할 수 없는 난이도와 UPPER 여부는 주장하지 않고 null로 저장하며, 곡명·장르명·아티스트명 단위로 병합합니다.

## 자켓 저장

자켓은 PNG로 변환해 다음 위치에 저장합니다.

```text
s3://${AWS_S3_BUCKET}/${AWS_S3_JACKET_PREFIX}/{songHash}.png
```

DB에는 CloudFront URL을 저장합니다. 기존 자켓 교체 전에는 기존 object를 backup합니다.
