#!/usr/bin/env node
/* Every part stands on its own (0.4.269): the plugin is booted (tools/boot-test.js) with each part left out in turn, and
   must start, run and unload with no warning but the one that says what is missing. The proposals are four pieces:
   without Option-Enter (parts/shadow-steps.js) or a page's own properties (parts/shadow-page.js) the proposals while
   writing go on, checked by tools/shadow-write-test.js with those pieces left out; without the rules
   (parts/shadow-rules.js) the proposals stay off and say so; without the bullet's piece (parts/shadow.js) Option-Enter
   and the page piece stay out and say so (the pickers' order, from the rules alone, was
   seen the same as with all four on the Illness Test Graph at 0.4.269).
   The tag map is three pieces (0.4.295): without parts/tags-graph.js or parts/tags-props.js the tree stays off and says
   so; without the tree the other two do nothing.
   The foundation (shared, model, diagnostics, settings-panel) is not left out: everything stands on it.
   Needs node and jsdom. Run from the repo root: node tools/parts-apart-test.js   (tools/check.sh runs it) */
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const problems = [];
const run = (script, env) => spawnSync(process.execPath, [path.join(root, 'tools', script)], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' });

// [left out, the warning that should say so (none: nothing to say), parts that then stay out by themselves]
const CASES = [
  ['two-way'], ['tag-path'], ['title-row'], ['property-kinds'], ['sidebar'], ['chrome'], ['search-look'], ['page-look'], ['tags'], ['link-text'], ['picker'],
  // The tag map's pieces (0.4.295): without the graph's or the property map's piece the tree stays off and says so;
  // without the tree the other two do nothing.
  ['tags-graph', 'parts/tags-graph.js is not loaded'], ['tags-props', 'parts/tags-props.js is not loaded'],
  ['tags,tags-graph,tags-props'],
  ['alike', 'alike is missing from the core'],
  ['shadow-steps'], ['shadow-page'], ['shadow-steps,shadow-page'],
  ['shadow-rules', 'parts/shadow-rules.js, are not loaded'],
  ['shadow', 'parts/shadow.js is not loaded', 2],
  ['shadow-rules,shadow,shadow-steps,shadow-page'],
];
for (const [leave, warn, quiet] of CASES) {
  const out = run('boot-test.js', { LEAVE_OUT: leave, ALLOW_WARN: warn || '', QUIET_PARTS: String(quiet || 0) });
  const ok = out.status === 0;
  console.log(`  without ${leave.split(',').join(', ')}: ${ok ? 'starts, runs and unloads' : 'FAILED'}${warn && ok ? ' (says what is missing)' : ''}`);
  if (!ok) problems.push(`without ${leave}:\n` + (out.stdout + out.stderr).split('\n').filter(line => /PROBLEM/.test(line)).join('\n'));
}
for (const leave of ['shadow-steps', 'shadow-page', 'shadow-steps,shadow-page']) {
  const out = run('shadow-write-test.js', { LEAVE_OUT: leave });
  const ok = out.status === 0;
  console.log(`  proposals while writing, without ${leave.split(',').join(', ')}: ${ok ? 'shown, filled in and undone as always' : 'FAILED'}`);
  if (!ok) problems.push(`proposals without ${leave}:\n` + out.stdout.split('\n').filter(line => /PROBLEM/.test(line)).join('\n'));
}
for (const text of problems) console.log('PROBLEM: ' + text);
console.log(problems.length ? `parts-apart-test: FAILED (${problems.length})` : `parts-apart-test: OK (${CASES.length + 3} ways)`);
process.exit(problems.length ? 1 : 0);
