---
hide:
  - toc
---

# API Reference

이 페이지는 MVP API 초안을 OpenAPI 문서로 렌더링합니다.

<style>
  .md-grid {
    max-width: 100%;
  }

  .md-sidebar--primary,
  .md-sidebar--secondary {
    display: none;
  }

  .md-content__inner {
    max-width: none;
    margin: 0;
    padding: 1.2rem 1.4rem 0;
  }

  .md-main__inner {
    display: block;
  }

  redoc {
    display: block;
    width: 100%;
    min-height: 80vh;
  }
</style>

<redoc spec-url="../openapi/openapi.yaml" hide-download-button="false"></redoc>
<script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
