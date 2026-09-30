import { readFile, writeFile } from 'node:fs/promises';
import { fetchCatalog } from './shopify.mjs';
import { detect, validateWatchlist } from './detect.mjs';
import { buildMessage, sendNtfy } from './notify.mjs';

const WATCHLIST = new URL('../data/watchlist.json', import.meta.url);
const STATE = new URL('../data/state.json', import.meta.url);
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const server = process.env.NTFY_SERVER ?? 'https://ntfy.sh';
const topic = process.env.NTFY_TOPIC;

const readJson = async (url, fallback) => {
  try {
    return JSON.parse(await readFile(url, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
};

async function notify(payload) {
  if (dryRun) {
    console.log('[dry-run] notify', JSON.stringify(payload));
    return;
  }
  if (!topic) throw new Error('NTFY_TOPIC 환경변수가 없습니다');
  await sendNtfy({ server, topic, payload });
}

if (args.has('--test-notify')) {
  await notify({ title: '테스트 알림', message: 'thetoyspot-restock 알림 설정이 정상입니다.' });
  console.log('test notification sent');
  process.exit(0);
}

const watchlist = validateWatchlist(await readJson(WATCHLIST, { items: [] }));
const prevState = await readJson(STATE, { products: {} });
if (watchlist.items.length === 0) {
  console.log('watchlist is empty');
  process.exit(0);
}

const catalog = await fetchCatalog(); // 실패하면 throw → 상태 변경 없이 종료
const { events, nextState, warnings } = detect(watchlist, catalog, prevState);
for (const w of warnings) console.warn('warn:', w);

let failed = 0;
for (const ev of events) {
  try {
    await notify(buildMessage(ev));
    console.log(`notified: ${ev.handle} (${ev.variants.map((v) => v.title).join(', ')})`);
  } catch (err) {
    failed++;
    console.error(`notify failed for ${ev.handle}: ${err.message}`);
    // 이전 상태를 유지해 다음 실행에서 다시 시도한다
    if (prevState.products[ev.handle]) nextState.products[ev.handle] = prevState.products[ev.handle];
    else delete nextState.products[ev.handle];
  }
}

const fmt = (o) => JSON.stringify(o, null, 2) + '\n';
if (!dryRun && fmt(nextState) !== fmt(prevState)) await writeFile(STATE, fmt(nextState));
console.log(`checked ${watchlist.items.length} items, ${events.length} restock event(s)`);
if (failed) process.exit(1);
