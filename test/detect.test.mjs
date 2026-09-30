import test from 'node:test';
import assert from 'node:assert/strict';
import { detect, validateWatchlist } from '../src/detect.mjs';
import { buildMessage } from '../src/notify.mjs';
import { addToCartUrl } from '../src/shopify.mjs';

const product = (variants) => ({ handle: 'p', title: 'Prod', variants });
const v = (id, available, title = `V${id}`) => ({ id, title, available, price: '10.00' });
const cat = (...variants) => new Map([['p', product(variants)]]);
const all = { items: [{ handle: 'p', variants: 'all' }] };
const some = (...ids) => ({ items: [{ handle: 'p', variants: ids }] });

test('첫 실행은 기준만 저장하고 알림 없음', () => {
  const r = detect(all, cat(v(1, true), v(2, false)), { products: {} });
  assert.equal(r.events.length, 0);
  assert.deepEqual(r.nextState.products.p, { 1: true, 2: false });
});

test('품절 → 재고 있음이면 알림', () => {
  const r = detect(some(2), cat(v(1, true), v(2, true)), { products: { p: { 1: true, 2: false } } });
  assert.equal(r.events.length, 1);
  assert.deepEqual(r.events[0].variants.map((x) => x.id), [2]);
});

test('재고 있음 유지 / 재고 있음 → 품절은 알림 없음', () => {
  const r = detect(all, cat(v(1, true), v(2, false)), { products: { p: { 1: true, 2: true } } });
  assert.equal(r.events.length, 0);
  assert.deepEqual(r.nextState.products.p, { 1: true, 2: false });
});

test('지정하지 않은 옵션은 알림 없음', () => {
  const r = detect(some(1), cat(v(1, false), v(2, true)), { products: { p: { 1: false, 2: false } } });
  assert.equal(r.events.length, 0);
});

test('"all": 새로 추가된 옵션이 재고 있으면 알림', () => {
  const r = detect(all, cat(v(1, true), v(3, true)), { products: { p: { 1: true } } });
  assert.deepEqual(r.events[0].variants.map((x) => x.id), [3]);
});

test('"all": 새로 추가된 옵션이 품절이면 알림 없음', () => {
  const r = detect(all, cat(v(1, true), v(3, false)), { products: { p: { 1: true } } });
  assert.equal(r.events.length, 0);
});

test('특정 옵션 지정: state에 없던 옵션은 기준만 저장', () => {
  const r = detect(some(3), cat(v(1, true), v(3, true)), { products: { p: { 1: true } } });
  assert.equal(r.events.length, 0);
  assert.equal(r.nextState.products.p[3], true);
});

test('카탈로그에서 사라진 상품은 경고 + 이전 상태 유지', () => {
  const prev = { products: { p: { 1: false } } };
  const r = detect(all, new Map(), prev);
  assert.equal(r.warnings.length, 1);
  assert.deepEqual(r.nextState.products.p, { 1: false });
});

test('워치리스트에서 빠진 상품의 상태는 제거', () => {
  const r = detect({ items: [] }, cat(v(1, true)), { products: { p: { 1: true } } });
  assert.deepEqual(r.nextState.products, {});
});

test('워치리스트 검증', () => {
  assert.throws(() => validateWatchlist({}));
  assert.throws(() => validateWatchlist({ items: [{ handle: 'p', variants: [] }] }));
  assert.throws(() => validateWatchlist({ items: [{ handle: 'p', variants: ['1'] }] }));
  assert.doesNotThrow(() => validateWatchlist(all));
});

test('알림 메시지: 장바구니 링크는 /cart/add, 체크아웃 링크 아님', () => {
  const m = buildMessage({ handle: 'p', title: 'Prod', variants: [{ id: 5, title: 'Default Title', price: '9.99' }] });
  assert.equal(m.actions[0].url, addToCartUrl(5));
  assert.match(m.actions[0].url, /\/cart\/add\?id=5&quantity=1&return_to=\/cart$/);
  assert.match(m.message, /9\.99/);
  assert.doesNotMatch(m.message, /Default Title/);
});
