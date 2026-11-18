// 解析 playwright-core（项目不新增依赖）。优先级：
//   1) 环境变量 PW_CORE（playwright-core 目录或其 index.mjs）
//   2) game/tests/node_modules/playwright-core（可放软链：ln -s /tmp/pw/node_modules node_modules）
//   3) /tmp/pw/node_modules/playwright-core
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  process.env.PW_CORE,
  join(here, '..', 'node_modules', 'playwright-core'),
  '/tmp/pw/node_modules/playwright-core',
].filter(Boolean);

let cached;
export async function loadPlaywright() {
  if (cached) return cached;
  for (const c of candidates) {
    const dir = c.endsWith('.mjs') || c.endsWith('.js') ? dirname(c) : c;
    if (!existsSync(join(dir, 'package.json'))) continue;
    const req = createRequire(join(dir, 'package.json'));
    cached = req(dir);
    return cached;
  }
  throw new Error('找不到 playwright-core。请设置 PW_CORE=/tmp/pw/node_modules/playwright-core，或在 game/tests 下 `ln -s /tmp/pw/node_modules node_modules`');
}

export const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const BASE_URL = process.env.QA_URL || 'http://127.0.0.1:5173';
