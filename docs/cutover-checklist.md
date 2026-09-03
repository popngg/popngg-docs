# MVP 전환 당일 체크리스트

이 문서는 운영 전환 담당자가 위에서 아래로 실행하는 runbook입니다. 각 단계의 담당자,
시작/종료 시각, 실행 결과와 산출물 위치를 전환 기록에 남깁니다. 비밀번호, 토큰, dump
원문, 개인정보와 민감 header는 기록하지 않습니다.

## 전환 기록

| 항목 | 기록 |
| --- | --- |
| 전환 일시 | |
| 작업 책임자 / 승인자 | |
| 배포 image repository / immutable tag 또는 digest | |
| 이전 image tag 또는 digest | |
| DB backup 식별자와 복구 확인 결과 | |
| migration 실행 ID | |
| verification report 위치 | |
| 배포 로그 위치 | |
| smoke test report 위치 | |
| 최종 판정 | `GO`, `ROLLBACK`, `HOLD` |

smoke test 결과는 배포 job의 실행 결과와 같은 보존 위치에 `smoke-test-<실행
시각>.md` 또는 동등한 CI artifact로 저장합니다. 상태 코드, 성공/실패 항목, row count와
실패 유형만 기록하고 인증정보나 응답 원문은 저장하지 않습니다.

## 0. 시작 조건

- [ ] 변경 승인과 전환 시간대를 확인했다.
- [ ] 동일 환경의 동시 배포 lock을 획득했다.
- [ ] 운영 배포 image가 `latest`가 아닌 commit SHA, release tag 또는 digest로 고정됐다.
- [ ] 이전 정상 image tag/digest와 rollback 명령을 기록했다.
- [ ] Docker, MySQL 8, disk, CPU와 memory 여유를 확인했다.
- [ ] 전환 중 쓰기 중단과 사용자 공지가 적용됐다.

중단 기준: lock 획득 실패, immutable image 식별 불가, rollback image 부재, 자원 부족이면
전환을 시작하지 않고 `HOLD`로 기록합니다.

## 1. DB backup과 복구 가능성 확인

- [ ] 운영 DB의 일관된 backup을 생성했다.
- [ ] backup 파일 크기, checksum과 보관 위치를 기록했다.
- [ ] 별도 격리 DB에서 restore 절차를 확인했다.
- [ ] 기존 DB와 asset은 rollback 기간 동안 삭제하지 않도록 보호했다.

중단 기준: backup 생성 또는 restore 확인 실패 시 이후 migration을 실행하지 않습니다.

## 2. Migration precheck

- [ ] 대상 DB endpoint와 schema가 올바른지 확인했다.
- [ ] Flyway schema history와 현재 version을 확인했다.
- [ ] migration checksum 충돌과 pending migration을 확인했다.
- [ ] 데이터 transform 입력 row count와 예상 산출 row count를 기록했다.
- [ ] old/new user, song, chart, playdata mapping 저장 위치를 확인했다.
- [ ] 실패 row report를 쓸 수 있고 민감정보가 masking되는지 확인했다.

중단 기준: schema version 불일치, checksum 오류, mapping 저장 불가, 예상하지 못한 row
count 차이가 있으면 `HOLD`로 전환합니다.

## 3. Flyway schema migration

- [ ] 애플리케이션 배포와 분리된 one-shot migration 단계로 Flyway를 실행했다.
- [ ] migration 컨테이너 또는 job이 종료 코드 0으로 끝났다.
- [ ] `flyway_schema_history`의 version, checksum과 success 상태를 확인했다.
- [ ] 애플리케이션 컨테이너의 자동 Flyway 실행이 비활성화됐는지 확인했다.

중단 기준: migration 실패 시 애플리케이션을 배포하지 않습니다. 이미 적용된 DDL을 임의로
되돌리지 않고 backup 복구 또는 승인된 forward fix 절차를 선택합니다.

## 4. Final data sync

