/* Starts parts/model.js in a pretend window the way main.js does (0.4.224), for the tests that load a part on its own
   (tools/tags-test.js, tag-drag-test.js, tags-speed.js, pictures.js): the core's dsQuery reads window.logseq.DB, and
   graphWide remembers nothing. Load parts/shared.js and parts/model.js first, then this, then the part.
   From node: require('./pretend-model') is the script's text, to eval in the window or add to the page. */
module.exports = `(() => {
  const core = window.refinementCore ||= {};
  core.provided ||= {};
  core.provide = things => Object.assign(core.provided, things);
  core.dsQuery = async query => { const rows = await logseq.DB.datascriptQuery(query); return Array.isArray(rows) ? rows : []; };
  core.graphWide = (name, load) => Promise.resolve().then(load);
  const part = window.refinementParts.find(p => p.name === 'model');
  part.provide(core);
  part.start();
})();`;
