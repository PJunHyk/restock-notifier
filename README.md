# thetoyspot-restock

thetoyspot.net 관심 상품 재입고 알림 (개인용). Shopify 공개 `/products.json` + ntfy + GitHub Actions.

- 자동 결제 없음. 알림 버튼은 `/cart/add?...&return_to=/cart` 로 장바구니에 1개 담고 멈춘다.
- 재고 있음/없음만 판단 (수량은 공개되지 않음).
- 첫 실행은 기준 상태만 저장하고 알림을 보내지 않는다.

## 관심 목록 (`data/watchlist.json`)

```json
{
  "items": [
    { "handle": "potential-man-culling-kit", "variants": "all" },
    { "handle": "some-other-product", "variants": [45943355768967] }
  ]
}
```

`handle`은 상품 URL의 `/products/` 뒷부분, `variants`는 `"all"` 또는 variant id 배열.

## 로컬 실행

```bash
npm test                 # 판정 로직 테스트
npm run dry              # 알림 전송/상태 저장 없이 실행
NTFY_TOPIC=... node src/check.mjs --test-notify   # 테스트 알림
```

## 배포

1. Public 저장소로 push (커밋 이메일 비공개 설정 권장).
2. Settings → Secrets and variables → Actions → `NTFY_TOPIC` 추가 (추측 불가능한 긴 랜덤 문자열).
3. 폰의 ntfy 앱에서 같은 토픽 구독 (소리·잠금 화면 표시 켜기).
4. Actions → check-restock → Run workflow → `test_notify` 체크로 테스트.

스케줄: 뉴욕 시각 기준 02·04·06시와 그 외 매시, 7분에 실행(하루 22회). GitHub 사정으로 지연될 수 있다.
마지막 커밋이 30일이 넘으면 빈 커밋을 남겨 60일 비활성 자동 중단을 막는다.

## 공개 범위 주의

저장소가 Public이므로 코드, 관심 목록, 상태 파일, 실행 로그가 공개된다. 토픽 이름은 Secret으로만 둘 것. 토큰을 파일에 커밋하지 말 것.
