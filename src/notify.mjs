import { addToCartUrl, productUrl } from './shopify.mjs';

const isDefault = (t) => t === 'Default Title';

export function buildMessage(event) {
  const multi = event.variants.length > 1 || !isDefault(event.variants[0].title);
  // 통화는 요청 지역에 따라 달라질 수 있어(USD/KRW) 기호를 붙이지 않는다.
  const lines = event.variants.map((v) => `${isDefault(v.title) ? '' : `${v.title} — `}${v.price}`);
  return {
    title: `재입고: ${event.title}`,
    message: `${lines.join('\n')}\n(가격은 참고용, 결제 화면에서 확인)`,
    click: productUrl(event.handle),
    // ntfy 액션은 최대 3개. 장바구니에 담기만 하고 결제는 직접 한다.
    actions: event.variants.slice(0, 3).map((v) => ({
      action: 'view',
      label: multi ? `담기: ${v.title}`.slice(0, 30) : '장바구니 담기',
      url: addToCartUrl(v.id),
    })),
  };
}

/** ntfy JSON publish API — 헤더가 아니라 본문을 써서 한글이 깨지지 않는다. */
export async function sendNtfy({ server, topic, payload }, fetchImpl = fetch) {
  const res = await fetchImpl(server, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, priority: 4, tags: ['package'], ...payload }),
  });
  if (!res.ok) throw new Error(`ntfy HTTP ${res.status}: ${await res.text().catch(() => '')}`);
}
