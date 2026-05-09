window.mermaidConfig = {
  startOnLoad: false,
  theme: "base",
  themeVariables: {
    primaryColor: "#e6f5f2",
    primaryTextColor: "#14211d",
    primaryBorderColor: "#0f766e",
    lineColor: "#5e6b66",
    secondaryColor: "#f5f8f7",
    tertiaryColor: "#ffffff"
  }
};

function renderMermaidDiagrams() {
  if (!window.mermaid) {
    return;
  }

  document.querySelectorAll("pre.mermaid").forEach(function (block) {
    var code = block.querySelector("code");
    var diagram = document.createElement("div");
    diagram.className = "mermaid";
    diagram.textContent = code ? code.textContent : block.textContent;
    block.replaceWith(diagram);
  });

  window.mermaid.initialize(window.mermaidConfig);
  window.mermaid.run({
    querySelector: "div.mermaid"
  });
}

document.addEventListener("DOMContentLoaded", renderMermaidDiagrams);

if (typeof document$ !== "undefined") {
  document$.subscribe(renderMermaidDiagrams);
}
