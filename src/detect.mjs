// 재입고 판정 (순수 함수). 네트워크·파일 접근 없음.

export function validateWatchlist(wl) {
  if (!wl || !Array.isArray(wl.items)) throw new Error('watchlist.json: "items" 배열이 필요합니다');
  for (const it of wl.items) {
    if (typeof it.handle !== 'string' || !it.handle) throw new Error('watchlist.json: handle 누락');
    const ok =
      it.variants === 'all' ||
      (Array.isArray(it.variants) && it.variants.length > 0 && it.variants.every(Number.isInteger));
    if (!ok) throw new Error(`watchlist.json: ${it.handle}의 variants는 "all" 또는 variant id 배열이어야 합니다`);
  }
  return wl;
}

/**
 * 규칙
 *  - 상품이 state에 없으면 기준 상태만 저장(알림 없음)
 *  - 이전 품절(false) → 현재 재고 있음이면 알림
 *  - "all" 상품에서 이전에 없던 새 옵션이 재고 있음이면 알림
 *  - 특정 옵션 지정 시, 이전 state에 없던 옵션은 기준만 저장
 * @returns {{events: {handle:string,title:string,variants:{id:number,title:string,price:string}[]}[], nextState: object, warnings: string[]}}
 */
export function detect(watchlist, catalog, prevState) {
  const events = [];
  const warnings = [];
  const nextProducts = {};
  const prevProducts = prevState?.products ?? {};

  for (const item of watchlist.items) {
    const product = catalog.get(item.handle);
    if (!product) {
      warnings.push(`카탈로그에 없는 상품: ${item.handle} (상태 유지)`);
      if (prevProducts[item.handle]) nextProducts[item.handle] = prevProducts[item.handle];
      continue;
    }
    const current = Object.fromEntries(product.variants.map((v) => [v.id, v.available]));
    const prev = prevProducts[item.handle];
    nextProducts[item.handle] = current;
    if (!prev) continue; // 첫 실행: 기준만 저장

    const tracked =
      item.variants === 'all' ? product.variants : product.variants.filter((v) => item.variants.includes(v.id));
    if (item.variants !== 'all') {
      for (const id of item.variants) if (!(id in current)) warnings.push(`${item.handle}: 옵션 ${id} 없음`);
    }

    const restocked = tracked.filter((v) => {
      if (!v.available) return false;
      const was = prev[v.id];
      return was === false || (was === undefined && item.variants === 'all');
    });
    if (restocked.length) {
      events.push({
        handle: product.handle,
        title: product.title,
        variants: restocked.map((v) => ({ id: v.id, title: v.title, price: v.price })),
      });
    }
  }
  return { events, nextState: { products: nextProducts }, warnings };
}
