const { chromium } = require("playwright");
const path = require("path");

const outputPath = path.resolve(__dirname, "../docs/assets/images/architecture-overview.png");
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const simpleIcon = (slug, color = "111111") => `https://cdn.simpleicons.org/${slug}/${color}`;
const devIcon = (name) => `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${name}/${name}-original.svg`;
const awsS3Icon = "https://icon.icepanel.io/AWS/svg/Storage/Simple-Storage-Service.svg";

const svgData = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const querydslIcon = svgData(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="q" x1="16" x2="104" y1="18" y2="104">
        <stop stop-color="#1f77b4"/>
        <stop offset="1" stop-color="#17324d"/>
      </linearGradient>
    </defs>
    <rect x="10" y="10" width="100" height="100" rx="26" fill="url(#q)"/>
    <circle cx="55" cy="55" r="26" fill="none" stroke="#fff" stroke-width="12"/>
    <path d="M72 74l19 19" stroke="#fff" stroke-width="12" stroke-linecap="round"/>
  </svg>
`);

const iconMarkup = ({ src, slug, color = "111111", name, fallback, small = false }) => {
  const imageSrc = src || (slug ? simpleIcon(slug, color) : null);
  return imageSrc
    ? `<img src="${imageSrc}" alt="${name}" />`
    : `<div class="fallback${small ? " small" : ""}">${fallback}</div>`;
};

const tech = ({ src, slug, name, sub, color = "111111", fallback }) => `
  <div class="tech">
    ${iconMarkup({ src, slug, color, name, fallback })}
    <b>${name}</b>
    <span>${sub}</span>
  </div>
`;

const mini = ({ src, slug, name, color = "111111", fallback }) => `
  <div class="mini">
    ${iconMarkup({ src, slug, color, name, fallback, small: true })}
    <span>${name}</span>
  </div>
`;

const moduleBox = (title, items, cls = "") => `
  <div class="module ${cls}">
    <h3>${title}</h3>
    ${items.map((item) => `<p>${item}</p>`).join("")}
  </div>
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef5f2; font-family: "Segoe UI", Arial, sans-serif; }
  .canvas {
    position: relative;
    width: 2400px;
    height: 1500px;
    overflow: hidden;
    background:
      radial-gradient(circle at 8% 3%, rgba(29, 95, 191, .14), transparent 430px),
      radial-gradient(circle at 92% 8%, rgba(15, 118, 110, .14), transparent 450px),
      radial-gradient(circle at 52% 100%, rgba(217, 119, 6, .10), transparent 560px),
      linear-gradient(135deg, #fbfffd 0%, #f3faf7 53%, #f8fbff 100%);
    color: #071512;
  }
  .brand { position: absolute; left: 72px; top: 48px; font-weight: 900; font-size: 54px; letter-spacing: -2px; color: #1266d5; }
  .brand span { color: #0b5f59; }
  .title { position: absolute; left: 340px; top: 48px; font-size: 52px; font-weight: 900; letter-spacing: -2px; color: #071512; }
  .subtitle { position: absolute; left: 344px; top: 116px; font-size: 23px; color: #5f716c; font-weight: 700; }
  .badge { position: absolute; right: 86px; top: 56px; padding: 16px 28px; border-radius: 18px; background: linear-gradient(135deg, #0f766e, #064f4a); color: white; font-size: 25px; font-weight: 900; box-shadow: 0 18px 40px rgba(15,118,110,.22); }
  .section-title {
    position: absolute;
    padding: 12px 22px;
    border-radius: 999px;
    color: white;
    font-size: 22px;
    font-weight: 900;
    box-shadow: 0 12px 28px rgba(8,35,28,.12);
  }
  .st-client { left: 72px; top: 184px; background: #1266d5; }
  .st-backend { left: 620px; top: 184px; background: #0f766e; }
  .st-runtime { left: 1430px; top: 184px; background: #d97706; }
  .st-ops { left: 1900px; top: 184px; background: #475569; }
  .card {
    position: absolute;
    border-radius: 30px;
    background: rgba(255,255,255,.96);
    border: 2px solid #dbe5e1;
    box-shadow: 0 24px 64px rgba(9, 39, 31, .12);
    overflow: hidden;
  }
  .head {
    height: 78px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 26px;
    color: white;
  }
  .head img { width: 42px; height: 42px; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,.16)); }
  .head h2 { margin: 0; font-size: 31px; font-weight: 900; letter-spacing: -.9px; }
  .h-blue { background: linear-gradient(135deg, #1d65c8, #144d99); }
  .h-teal { background: linear-gradient(135deg, #0f766e, #075b55); }
  .h-amber { background: linear-gradient(135deg, #e58a13, #b9640c); }
  .h-slate { background: linear-gradient(135deg, #64748b, #334155); }
  .body { padding: 24px; }
  .client-card { left: 72px; top: 250px; width: 430px; height: 335px; }
  .vercel-card { left: 72px; top: 660px; width: 430px; height: 300px; }
  .backend-card { left: 600px; top: 250px; width: 750px; height: 710px; }
  .runtime-card { left: 1430px; top: 250px; width: 390px; height: 400px; }
  .asset-card { left: 1430px; top: 715px; width: 390px; height: 320px; }
  .cicd-card { left: 1900px; top: 250px; width: 410px; height: 400px; }
  .observe-card { left: 1900px; top: 715px; width: 410px; height: 320px; }
  .mini-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .mini {
    min-height: 92px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-radius: 18px;
    background: #f4f8f6;
    color: #071512;
    font-size: 18px;
    font-weight: 900;
  }
  .mini img { width: 38px; height: 38px; object-fit: contain; }
  .fallback { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 14px; background: #0f766e; color: white; font-weight: 900; }
  .fallback.small { width: 38px; height: 38px; }
  .modules {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }
  .module {
    min-height: 438px;
    border-radius: 24px;
    border: 2px solid #dbe5e1;
    overflow: hidden;
    background: white;
  }
  .module h3 {
    margin: 0 0 18px;
    padding: 18px 12px;
    color: white;
    font-size: 24px;
    font-weight: 900;
    text-align: center;
  }
  .module p {
    margin: 0 16px 14px;
    padding: 13px 14px;
    border-radius: 14px;
    background: #f4f8f6;
    color: #17211d;
    font-size: 16px;
    font-weight: 760;
    line-height: 1.32;
  }
  .api h3 { background: #1d65c8; }
  .app h3 { background: #65a30d; }
  .domain h3 { background: #d97706; }
  .infra h3 { background: #0f766e; }
  .rules {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 13px;
    margin-top: 18px;
  }
  .rules div {
    min-height: 84px;
    padding: 16px;
    border-radius: 18px;
    background: #f4f8f6;
    color: #52645d;
    font-size: 16px;
    font-weight: 760;
    line-height: 1.36;
  }
  .list {
    display: grid;
    grid-template-columns: 1fr;
    gap: 13px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 82px;
    padding: 14px 16px;
    border-radius: 18px;
    background: #f4f8f6;
  }
  .row img { width: 42px; height: 42px; object-fit: contain; }
  .duo { width: 76px; display: flex; align-items: center; gap: 8px; }
  .duo img { width: 34px; height: 34px; object-fit: contain; }
  .row b { display: block; color: #071512; font-size: 19px; font-weight: 900; }
  .row span { display: block; color: #61716b; font-size: 14px; font-weight: 700; margin-top: 3px; }
  .stack {
    position: absolute;
    left: 72px;
    right: 72px;
    bottom: 58px;
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    gap: 13px;
  }
  .tech {
    min-height: 105px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border-radius: 23px;
    border: 2px solid #dbe5e1;
    background: rgba(255,255,255,.94);
    box-shadow: 0 16px 40px rgba(9,39,31,.08);
  }
  .tech img { width: 38px; height: 38px; object-fit: contain; }
  .tech b { font-size: 16px; color: #071512; text-align: center; }
  .tech span { font-size: 12px; color: #64736d; font-weight: 800; text-align: center; }
  svg.lines { position: absolute; inset: 0; width: 2400px; height: 1500px; pointer-events: none; }
  .line { fill: none; stroke: #0f766e; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; opacity: .72; marker-end: url(#arrow); }
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
  <div class="subtitle">Frontend on Vercel · Spring Boot Clean Architecture · Two Server Operations</div>
  <div class="badge">Jenkins + Docker + Flyway</div>

  <svg class="lines" viewBox="0 0 2400 1500">
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#0f766e"/></marker></defs>
    <path class="line line-blue" d="M502 415 C548 415 555 415 600 415"/>
    <path class="line line-blue" d="M287 585 C287 620 287 630 287 660"/>
    <path class="line" d="M1350 430 C1385 430 1395 430 1430 430"/>
    <path class="line" d="M1350 575 C1385 575 1390 805 1430 830"/>
    <path class="line line-slate" d="M1900 430 C1860 430 1850 430 1820 430"/>
    <path class="line line-slate" d="M1900 835 C1860 835 1850 835 1820 835"/>
    <path class="line line-red" d="M2105 650 C2105 680 2105 690 2105 715"/>
    <path class="line line-amber" d="M2105 650 C1900 1110 1530 1115 1340 960"/>
  </svg>

  <div class="section-title st-client">Client</div>
  <div class="section-title st-backend">Backend Clean Architecture</div>
  <div class="section-title st-runtime">Application Server</div>
  <div class="section-title st-ops">CI/CD & Observability</div>

  <section class="card client-card">
    <div class="head h-blue"><img src="${simpleIcon("googlechrome", "ffffff")}" alt="Browser" /><h2>Users</h2></div>
    <div class="body">
      <div class="mini-grid">
        ${mini({ slug: "googlechrome", name: "Browser", color: "1266d5" })}
        ${mini({ slug: "vercel", name: "Web App", color: "111111" })}
        ${mini({ src: devIcon("react"), name: "React UI" })}
        ${mini({ slug: "json", name: "API JSON", color: "0f766e" })}
      </div>
    </div>
  </section>

  <section class="card vercel-card">
    <div class="head h-blue"><img src="${simpleIcon("vercel", "ffffff")}" alt="Vercel" /><h2>Vercel</h2></div>
    <div class="body">
      <div class="list">
        <div class="row"><img src="${simpleIcon("vercel", "111111")}" alt="Vercel" /><div><b>Frontend Hosting</b><span>Static / SSR frontend</span></div></div>
        <div class="row"><img src="${simpleIcon("cloudflare", "f38020")}" alt="CDN" /><div><b>Edge / CDN</b><span>Fast browser delivery</span></div></div>
      </div>
    </div>
  </section>

  <section class="card backend-card">
    <div class="head h-teal"><img src="${devIcon("spring")}" alt="Spring Boot" /><h2>Spring Boot Backend</h2></div>
    <div class="body">
      <div class="modules">
        ${moduleBox("API", ["REST Controller", "Request / Response DTO", "Validation", "Exception Handler"], "api")}
        ${moduleBox("Application", ["Use Case", "Command / Query", "Transaction Boundary", "Outbound Ports"], "app")}
        ${moduleBox("Domain", ["Domain Model", "Value Object", "Business Rules", "Invariants"], "domain")}
        ${moduleBox("Infra", ["JPA", "Querydsl", "Redis Adapter", "S3 Adapter"], "infra")}
      </div>
      <div class="rules">
        <div>Controller never owns business rules.</div>
        <div>Domain has no Spring/JPA/HTTP dependency.</div>
        <div>Long jobs run outside request threads.</div>
      </div>
    </div>
  </section>

  <section class="card runtime-card">
    <div class="head h-amber"><img src="${devIcon("docker")}" alt="Docker" /><h2>Server 2</h2></div>
    <div class="body">
      <div class="list">
        <div class="row"><img src="${devIcon("spring")}" alt="Spring Boot" /><div><b>Spring Boot App</b><span>Docker container runtime</span></div></div>
        <div class="row"><img src="${devIcon("mysql")}" alt="MySQL" /><div><b>MySQL</b><span>Primary source of truth</span></div></div>
        <div class="row"><img src="${devIcon("redis")}" alt="Redis" /><div><b>Redis</b><span>Cache / search read model</span></div></div>
      </div>
    </div>
  </section>

  <section class="card asset-card">
    <div class="head h-teal"><img src="${awsS3Icon}" alt="AWS S3" /><h2>AWS S3</h2></div>
    <div class="body">
      <div class="list">
        <div class="row"><img src="${awsS3Icon}" alt="AWS S3" /><div><b>Images / Assets</b><span>Jackets and profile images</span></div></div>
        <div class="row"><img src="${awsS3Icon}" alt="AWS S3 object key" /><div><b>Mutable Hash</b><span>New songHash creates new object key</span></div></div>
      </div>
    </div>
  </section>

  <section class="card cicd-card">
    <div class="head h-slate"><img src="${devIcon("jenkins")}" alt="Jenkins" /><h2>Server 1</h2></div>
    <div class="body">
      <div class="list">
        <div class="row"><img src="${devIcon("jenkins")}" alt="Jenkins" /><div><b>Jenkins</b><span>test · build · image · deploy</span></div></div>
        <div class="row"><img src="${devIcon("docker")}" alt="Docker" /><div><b>Docker Registry</b><span>Container image artifact</span></div></div>
        <div class="row"><img src="${simpleIcon("flyway", "cc0200")}" alt="Flyway" /><div><b>Flyway</b><span>Schema migration step</span></div></div>
      </div>
    </div>
  </section>

  <section class="card observe-card">
    <div class="head h-slate"><img src="${simpleIcon("grafana", "ffffff")}" alt="Grafana" /><h2>Monitoring</h2></div>
    <div class="body">
      <div class="list">
        <div class="row"><div class="duo"><img src="${simpleIcon("prometheus", "e6522c")}" alt="Prometheus" /><img src="${simpleIcon("grafana", "f46800")}" alt="Grafana" /></div><div><b>Prometheus + Grafana</b><span>Metrics and dashboards</span></div></div>
        <div class="row"><div class="duo"><img src="${simpleIcon("grafana", "f46800")}" alt="Grafana Loki" /><img src="${simpleIcon("opentelemetry", "000000")}" alt="OpenTelemetry" /></div><div><b>Loki + Alloy</b><span>JSON logs and request tracing</span></div></div>
      </div>
    </div>
  </section>

  <div class="stack">
    ${tech({ src: devIcon("java"), name: "Java 25", sub: "fallback 21" })}
    ${tech({ src: devIcon("spring"), name: "Spring Boot", sub: "backend" })}
    ${tech({ src: devIcon("gradle"), name: "Gradle", sub: "build" })}
    ${tech({ src: querydslIcon, name: "Querydsl", sub: "read query" })}
    ${tech({ src: devIcon("mysql"), name: "MySQL", sub: "primary DB" })}
    ${tech({ src: devIcon("redis"), name: "Redis", sub: "cache/search" })}
    ${tech({ src: awsS3Icon, name: "AWS S3", sub: "assets" })}
    ${tech({ slug: "flyway", name: "Flyway", sub: "schema", color: "cc0200" })}
    ${tech({ src: devIcon("docker"), name: "Docker", sub: "deploy" })}
    ${tech({ src: devIcon("jenkins"), name: "Jenkins", sub: "CI/CD" })}
    ${tech({ slug: "grafana", name: "Observability", sub: "Prom/Loki", color: "f46800" })}
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
    viewport: { width: 2400, height: 1500 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.screenshot({ path: outputPath, fullPage: false });
  await browser.close();
  console.log(outputPath);
})();
