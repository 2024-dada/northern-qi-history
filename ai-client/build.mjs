import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
await build({absWorkingDir:root,entryPoints:['client.js'],outfile:'../ai-direct.js',bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true,keepNames:true,legalComments:'eof'});
console.log('Built browser DeepSeek SDK module');
