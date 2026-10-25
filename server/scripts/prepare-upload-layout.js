// Browser upload layout: assemble the original app paths for local npm commands.
// Production Docker builds perform the same mapping with COPY instructions.
import {cpSync, existsSync, mkdirSync, lstatSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.dirname(app);
const sources = [
  [path.join(repo, 'public'), path.join(app, 'public')],
  [path.join(repo, 'assets', 'covers'), path.join(app, 'public', 'covers')],
  [path.join(repo, 'assets', 'tests'), path.join(app, 'tests')],
];
for (const [source, target] of sources) {
  if (!existsSync(source)) continue;
  if (lstatSync(source).isSymbolicLink()) throw new Error('Upload source must be a real directory');
  mkdirSync(path.dirname(target), {recursive:true});
  cpSync(source, target, {recursive:true, force:true});
}
