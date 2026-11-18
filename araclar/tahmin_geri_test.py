#!/usr/bin/env python3
"""tahmin.py yönteminin geçmişteki başarısını ölçer.

Her gün, o güne kadar bilinen verilerle tahmin.py'nin vereceği yönü hesaplar ve
sonraki 3 gün içinde gelen gerçek pompa değişikliğiyle karşılaştırır.
Ayrıca değişiklik başına maliyet farkı → pompa farkı geçiş katsayısını (β) bulur;
tahmin.py'deki URUNLER[...]['katsayi'] değerleri buradan gelir.

Kullanım (proje kökünden):
    python araclar/tahmin_geri_test.py [başlangıç-yılı]   (varsayılan 2024)
"""
import os
import sys
from datetime import date, timedelta

import requests

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import tahmin as T  # noqa: E402

ILERI_GUN = 3  # tahmin bu kadar gün içinde gelen değişiklikle karşılaştırılır


def opet_fiyatlar(baslangic, bitis):
    """Opet İstanbul arşivinden {ürün: {gün: fiyat}} (yıl yıl çekilir)."""
    fiyat = {u: {} for u in T.URUNLER}
    bas = baslangic
    while bas <= bitis:
        son = min(date(bas.year, 12, 31), bitis)
        r = requests.get(
            'https://api.opet.com.tr/api/fuelprices/prices/archive',
            params={'DistrictCode': 934015, 'StartDate': bas.isoformat(), 'EndDate': son.isoformat(),
                    'IncludeAllProducts': 'true'},
            headers={**T.KIMLIK, 'Channel': 'Web', 'Accept': 'application/json'}, timeout=60)
        r.raise_for_status()
        for g in r.json():
            gun = date.fromisoformat(g['day'][:10])
            for p in g['prices']:
                for u, ayar in T.URUNLER.items():
                    if p['productCode'] == ayar['opet'] and p['amount'] > 0:
                        fiyat[u][gun] = p['amount']
        bas = son + timedelta(days=1)
    return fiyat


def olc(urun, maliyet, degisimler, katsayi):
    # 1) Geçiş katsayısı: ardışık değişiklikler arasında maliyet farkı vs pompa farkı
    xs, ys = [], []
    for (g0, _), (g1, dp) in zip(degisimler, degisimler[1:]):
        m0, m1 = T.ortalama_once(maliyet, g0), T.ortalama_once(maliyet, g1)
        if m0 is not None and m1 is not None:
            xs.append(1.2 * (m1 - m0))
            ys.append(dp)
    # Vergi (ÖTV) gibi maliyetle açıklanamayan sıçramaları ayıkla
    ciftler = [(x, y) for x, y in zip(xs, ys) if abs(y - x) < 3]
    yon_ayni = sum((x > 0) == (y > 0) for x, y in ciftler) / max(len(ciftler), 1)
    beta = sum(x * y for x, y in ciftler) / max(sum(x * x for x, _ in ciftler), 1e-9)
    print(f'\n=== {urun.upper()}: {len(degisimler)} pompa değişikliği '
          f'({degisimler[0][0]} → {degisimler[-1][0]})')
    print(f'  Değişiklik başına: maliyet farkı ile pompa farkı aynı yönde %{yon_ayni * 100:.0f} '
          f'(n={len(ciftler)}, vergi vb. ayıklanan {len(xs) - len(ciftler)}); '
          f'geçiş katsayısı β={beta:.2f} (tahmin.py: {katsayi})')

    # 2) Günlük sinyal: tahmin.py'nin her gün vereceği yön, sonraki 3 günde ne oldu?
    #    Güven düzeyine göre ayrı sayılır (tahmin.py: orta = ESIK_OLASI..ESIK_GUCLU, yüksek = üstü).
    gunluk = dict(degisimler)
    sayac = {d: {'dogru': 0, 'yanlis': 0, 'bosa': 0} for d in ('orta', 'yuksek')}
    kacan = yatay_dogru = 0
    for gun in (g for g in sorted(maliyet) if g > degisimler[0][0]):
        son = max(g for g, _ in degisimler if g <= gun)
        fark = T.bekleyen_fark(maliyet, son, gun, katsayi)
        yon = T.yon_belirle(fark)
        gelen = [gunluk[g] for g in sorted(gunluk) if gun < g <= gun + timedelta(days=ILERI_GUN)]
        gercek = gelen[0] if gelen else 0
        if yon == 'yatay':
            if abs(gercek) >= 1.0:
                kacan += 1
            else:
                yatay_dogru += 1
            continue
        s = sayac['yuksek' if abs(fark) >= T.ESIK_GUCLU else 'orta']
        if gercek == 0:
            s['bosa'] += 1
        elif (gercek > 0) == (yon == 'zam'):
            s['dogru'] += 1
        else:
            s['yanlis'] += 1
    for duzey, s in sayac.items():
        top = s['dogru'] + s['yanlis']
        print(f'  Güven {duzey:6s}: {ILERI_GUN} gün içinde değişiklik geldiğinde yön doğru '
              f'%{100 * s["dogru"] / max(top, 1):.0f} ({s["dogru"]}/{top}); değişiklik gelmeyen {s["bosa"]} gün')
    print(f'  "Yatay" günler: doğru {yatay_dogru}, arada 1 TL+ değişiklik gelen {kacan} '
          f'(çoğu vergi ya da aynı gün yansıyan ani hareket)')


def main(argv):
    yil = int(argv[0]) if argv else 2024
    baslangic, bitis = date(yil, 1, 1), date.today()
    aralik = f'{(bitis.year - yil + 1)}y'
    kur = T.yahoo_seri('TRY=X', aralik)
    fiyatlar = opet_fiyatlar(baslangic, bitis)
    for u, ayar in T.URUNLER.items():
        maliyet = {g: v for g, v in T.maliyet_serisi(T.yahoo_seri(ayar['vadeli'], aralik), kur).items()
                   if g >= baslangic}
        olc(u, maliyet, T.degisim_gunleri(fiyatlar[u]), ayar['katsayi'])
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
