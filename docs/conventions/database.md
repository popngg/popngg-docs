# DB 컨벤션

## 이름

- 테이블명은 소문자 복수형을 우선합니다. 예: `users`, `songs`, `charts`
- 예약어를 테이블명으로 쓰지 않습니다.
- boolean 컬럼은 `is_hidden`, `is_deleted`처럼 의미가 드러나게 씁니다.
- 코드 컬럼은 `rank_code`, `medal_code`, `difficulty_code`처럼 suffix를 붙입니다.

## 제약

- DB foreign key constraint는 만들지 않습니다.
- 필요한 unique key와 index는 명시합니다.
- 참조 정합성은 애플리케이션 검증과 정합성 점검 쿼리로 보완합니다.

## Migration

- Flyway를 사용합니다.
- 운영에 적용된 `V*.sql`은 수정하지 않습니다.
- 변경은 새 버전 파일로 추가합니다.
- 대량 데이터 이전은 Flyway보다 별도 job/script를 사용합니다.
- 구조 변경이 큰 마이그레이션은 테이블 단위로 과도하게 쪼개지 않고, schema baseline/data transform/cutover 같은 큰 세션 단위로 관리합니다.
