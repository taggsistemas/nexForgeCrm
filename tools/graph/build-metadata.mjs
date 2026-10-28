import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const manifest = JSON.parse(await readFile('tools/graph/manifest.json', 'utf8'));
const ids = new Set();
for (const node of manifest.nodes) {
  if (ids.has(node.id)) throw new Error('Duplicate graph ID: ' + node.id);
  ids.add(node.id);
  const source = await readFile(node.source, 'utf8');
  if (!source.includes(node.symbol.startsWith('GET ') ? node.symbol.slice(4) : node.symbol)) throw new Error('Stale graph symbol: ' + node.id);
  node.sourceHash = createHash('sha256').update(source).digest('hex');
  node.provenance = 'DECLARED';
}
for (const edge of manifest.edges) {
  if (!ids.has(edge.from)) throw new Error('Unknown node: ' + edge.from);
  await access(edge.to);
}
let commit = 'uncommitted';
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
await mkdir('artifacts/graph', { recursive: true });
await writeFile('artifacts/graph/metadata.json', JSON.stringify({ ...manifest, commit, generatedAt: new Date().toISOString() }, null, 2));
console.info('Graph metadata validated: ' + manifest.nodes.length + ' nodes, ' + manifest.edges.length + ' edges. Graphify AST extraction is a separate step.');