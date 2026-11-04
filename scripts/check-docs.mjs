/** Read-only checks for maintained Markdown. Historical artifact contents and remote URLs are out of scope. */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const rootGuides = ['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'CHANGELOG.md'];
const guideDirectories = ['docs', 'src', 'tests', 'scripts'];
const referenceKey = value => value.trim().replace(/\s+/g, ' ').toLowerCase();

/** Keep newlines and character offsets so diagnostics still identify the original line. */
function withoutFences(markdown) {
  let fence;
  return markdown.split('\n').map(line => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (!fence && marker) { fence = marker; return ' '.repeat(line.length); }
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length && /^\s{0,3}(?:`+|~+)\s*$/.test(line)) fence = undefined;
      return ' '.repeat(line.length);
    }
    return line;
  }).join('\n');
}

function headingIds(markdown) {
  const lines = withoutFences(markdown).split('\n'), ids = new Set();
  for (let i = 0; i < lines.length; i++) {
    const heading = /^\s{0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/.exec(lines[i])?.[1]
      ?? (i + 1 < lines.length && /^\s{0,3}(?:=+|-+)\s*$/.test(lines[i + 1]) ? lines[i].trim() : undefined);
    if (!heading) continue;
    const base = heading.toLowerCase().replace(/<[^>]*>/g, '').replace(/&amp;/g, '&')
      .replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
    let id = base, suffix = 0;
    while (ids.has(id)) id = `${base}-${++suffix}`;
    ids.add(id);
  }
  return ids;
}

function links(markdown) {
  const source = withoutFences(markdown), found = [], references = new Map();
  const lineAt = index => source.slice(0, index).split('\n').length;
  for (const match of source.matchAll(/^\s{0,3}\[([^\]\n]+)\]:\s*(<[^>\n]+>|\S+)/gm)) {
    references.set(referenceKey(match[1]), match[2].replace(/^<|>$/g, ''));
  }
  // Maintained guides use ordinary Markdown destinations; this is deliberately not an HTML parser.
  for (const match of source.matchAll(/!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\s*\)/g)) {
    found.push({ target: match[1].replace(/^<|>$/g, ''), line: lineAt(match.index) });
  }
  for (const match of source.matchAll(/!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
    const key = referenceKey(match[2] || match[1]);
    found.push({ target: references.get(key), reference: key, line: lineAt(match.index) });
  }
  for (const match of source.matchAll(/(?<!!)\[([^\]\n]+)\](?![\[(:])/g)) {
    const target = references.get(referenceKey(match[1]));
    if (target) found.push({ target, line: lineAt(match.index) });
  }
  return found;
}

export async function checkDocumentation(root = projectRoot) {
  root = path.resolve(root);
  const files = [], errors = [], headingCache = new Map();
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await collect(file);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(file);
    }
  }
  for (const name of rootGuides) if (await stat(path.join(root, name)).catch(() => null)) files.push(path.join(root, name));
  for (const directory of guideDirectories) if (await stat(path.join(root, directory)).catch(() => null)) await collect(path.join(root, directory));
  let checkedLinks = 0;
  for (const file of files.sort()) {
    const markdown = await readFile(file, 'utf8');
    for (const link of links(markdown)) {
      const location = `${path.relative(root, file)}:${link.line}`;
      if (link.target === undefined) { errors.push(`${location}: undefined reference [${link.reference}]`); continue; }
      if (/^[a-z][a-z\d+.-]*:/i.test(link.target) || link.target.startsWith('//')) continue;
      checkedLinks++;
      let localPath, fragment;
      try {
        const [resource, ...hash] = link.target.split('#');
        localPath = decodeURIComponent(resource.split('?')[0]); fragment = decodeURIComponent(hash.join('#'));
      } catch { errors.push(`${location}: invalid URL encoding ${link.target}`); continue; }
      const destination = localPath ? path.resolve(localPath.startsWith('/') ? root : path.dirname(file), localPath.replace(/^\//, '')) : file;
      const info = await stat(destination).catch(() => null);
      if (!info) { errors.push(`${location}: missing path ${link.target}`); continue; }
      if (fragment && info.isFile() && destination.endsWith('.md')) {
        if (!headingCache.has(destination)) headingCache.set(destination, headingIds(await readFile(destination, 'utf8')));
        if (!headingCache.get(destination).has(fragment)) errors.push(`${location}: missing Markdown heading ${link.target}`);
      }
    }
  }
  return { files: files.length, links: checkedLinks, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await checkDocumentation();
  if (report.errors.length) {
    console.error(report.errors.join('\n'));
    console.error(`Documentation check failed: ${report.errors.length} problems.`); process.exitCode = 1;
  } else console.log(`Documentation check passed: ${report.files} guides, ${report.links} local links.`);
}
