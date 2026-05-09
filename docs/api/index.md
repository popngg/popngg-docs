# API

이 섹션은 API 설계 원칙과 OpenAPI 기반 API Reference를 제공합니다.

## 문서

- [API 설계](../api-design.md)
- [API Reference](../api-reference.md)

## 문서화 방식

- API 계약은 `docs/openapi/openapi.yaml`로 관리합니다.
- MkDocs에서는 Redoc으로 API Reference를 렌더링합니다.
- 백엔드 구현이 안정되면 SpringDoc `/v3/api-docs`에서 OpenAPI 문서를 갱신하는 흐름을 권장합니다.

## 원칙

- 프론트가 데이터 가공을 최소화하도록 응답을 구성합니다.
- 내부 id와 외부 식별자를 분리합니다.
- `rank`, `medal`, `difficulty`는 code와 label을 함께 제공합니다.
- 랭크는 score에서 계산하지 않고 원천 데이터의 값을 저장합니다.

