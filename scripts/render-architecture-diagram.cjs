const { chromium } = require("playwright");
const path = require("path");

const outputPath = path.resolve(__dirname, "../docs/assets/images/architecture-overview.png");
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const item = (title, desc) => `
  <div class="item">
    <strong>${title}</strong>
    <span>${desc}</span>
  </div>
`;

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef5f2; font-family: "Segoe UI", "Malgun Gothic", Arial, sans-serif; }
  .canvas {
    position: relative;
    width: 2200px;
    height: 1500px;
    overflow: hidden;
    background:
      radial-gradient(circle at 10% 3%, rgba(29, 95, 191, .14), transparent 420px),
      radial-gradient(circle at 92% 8%, rgba(15, 118, 110, .14), transparent 440px),
      radial-gradient(circle at 52% 98%, rgba(217, 119, 6, .10), transparent 520px),
      linear-gradient(135deg, #fbfffd 0%, #f3faf7 54%, #f8fbff 100%);
    color: #071512;
  }
  .brand { position: absolute; left: 70px; top: 46px; font-weight: 900; font-size: 50px; letter-spacing: -2px; color: #1266d5; }
  .brand span { color: #0b5f59; }
  .title { position: absolute; left: 330px; top: 48px; font-size: 48px; font-weight: 900; letter-spacing: -1.8px; color: #071512; }
  .subtitle { position: absolute; left: 334px; top: 112px; font-size: 22px; color: #5f716c; font-weight: 650; }
  .pill { position: absolute; right: 76px; top: 54px; padding: 16px 26px; border-radius: 18px; background: linear-gradient(135deg, #0f766e, #064f4a); color: white; font-size: 24px; font-weight: 900; box-shadow: 0 18px 40px rgba(15,118,110,.22); }

  .label { position: absolute; padding: 12px 20px; border-radius: 999px; font-size: 21px; font-weight: 900; color: white; box-shadow: 0 12px 28px rgba(8,35,28,.12); }
  .label.client { left: 80px; top: 185px; background: #1266d5; }
  .label.app { left: 555px; top: 185px; background: #0f766e; }
  .label.server { left: 1280px; top: 185px; background: #d97706; }
  .label.ops { left: 1660px; top: 185px; background: #475569; }

  .card {
    position: absolute;
    border-radius: 28px;
    background: rgba(255,255,255,.96);
    border: 2px solid #dbe5e1;
    box-shadow: 0 22px 60px rgba(9, 39, 31, .12);
    overflow: hidden;
  }
  .head { height: 74px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; color: white; }
  .h-blue { background: linear-gradient(135deg, #1d65c8, #144d99); }
  .h-teal { background: linear-gradient(135deg, #0f766e, #075b55); }
  .h-amber { background: linear-gradient(135deg, #e58a13, #b9640c); }
  .h-slate { background: linear-gradient(135deg, #64748b, #334155); }
  .name { font-size: 30px; font-weight: 900; letter-spacing: -.7px; }
  .role { font-size: 15px; font-weight: 850; opacity: .84; text-transform: uppercase; letter-spacing: .08em; }
  .body { padding: 22px 24px; }
  .item { padding: 14px 16px; border-radius: 16px; background: #f4f8f6; margin-bottom: 12px; }
  .item:last-child { margin-bottom: 0; }
  .item strong { display: block; color: #071512; font-size: 18px; font-weight: 900; margin-bottom: 4px; }
  .item span { display: block; color: #61716b; font-size: 15px; line-height: 1.42; font-weight: 650; }

  .client-card { left: 80px; top: 250px; width: 360px; height: 350px; }
  .vercel-card { left: 80px; top: 660px; width: 360px; height: 305px; }
  .clean-card { left: 535px; top: 250px; width: 660px; height: 735px; }
  .data-card { left: 1280px; top: 250px; width: 350px; height: 405px; }
  .asset-card { left: 1280px; top: 715px; width: 350px; height: 300px; }
  .ops-card { left: 1690px; top: 250px; width: 380px; height: 390px; }
  .monitor-card { left: 1690px; top: 700px; width: 380px; height: 330px; }

  .layers { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 6px; }
  .layer {
    min-height: 480px;
    border-radius: 22px;
    border: 2px solid #dbe5e1;
    overflow: hidden;
    background: white;
  }
  .layer h3 { margin: 0; padding: 16px 14px; color: white; font-size: 21px; font-weight: 900; text-align: center; }
  .layer.api h3 { background: #1d65c8; }
  .layer.app h3 { background: #65a30d; }
  .layer.domain h3 { background: #d97706; }
  .layer.infra h3 { background: #0f766e; }
  .layer ul { margin: 0; padding: 16px 18px 18px 28px; color: #17211d; font-size: 16px; line-height: 1.65; font-weight: 700; }
  .principle { margin-top: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .principle div { padding: 13px 14px; border-radius: 16px; background: #f4f8f6; color: #52645d; font-size: 15px; font-weight: 750; line-height: 1.4; }

  .stack { position: absolute; left: 80px; right: 80px; bottom: 56px; display: grid; grid-template-columns: repeat(9, 1fr); gap: 14px; }
  .tech {
    min-height: 96px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border-radius: 22px;
    border: 2px solid #dbe5e1;
    background: rgba(255,255,255,.94);
    box-shadow: 0 16px 40px rgba(9,39,31,.08);
  }
  .tech b { font-size: 18px; color: #071512; }
  .tech span { font-size: 13px; color: #64736d; font-weight: 750; }

  .circle { width: 38px; height: 38px; border-radius: 14px; display: grid; place-items: center; color: white; font-weight: 900; font-size: 18px; }
  .c-blue { background: #1266d5; } .c-teal { background: #0f766e; } .c-amber { background: #d97706; } .c-slate { background: #475569; } .c-red { background: #dc2626; }

  svg.lines { position: absolute; inset: 0; width: 2200px; height: 1500px; pointer-events: none; }
  .line { fill: none; stroke: #0f766e; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; opacity: .7; marker-end: url(#arrow); }
  .line-blue { stroke: #1266d5; }
  .line-amber { stroke: #d97706; }
  .line-slate { stroke: #64748b; stroke-dasharray: 14 14; opacity: .62; }
  .line-red { stroke: #dc2626; stroke-dasharray: 12 12; opacity: .62; }
</style>
</head>
<body>
<div class="canvas">
  <div class="brand">popn<span>.gg</span></div>
  <div class="title">Refactoring Architecture</div>
  <div class="subtitle">Vercel 프론트 + Spring Boot 백엔드 + 클린/헥사고널 계층 + 2대 서버 운영</div>
  <div class="pill">Jenkins + Docker + Flyway</div>

  <svg class="lines" viewBox="0 0 2200 1500">
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#0f766e"/></marker></defs>
    <path class="line line-blue" d="M440 410 C480 410 495 410 535 410"/>
    <path class="line line-blue" d="M260 600 C260 625 260 635 260 660"/>
    <path class="line" d="M1195 410 C1230 410 1245 410 1280 410"/>
    <path class="line" d="M1195 560 C1230 560 1245 770 1280 795"/>
    <path class="line line-slate" d="M1690 410 C1655 410 1650 410 1630 410"/>
    <path class="line line-slate" d="M1690 820 C1655 820 1650 820 1630 820"/>
    <path class="line line-red" d="M1880 640 C1880 670 1880 675 1880 700"/>
    <path class="line line-amber" d="M1880 640 C1730 1070 1440 1105 1180 985"/>
  </svg>

  <div class="label client">Client</div>
  <div class="label app">Backend Clean Architecture</div>
  <div class="label server">Application Server</div>
  <div class="label ops">CI/CD & Observability</div>

  <section class="card client-card">
    <div class="head h-blue"><span class="name">Users</span><span class="role">browser</span></div>
    <div class="body">
      ${item("Web Client", "곡 검색, 유저 프로필, 팝클표, 곡별 랭킹을 조회합니다.")}
      ${item("Live Search", "검색 UX는 빠르게 유지하되 백엔드 API와 cache/read model이 책임집니다.")}
    </div>
  </section>

  <section class="card vercel-card">
    <div class="head h-blue"><span class="name">Vercel</span><span class="role">frontend</span></div>
    <div class="body">
      ${item("Static / SSR Frontend", "프론트 서버는 백엔드 서버와 분리합니다.")}
      ${item("API Calls", "백엔드 `/api/v1`로 필요한 데이터만 요청합니다.")}
    </div>
  </section>

  <section class="card clean-card">
    <div class="head h-teal"><span class="name">Spring Boot Backend</span><span class="role">hexagonal</span></div>
    <div class="body">
      <div class="layers">
        <div class="layer api"><h3>API</h3><ul><li>REST Controller</li><li>Req/Res DTO</li><li>Validation</li><li>Exception Handler</li></ul></div>
        <div class="layer app"><h3>Application</h3><ul><li>Use Case</li><li>Command / Query</li><li>Transaction</li><li>Port Interface</li></ul></div>
        <div class="layer domain"><h3>Domain</h3><ul><li>Domain Model</li><li>Value Object</li><li>Business Rules</li><li>Invariants</li></ul></div>
        <div class="layer infra"><h3>Infra</h3><ul><li>JPA</li><li>Querydsl</li><li>Redis Adapter</li><li>S3 Adapter</li></ul></div>
      </div>
      <div class="principle">
        <div>Controller는 비즈니스 계산을 하지 않습니다.</div>
        <div>Domain은 Spring/JPA/HTTP를 모릅니다.</div>
        <div>긴 갱신 작업은 request thread와 분리합니다.</div>
      </div>
    </div>
  </section>

  <section class="card data-card">
    <div class="head h-amber"><span class="name">Server 2</span><span class="role">runtime</span></div>
    <div class="body">
      ${item("Spring Boot App", "Docker container로 배포합니다.")}
      ${item("MySQL", "source of truth. schema는 Flyway로 관리합니다.")}
      ${item("Redis", "검색/cache/read model 후보로 사용합니다.")}
    </div>
  </section>

  <section class="card asset-card">
    <div class="head h-teal"><span class="name">External Assets</span><span class="role">storage</span></div>
    <div class="body">
      ${item("AWS S3", "곡 자켓, 프로필 이미지 같은 정적 assets를 저장합니다.")}
      ${item("Mutable songHash", "자켓 key는 신규 songHash 기준으로 새로 저장합니다.")}
    </div>
  </section>

  <section class="card ops-card">
    <div class="head h-slate"><span class="name">Server 1</span><span class="role">ops</span></div>
    <div class="body">
      ${item("Jenkins", "test, build, image, migration, deploy, smoke test를 수행합니다.")}
      ${item("Docker Registry", "배포 산출물은 Docker image로 관리합니다.")}
      ${item("Flyway Step", "DB migration은 배포 pipeline에서 분리된 단계로 실행합니다.")}
    </div>
  </section>

  <section class="card monitor-card">
    <div class="head h-slate"><span class="name">Monitoring</span><span class="role">observe</span></div>
    <div class="body">
      ${item("Prometheus + Grafana", "Actuator/Micrometer metric과 dashboard를 봅니다.")}
      ${item("Loki + Alloy", "stdout JSON log를 수집하고 requestId로 추적합니다.")}
    </div>
  </section>

  <div class="stack">
    <div class="tech"><div class="circle c-amber">J</div><b>Java 25</b><span>fallback 21</span></div>
    <div class="tech"><div class="circle c-teal">S</div><b>Spring Boot</b><span>backend</span></div>
    <div class="tech"><div class="circle c-blue">Q</div><b>Querydsl</b><span>read query</span></div>
    <div class="tech"><div class="circle c-teal">M</div><b>MySQL</b><span>primary DB</span></div>
    <div class="tech"><div class="circle c-red">R</div><b>Redis</b><span>cache/search</span></div>
    <div class="tech"><div class="circle c-amber">F</div><b>Flyway</b><span>schema</span></div>
    <div class="tech"><div class="circle c-blue">D</div><b>Docker</b><span>deploy</span></div>
    <div class="tech"><div class="circle c-slate">J</div><b>Jenkins</b><span>CI/CD</span></div>
    <div class="tech"><div class="circle c-teal">O</div><b>Observe</b><span>Prom/Loki</span></div>
  </div>
</div>
</body>
</html>`;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
  });
  const page = await browser.newPage({
    viewport: { width: 2200, height: 1500 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: outputPath, fullPage: false });
  await browser.close();
  console.log(outputPath);
})();
