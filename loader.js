// Logseq keeps a plugin's script cached between reloads, so edits to main.js would not show up.
// This small entry file loads main.js under a new address each time the plugin starts.
(() => {
  const script = document.createElement('script');
  script.src = new URL('main.js?t=' + Date.now(), document.currentScript.src).href;
  document.body.appendChild(script);
})();
