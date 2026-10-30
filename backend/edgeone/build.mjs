import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(root,'../worker.js');
fs.mkdirSync(path.join(root,'runtime'),{recursive:true});
if(fs.existsSync(source))fs.copyFileSync(source,path.join(root,'runtime/worker.mjs'));
if(!fs.existsSync(path.join(root,'runtime/worker.mjs')))throw new Error('Missing canonical worker snapshot.');
fs.mkdirSync(path.join(root,'public'),{recursive:true});
fs.writeFileSync(path.join(root,'public/index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>帝怒之后 · AI答疑</title><p><a href="/chat">打开 AI 答疑</a></p><p><a href="https://2024-dada.github.io/northern-qi-history/">返回历史网站</a></p></html>');
console.log('Prepared EdgeOne Cloud Functions, 60-second duration; no runtime secrets included.');
