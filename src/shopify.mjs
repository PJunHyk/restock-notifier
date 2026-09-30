// Shopify 공개 카탈로그(/products.json)만 사용한다. 로그인·HTML 크롤링 없음.
export const BASE = process.env.SHOP_BASE ?? 'https://thetoyspot.net';
const UA = 'Mozilla/5.0 (personal restock notifier)';
const PAGE_SIZE = 250;
const MAX_PAGES = 20;

async function getJson(url, fetchImpl, tries = 3) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (i < tries) await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
  throw lastErr;
}

/** 전체 카탈로그를 Map<handle, product>로 반환. 어느 페이지든 실패하면 throw (부분 결과는 쓰지 않는다). */
export async function fetchCatalog(fetchImpl = fetch) {
  const catalog = new Map();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await getJson(`${BASE}/products.json?limit=${PAGE_SIZE}&page=${page}`, fetchImpl);
    const products = data?.products;
    if (!Array.isArray(products)) throw new Error('Unexpected /products.json shape');
    for (const p of products) {
      catalog.set(p.handle, {
        id: p.id,
        handle: p.handle,
        title: p.title,
        variants: p.variants.map((v) => ({
          id: v.id,
          title: v.title,
          available: v.available === true,
          price: v.price,
        })),
      });
    }
    if (products.length < PAGE_SIZE) return catalog;
  }
  throw new Error(`Catalog exceeded ${MAX_PAGES} pages`);
}

export const productUrl = (handle) => `${BASE}/products/${handle}`;
// /cart/{id}:1 은 체크아웃으로 넘어가므로 쓰지 않는다. /cart/add 는 장바구니 페이지에서 멈춘다.
export const addToCartUrl = (variantId) => `${BASE}/cart/add?id=${variantId}&quantity=1&return_to=/cart`;
