const { chromium } = require("playwright");
const path = require("path");

const outputPath = path.resolve(__dirname, "../docs/assets/images/db-structure.png");
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const fields = (...rows) =>
  rows
    .map(([key, value, cls = ""]) => {
      return `<div class="field"><span class="key ${cls}">${key}</span><code>${value}</code></div>`;
    })
    .join("");

const card = ({ className, title, role, theme, rows, hint }) => `
  <section class="card ${className}">
    <div class="head ${theme}">
      <span class="name">${title}</span>
      ${role ? `<span class="role">${role}</span>` : ""}
    </div>
    <div class="body">
      ${fields(...rows)}
      ${hint ? `<div class="hint">${hint}</div>` : ""}
    </div>
  </section>
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
      radial-gradient(circle at 8% 6%, rgba(24, 99, 190, .12), transparent 430px),
      radial-gradient(circle at 92% 8%, rgba(15, 118, 110, .13), transparent 430px),
      linear-gradient(135deg, #fbfffd 0%, #f3faf7 52%, #f8fbff 100%);
    color: #071512;
  }
  .brand { position: absolute; left: 70px; top: 48px; font-weight: 900; font-size: 50px; letter-spacing: -2px; color: #1266d5; }
  .brand span { color: #0b5f59; }
  .title { position: absolute; left: 330px; top: 48px; font-size: 48px; font-weight: 900; letter-spacing: -1.8px; color: #071512; }
  .subtitle { position: absolute; left: 334px; top: 112px; font-size: 22px; color: #5f716c; font-weight: 600; }
  .pill { position: absolute; right: 76px; top: 55px; padding: 16px 26px; border-radius: 18px; background: linear-gradient(135deg, #0f766e, #064f4a); color: white; font-size: 24px; font-weight: 900; box-shadow: 0 18px 40px rgba(15,118,110,.22); }
  .legend { position: absolute; right: 78px; top: 121px; display: flex; gap: 14px; color: #64736d; font-size: 15px; font-weight: 800; }
  .dot { display: inline-block; width: 11px; height: 11px; border-radius: 50%; margin-right: 6px; }
  .blue { background: #1266d5; } .teal { background: #0f766e; } .amber { background: #d97706; } .slate { background: #64748b; }
  .group-label { position: absolute; padding: 12px 20px; border-radius: 999px; font-size: 21px; font-weight: 900; color: white; box-shadow: 0 12px 28px rgba(8,35,28,.12); }
  .account { left: 80px; top: 180px; background: #1266d5; }
  .catalog { left: 560px; top: 180px; background: #0f766e; }
  .record { left: 1070px; top: 180px; background: #d97706; }
  .ops { left: 1560px; top: 180px; background: #475569; }
  .card {
    position: absolute;
    width: 410px;
    border-radius: 26px;
    background: rgba(255,255,255,.96);
    border: 2px solid #dbe5e1;
    box-shadow: 0 22px 60px rgba(9, 39, 31, .12);
    overflow: hidden;
  }
  .card.big { width: 455px; }
  .card.small { width: 370px; }
  .transition { width: 430px; }
  .transition .name { font-size: 25px; letter-spacing: -.9px; }
  .head { height: 72px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; color: white; }
  .h-blue { background: linear-gradient(135deg, #1d65c8, #144d99); }
  .h-teal { background: linear-gradient(135deg, #0f766e, #075b55); }
  .h-amber { background: linear-gradient(135deg, #e58a13, #b9640c); }
  .h-slate { background: linear-gradient(135deg, #64748b, #334155); }
  .name { font-size: 29px; font-weight: 900; letter-spacing: -.7px; }
  .role { font-size: 15px; font-weight: 800; opacity: .84; text-transform: uppercase; letter-spacing: .08em; }
  .body { padding: 20px 24px 22px; }
  .field { display: flex; align-items: baseline; gap: 10px; min-height: 30px; font-size: 18px; color: #17211d; }
  .field .key { min-width: 54px; font-family: Consolas, monospace; font-size: 15px; font-weight: 900; color: #0f766e; }
  .field .key.uk { color: #1266d5; }
  .field .key.fk { color: #d97706; }
  .field code { font-family: Consolas, monospace; font-size: 17px; font-weight: 700; color: #0f172a; }
  .hint { margin-top: 12px; padding: 12px 14px; border-radius: 14px; background: #f3f8f6; color: #5f716c; font-size: 16px; line-height: 1.45; font-weight: 650; }
  .users { left: 80px; top: 245px; }
  .profiles { left: 80px; top: 610px; }
  .tokens { left: 80px; top: 940px; }
  .songs { left: 560px; top: 245px; }
  .charts { left: 560px; top: 610px; }
  .tags { left: 560px; top: 970px; }
  .playdata { left: 1070px; top: 245px; }
  .history { left: 1070px; top: 815px; }
  .transition { left: 1570px; top: 245px; }
  .renew { left: 1570px; top: 540px; }
  .login { left: 1570px; top: 815px; }
  svg.lines { position: absolute; left: 0; top: 0; width: 2200px; height: 1500px; pointer-events: none; }
  .line { fill: none; stroke: #0f766e; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; opacity: .62; marker-end: url(#arrow); }
  .line-blue { stroke: #1266d5; }
  .line-amber { stroke: #d97706; }
  .line-slate { stroke: #64748b; stroke-dasharray: 13 13; opacity: .58; }
  .note-row { position: absolute; left: 80px; right: 80px; bottom: 54px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .note { min-height: 128px; padding: 20px 22px; border-radius: 24px; background: rgba(255,255,255,.94); border: 2px solid #dbe5e1; box-shadow: 0 16px 40px rgba(9,39,31,.08); }
  .note strong { display: block; margin-bottom: 8px; color: #071512; font-size: 21px; font-weight: 900; }
  .note p { margin: 0; color: #64736d; font-size: 16px; line-height: 1.45; font-weight: 650; }
</style>
</head>
<body>
<div class="canvas">
  <div class="brand">popn<span>.gg</span></div>
  <div class="title">MVP Database Structure</div>
  <div class="subtitle">songHash는 외부 alias, 내부 참조는 song_id / chart_id 중심</div>
  <div class="pill">Version Best + All-Time Best</div>
  <div class="legend"><span><i class="dot blue"></i>Account</span><span><i class="dot teal"></i>Catalog</span><span><i class="dot amber"></i>Records</span><span><i class="dot slate"></i>Ops</span></div>

  <svg class="lines" viewBox="0 0 2200 1500">
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#0f766e"/></marker></defs>
    <path class="line line-blue" d="M490 380 C525 380 525 380 560 380"/>
    <path class="line line-blue" d="M285 610 C285 560 285 555 285 525"/>
    <path class="line line-blue" d="M285 940 C285 850 285 820 285 770"/>
    <path class="line" d="M765 535 C765 570 765 585 765 610"/>
    <path class="line" d="M765 545 C765 770 765 890 765 970"/>
    <path class="line line-blue" d="M490 725 C760 725 840 520 1070 520"/>
    <path class="line line-amber" d="M970 760 C1018 760 1020 520 1070 520"/>
    <path class="line line-amber" d="M970 760 C1015 760 1025 960 1070 1010"/>
    <path class="line line-amber" d="M1298 760 C1298 790 1298 795 1298 815"/>
    <path class="line line-slate" d="M1570 355 C1505 360 1470 430 1525 485 C1480 520 1385 520 1525 635 C1440 660 1360 570 1525 760 C1420 770 1360 845 1525 930"/>
    <path class="line line-slate" d="M1570 655 C1470 655 1415 575 1525 555 C1430 545 1330 545 1525 545"/>
    <path class="line line-slate" d="M1570 655 C1475 675 1410 900 1525 990 C1420 1020 1360 1015 1408 1015"/>
  </svg>

  <div class="group-label account">Account / Profile</div>
  <div class="group-label catalog">Song / Chart Catalog</div>
  <div class="group-label record">Play Records</div>
  <div class="group-label ops">Ops / Policy</div>

  ${card({ className: "users", title: "users", role: "account", theme: "h-blue", rows: [["PK", "user_id BIGINT"], ["UK", "poptomo_id VARCHAR(32)", "uk"], ["", "password_hash VARCHAR(255)"], ["UK", "email VARCHAR(255) NULL", "uk"], ["", "role VARCHAR(20)"]], hint: "인증, 권한, 로그인 기준 정보만 보관합니다." })}
  ${card({ className: "profiles", title: "user_profiles", role: "public", theme: "h-blue", rows: [["PK/FK", "user_id BIGINT"], ["", "user_name VARCHAR(32)"], ["", "character_name VARCHAR(64)"], ["", "display_popclass INT"], ["", "potential_popclass INT"]], hint: "프로필과 랭킹 표시 캐시를 함께 둡니다." })}
  ${card({ className: "small tokens", title: "password_reset_tokens", theme: "h-slate", rows: [["PK", "reset_token_id BIGINT"], ["FK", "user_id BIGINT", "fk"], ["UK", "token_hash CHAR(64)", "uk"], ["", "expires_at DATETIME"]] })}
  ${card({ className: "songs", title: "songs", role: "metadata", theme: "h-teal", rows: [["PK", "song_id BIGINT"], ["", "song_hash CHAR(32)"], ["", "genre_name VARCHAR(255)"], ["", "song_name VARCHAR(255)"], ["", "artist_name VARCHAR(255)"], ["", "jacket_url VARCHAR(1024)"]], hint: "곡 표시 정보. 변경 가능하므로 내부 참조 기준이 아닙니다." })}
  ${card({ className: "charts", title: "charts", role: "difficulty", theme: "h-teal", rows: [["PK", "chart_id BIGINT"], ["FK", "song_id BIGINT", "fk"], ["", "difficulty_code TINYINT"], ["", "level TINYINT"], ["", "chart_version INT"], ["", "is_upper BOOLEAN"]], hint: "난이도별 채보. playdata는 chart_id에 연결됩니다." })}
  ${card({ className: "small tags", title: "song_search_tags", theme: "h-teal", rows: [["PK", "tag_id BIGINT"], ["FK", "song_id BIGINT", "fk"], ["", "normalized_tag_value VARCHAR(255)"], ["", "tag_type VARCHAR(20)"]] })}
  ${card({ className: "big playdata", title: "playdata", role: "current state", theme: "h-amber", rows: [["PK", "playdata_id BIGINT"], ["UK", "user_id + chart_id", "uk"], ["", "current_version INT"], ["", "version_score INT"], ["", "all_time_score INT"], ["", "all_time_score_version INT"], ["", "medal_code TINYINT"], ["", "popclass INT"], ["", "popclass_bucket VARCHAR(20)"]], hint: "유저+채보당 1 row. 현재 화면과 랭킹을 빠르게 읽기 위한 테이블입니다." })}
  ${card({ className: "big history", title: "playdata_history", role: "append only", theme: "h-amber", rows: [["PK", "history_id BIGINT"], ["FK", "user_id BIGINT", "fk"], ["FK", "chart_id BIGINT", "fk"], ["", "game_version INT"], ["", "version_score / all_time_score INT"], ["", "rank_code / medal_code TINYINT"], ["", "event_type VARCHAR(32)"]], hint: "기록 갱신, 메달 변경, 버전 초기화/승계 이벤트만 쌓습니다." })}
  ${card({ className: "small transition", title: "game_version_transitions", theme: "h-slate", rows: [["PK", "transition_id BIGINT"], ["UK", "from_version + to_version", "uk"], ["", "score_policy RESET | CARRY_OVER"]], hint: "버전 전환 시 version_score 초기화/승계를 선언합니다." })}
  ${card({ className: "small renew", title: "renew_logs", theme: "h-slate", rows: [["PK", "renew_log_id BIGINT"], ["", "status / mode VARCHAR(20)"], ["", "input / matched / updated INT"]], hint: "갱신 job의 결과와 실패 원인을 추적합니다." })}
  ${card({ className: "small login", title: "login_logs", theme: "h-slate", rows: [["PK", "login_log_id BIGINT"], ["", "poptomo_id VARCHAR(32)"], ["", "status / failure_reason"]], hint: "로그인 이력과 실패 원인을 기록합니다." })}

  <div class="note-row">
    <div class="note"><strong>No DB FK</strong><p>DB foreign key constraint는 만들지 않고 애플리케이션 검증, unique key, index로 정합성을 보완합니다.</p></div>
    <div class="note"><strong>Mutable songHash</strong><p>songHash는 바뀔 수 있습니다. 영속 데이터는 song_id와 chart_id를 기준으로 연결합니다.</p></div>
    <div class="note"><strong>Score lifecycle</strong><p>version_score와 all_time_score를 분리하고, medal은 버전이 바뀌어도 유지합니다.</p></div>
    <div class="note"><strong>History only when meaningful</strong><p>모든 snapshot을 저장하지 않고 사용자에게 의미 있는 변화만 history에 남깁니다.</p></div>
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
