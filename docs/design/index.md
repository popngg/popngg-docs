# 설계

이 섹션은 백엔드 구조, DB 모델, 마이그레이션, 의사결정 기록을 정리합니다.

## 문서

- [아키텍처](../architecture.md)
- [기존 DB 구조 추정](../legacy-db-inference.md)
- [MVP DB 설계 초안](../mvp-db-design.md)
- [데이터 모델링](../data-modeling.md)
- [마이그레이션 계획](../migration-plan.md)
- [의사결정 기록](../decisions.md)

## 설계 원칙

- 기존 서비스의 핵심 조회 패턴은 유지합니다.
- `song`과 `chart`를 분리합니다.
- DB foreign key constraint는 만들지 않습니다.
- 참조 정합성은 애플리케이션 검증, unique key, index, 정합성 점검 쿼리로 보완합니다.
- 대량 데이터 이전은 Flyway가 아니라 별도 job/script로 분리합니다.

