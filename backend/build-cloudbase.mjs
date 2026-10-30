import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(root, '../..', 'outputs/cloudbase-ai');
fs.mkdirSync(output, {recursive: true});
fs.copyFileSync(path.join(root, 'worker.js'), path.join(output, 'worker.mjs'));
fs.copyFileSync(path.join(root, 'cloudbase/index.js'), path.join(output, 'index.js'));
fs.copyFileSync(path.join(root, 'cloudbase/README.md'), path.join(output, 'README.md'));
fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify({
  name: 'northern-qi-ai-cloudbase', private: true, version: '1.0.0',
  main: 'index.js', engines: {node: '>=20.19'}
}, null, 2) + '\n');
console.log('CloudBase package prepared (no secrets): ' + output);