- [ ] 쓰기 중단 이후의 최종 source snapshot을 확정했다.
- [ ] 별도 migration job/script로 최종 데이터 transform을 실행했다.
- [ ] 성공, 실패, skip row count와 실패 유형별 count를 기록했다.
- [ ] old/new mapping과 실패 row report가 생성됐는지 확인했다.
- [ ] 재실행 시 중복 적재되지 않는지 확인했다.

중단 기준: 실패 row가 허용 기준을 넘거나 mapping이 유실되면 배포하지 않습니다.

## 5. Verification SQL

- [ ] source/target row count를 비교했다.
- [ ] user/profile, song/chart, playdata/history orphan이 0건인지 확인했다.
- [ ] unique 제약 위반이 0건인지 확인했다.
- [ ] playdata version, score, rank와 medal 보존 정책을 확인했다.
- [ ] legacy/potential/display popclass 검증을 통과했다.
- [ ] 신규 credit 4종이 정책대로 초기화됐는지 확인했다.
- [ ] 검증 결과를 비민감 report로 저장하고 승인자가 확인했다.

중단 기준: 필수 검증 항목이 하나라도 실패하면 `HOLD` 또는 DB backup 복구를 선택합니다.

## 6. Docker deploy

- [ ] 검증된 immutable image를 pull했다.
- [ ] 환경변수와 secret이 파일, 명령 출력과 로그에 노출되지 않는지 확인했다.
- [ ] migration 성공을 선행 조건으로 API 컨테이너를 교체했다.
- [ ] 컨테이너 상태, restart count와 JSON stdout log를 확인했다.
- [ ] 실행 중인 image digest가 전환 기록과 일치하는지 확인했다.

## 7. Health check

- [ ] 공개 `/health`가 제한 시간 내 성공 응답을 반환했다. 전체 Actuator health는 내부 관리 포트에서 확인했다.
- [ ] DB connection pool과 migration 상태가 정상이다.
- [ ] 예외율, latency, container restart/OOM과 disk 사용량에 이상이 없다.

중단 기준: health check가 재시도 한도를 넘으면 이전 immutable image로 rollback하고 DB
호환성을 다시 확인합니다.

## 8. Smoke test

- [ ] 공개 곡 목록/검색을 조회했다.
- [ ] 공개 유저 랭킹과 프로필을 조회했다.
- [ ] 전용 smoke 계정으로 로그인/로그아웃을 확인했다.
- [ ] 전용 smoke 계정으로 playdata import를 실행했다.
- [ ] import 후 유저 playdata, `versionBest`, `allTimeBest`, `medal`을 확인했다.
- [ ] 대상 chart ranking 반영을 확인했다.
- [ ] 비밀번호 복구 요청은 계정 존재 여부를 노출하지 않는지 확인했다.
- [ ] 상태 코드와 성공/실패 요약을 smoke test report에 기록했다.

실사용자 계정이나 운영 개인정보는 smoke test 입력으로 사용하지 않습니다. 쓰기 smoke는
언제든 제거할 수 있는 전용 계정에서만 수행합니다.

## 9. GO / rollback 판정

GO 조건:

- [ ] migration, data sync, verification, deploy, health와 smoke가 모두 성공했다.
- [ ] 운영 지표에 신규 오류나 급격한 latency 증가가 없다.
- [ ] 전환 기록과 artifact 위치를 승인자가 확인했다.

Rollback 조건:

- [ ] 이전 immutable image를 배포한다.
- [ ] 신규 schema와 이전 image의 호환 여부를 확인한다.
- [ ] 호환되지 않으면 승인된 DB backup restore 절차를 수행한다.
- [ ] rollback 후 health와 read-only smoke를 다시 실행한다.
- [ ] 원인, 영향 범위와 비민감 결과를 incident 기록에 남긴다.

## MVP 출시 제외 항목

다음 기능은 이번 전환의 GO 조건이 아니며 별도 backlog로 관리합니다.

- 사용자 검색 태그 기여와 승인 UI
- 관리자 데이터 검수 UI
- 상세 모니터링 화면과 고급 알림 정책
- Redis 기반 검색 read model
- 여러 유저 비교 API
- 게임 코드/표시 정책 DB 관리 UI
- 상세 playdata snapshot/growth 분석 기능
