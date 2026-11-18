#!/usr/bin/env python3
"""Akaryakıt zam / indirim tahmini → tahmin.json

Yöntem
------
Türkiye'de pompa fiyatı, Akdeniz ürün fiyatını (dizel, benzin) ve dolar kurunu
birkaç gün geriden izler. Bu betik:

1. Ürün maliyetini TL/litre olarak hesaplar:
     motorin ← ABD dizel vadelisi (HO=F, ULSD, $/galon)
     benzin  ← ABD benzin vadelisi (RB=F, RBOB, $/galon)
     × dolar/TL kuru ÷ 3,785 litre
   (Akdeniz fiyatları ücretli; bu iki vadeli onlarla birlikte hareket eder.)
2. Son pompa değişikliğinin tarihini bulur (Opet İstanbul fiyat arşivi;
   erişilemezse fiyat botunun gecmis.json dosyası).
3. Son değişiklikten bu yana birikmiş maliyet farkını, geri testte bulunan
   geçiş katsayısıyla pompa fiyatı farkına çevirir: bu, bir sonraki
   değişikliğin yönü ve yaklaşık tutarıdır.
4. Haber başlıklarına (Google Haberler) bakar; "motorine zam geliyor" gibi
   başlıklar hesapla aynı yönü gösteriyorsa güveni artırır.

Doğruluk: araclar/tahmin_geri_test.py (2024'ten bu yana pompa değişiklikleri).
Vergi (ÖTV) artışları piyasaya değil karara bağlıdır; bu yöntemle öngörülemez.

Kullanım: python tahmin.py            → tahmin.json yazar
          python tahmin.py --deneme   → yalnızca ekrana yazar
"""
import html
import json
import re
import statistics as st
import sys
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone

import requests

CIKTI = 'tahmin.json'
GECMIS_DOSYASI = 'gecmis.json'
LITRE_GALON = 3.78541
KIMLIK = {'User-Agent': 'Mozilla/5.0 (OtoYakit fiyat tahmini)'}

URUNLER = {
    # vadeli sembolü, geçiş katsayısı (geri testten), Opet ürün kodu
    'motorin': {'vadeli': 'HO=F', 'katsayi': 0.9, 'opet': 'A121'},
    'benzin':  {'vadeli': 'RB=F', 'katsayi': 0.6, 'opet': 'A100'},
}
PENCERE = 5          # maliyet ortalaması: son 5 işlem günü
ESIK_OLASI = 0.75    # TL/L: altındaysa "belirgin değişiklik beklenmiyor"
ESIK_GUCLU = 2.0     # TL/L: üstündeyse güven yüksek (geri testte yön ~%95 doğru)
DEGISIM_ESIGI = 0.05 # TL/L: pompa fiyatında bu kadar oynama "değişiklik" sayılır


# ── Saf hesaplar (geri test de bunları kullanır) ─────────────────────────────
def maliyet_serisi(vadeli, kur):
    """{gün: TL/litre} — iki serinin ortak günleri."""
    return {g: vadeli[g] * kur[g] / LITRE_GALON for g in sorted(set(vadeli) & set(kur))}


def ortalama_once(seri, gun, n=PENCERE):
    """`gun`den ÖNCEKİ son n gözlemin ortalaması (o gün dahil değil)."""
    gunler = [g for g in seri if g < gun][-n:]
    return st.mean(seri[g] for g in gunler) if len(gunler) >= min(n, 2) else None


def degisim_gunleri(fiyatlar):
    """{gün: fiyat} serisinden fiyatın değiştiği günler: [(gün, fark)]."""
    gunler = sorted(fiyatlar)
    return [(b, fiyatlar[b] - fiyatlar[a]) for a, b in zip(gunler, gunler[1:])
            if abs(fiyatlar[b] - fiyatlar[a]) >= DEGISIM_ESIGI]


def bekleyen_fark(maliyet, son_degisim, bugun, katsayi):
    """Son değişiklikten bu yana birikmiş, pompaya yansıması beklenen fark (TL/L, KDV dahil)."""
    m0 = ortalama_once(maliyet, son_degisim)
    m1 = ortalama_once(maliyet, bugun + timedelta(days=1))
    if m0 is None or m1 is None:
        return None
    return round(katsayi * 1.2 * (m1 - m0), 2)


def yon_belirle(fark):
    if fark is None or abs(fark) < ESIK_OLASI:
        return 'yatay'
    return 'zam' if fark > 0 else 'indirim'


# ── Haber başlıkları ─────────────────────────────────────────────────────────
GELECEK = re.compile(r'gel(iyor|ecek|ebilir)|bekleniyor|beklentisi|yolda|g[öo]r[üu]nd[üu]|kap[ıi]da|'
                     r'yap[ıi]lacak|sinyal|uyar[ıi]|haz[ıi]rl[ıi]k|tarih|netle[şs]ti|m[üu]jde|s[ıi]rada')
SORU = re.compile(r'(zam|indirim|geldi|var|geliyor|olacak)\w*\s+m[ıiuü](?!\w)')
URUN_DESEN = {
    'motorin': re.compile(r'motorin|mazot|dizel'),
    'benzin': re.compile(r'benzin'),
}
TUTAR = re.compile(r'(\d+(?:[.,]\d+)?)\s*(?:tl|lira)(?:\s*(\d{1,2})\s*kuru[şs])?')


def tr_kucuk(metin):
    return metin.replace('İ', 'i').replace('I', 'ı').lower()


def baslik_yorumla(baslik):
    """Başlıktan {ürün: (yön, tutar|None)} çıkarır. Başlık cümlelere bölünür;
    soru kalıplı ("zam mı geliyor?") ya da zam ve indirimi birlikte anan
    cümleler sayılmaz, yalnızca beklenti bildirenler ("geliyor", "yolda") sayılır."""
    sonuc = {}
    for cumle in re.split(r'[!?.|:;,]+', tr_kucuk(baslik)):
        zam, indirim = 'zam' in cumle, 'indirim' in cumle
        if zam == indirim or SORU.search(cumle) or not GELECEK.search(cumle):
            continue
        yon = 'zam' if zam else 'indirim'
        tutar = None
        t = TUTAR.search(cumle)
        if t:
            deger = float(t.group(1).replace(',', '.')) + (int(t.group(2)) / 100 if t.group(2) else 0)
            if 0.2 <= deger <= 15:  # litre başına makul aralık
                tutar = round(deger, 2)
        urunler = [u for u, d in URUN_DESEN.items() if d.search(cumle)]
        if not urunler and 'akaryak' in cumle:
            urunler = list(URUN_DESEN)
        for u in urunler:
            sonuc.setdefault(u, (yon, tutar))
    return sonuc


def haberleri_ozetle(basliklar, sinirlar=None):
    """[(başlık, yayın zamanı)] → {ürün: {'yon', 'adet', 'tutar'}} (en az 2 başlık).

    `sinirlar` {ürün: datetime}: bu andan önce yayımlanan başlıklar o ürün için
    sayılmaz (son pompa değişikliğinden önceki haberler o değişikliği anlatır)."""
    sinirlar = sinirlar or {}
    sayac = {u: {'zam': [], 'indirim': []} for u in URUN_DESEN}
    for baslik, zaman in basliklar:
        for u, (yon, tutar) in baslik_yorumla(baslik).items():
            if u in sinirlar and zaman < sinirlar[u]:
                continue
            sayac[u][yon].append(tutar)
    ozet = {}
    for u, d in sayac.items():
        z, i = len(d['zam']), len(d['indirim'])
        if max(z, i) < 2 or z == i:
            continue
        yon = 'zam' if z > i else 'indirim'
        tutarlar = [t for t in d[yon] if t is not None]
        ozet[u] = {'yon': yon, 'adet': max(z, i),
                   'tutar': round(st.median(tutarlar), 2) if tutarlar else None}
    return ozet


def birlestir(fark, haber):
    """Hesap ve haberi tek sonuca çevirir."""
    yon = yon_belirle(fark)
    if yon == 'yatay':
        if haber and haber['adet'] >= 3:
            return {'yon': haber['yon'], 'tutar': haber['tutar'], 'guven': 'orta', 'dayanak': 'haber'}
        return {'yon': 'yatay', 'tutar': None, 'guven': None, 'dayanak': 'hesap'}
    tutar = round(abs(fark) * 4) / 4  # çeyrek liraya yuvarla: hassasiyet iddiası yok
    if haber and haber['yon'] == yon and haber['tutar']:
        # Sektör kaynaklı haberler gerçek Akdeniz fiyatını bilir; aynı yöndeyse tutarı onlardan al
        tutar = haber['tutar']
    if haber and haber['yon'] != yon:
        guven = 'dusuk'
    elif abs(fark) >= ESIK_GUCLU or (haber and haber['yon'] == yon):
        guven = 'yuksek'
    else:
        guven = 'orta'
    return {'yon': yon, 'tutar': tutar, 'guven': guven,
            'dayanak': 'hesap+haber' if haber and haber['yon'] == yon else 'hesap'}


# ── Veri çekme ───────────────────────────────────────────────────────────────
def yahoo_seri(sembol, aralik='3mo'):
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{sembol}'
    r = requests.get(url, params={'range': aralik, 'interval': '1d'}, headers=KIMLIK, timeout=30)
    r.raise_for_status()
    sonuc = r.json()['chart']['result'][0]
    seri = {}
    for t, c in zip(sonuc['timestamp'], sonuc['indicators']['quote'][0]['close']):
        if c:
            seri[datetime.fromtimestamp(t, timezone.utc).date()] = c
    if len(seri) < PENCERE * 2:
        raise ValueError(f'{sembol}: yetersiz veri ({len(seri)} gün)')
    return seri


def tcmb_kur():
    """TCMB'nin bugünkü dolar satış kuru (Yahoo kuru alınamazsa yedek)."""
    r = requests.get('https://www.tcmb.gov.tr/kurlar/today.xml', headers=KIMLIK, timeout=30)
    r.raise_for_status()
    kok = ET.fromstring(r.content)
    usd = kok.find(".//Currency[@CurrencyCode='USD']/ForexSelling")
    return float(usd.text)


def opet_degisimler(gun_sayisi=60):
    """Opet İstanbul (Avrupa) arşivinden ürün başına pompa değişiklik günleri."""
    bitis = date.today()
    baslangic = bitis - timedelta(days=gun_sayisi)
    r = requests.get(
        'https://api.opet.com.tr/api/fuelprices/prices/archive',
        params={'DistrictCode': 934015, 'StartDate': baslangic.isoformat(),
                'EndDate': bitis.isoformat(), 'IncludeAllProducts': 'true'},
        headers={**KIMLIK, 'Channel': 'Web', 'Accept': 'application/json'}, timeout=30)
    r.raise_for_status()
    fiyat = {u: {} for u in URUNLER}
    for g in r.json():
        gun = date.fromisoformat(g['day'][:10])
        for p in g['prices']:
            for u, ayar in URUNLER.items():
                if p['productCode'] == ayar['opet'] and p['amount'] > 0:
                    fiyat[u][gun] = p['amount']
    return {u: degisim_gunleri(f) for u, f in fiyat.items()}


def gecmisten_degisimler():
    """Yedek: fiyat botunun gecmis.json'undaki Türkiye medyanından değişiklik günleri."""
    with open(GECMIS_DOSYASI, encoding='utf-8') as f:
        g = json.load(f)
    sonuc = {}
    for u in URUNLER:
        seri = {date.fromisoformat(gun): v for gun, v in zip(g['gunler'], g['turkiye'].get(u, [])) if v}
        sonuc[u] = degisim_gunleri(seri)
    return sonuc


def haber_basliklari(saat=96):
    sorgu = 'motorine zam OR motorine indirim OR benzine zam OR benzine indirim OR akaryakıta zam OR akaryakıta indirim'
    r = requests.get('https://news.google.com/rss/search',
                     params={'q': sorgu, 'hl': 'tr', 'gl': 'TR', 'ceid': 'TR:tr'},
                     headers=KIMLIK, timeout=30)
    r.raise_for_status()
    sinir = datetime.now(timezone.utc) - timedelta(hours=saat)
    sonuc = []
    for item in ET.fromstring(r.content).iter('item'):
        baslik = html.unescape(item.findtext('title') or '')
        try:
            zaman = datetime.strptime(item.findtext('pubDate'), '%a, %d %b %Y %H:%M:%S %Z').replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            continue
        if zaman >= sinir:
            sonuc.append((re.sub(r'\s+-\s+[^-]+$', '', baslik), zaman))  # sondaki " - Kaynak" kısmı
    return sonuc


# ── Ana akış ─────────────────────────────────────────────────────────────────
def main(argv):
    deneme = '--deneme' in argv
    bugun = datetime.now(timezone.utc).date()

    try:
        kur = yahoo_seri('TRY=X')
    except Exception as e:
        print(f'⚠ Yahoo kuru alınamadı ({e}); TCMB kuru tüm günlere uygulanacak.')
        kur = None
    try:
        vadeliler = {u: yahoo_seri(a['vadeli']) for u, a in URUNLER.items()}
    except Exception as e:
        print(f'❌ Piyasa verisi alınamadı: {e}. {CIKTI} değiştirilmedi.')
        return 1
    if kur is None:
        try:
            sabit = tcmb_kur()
        except Exception as e:
            print(f'❌ Kur da alınamadı: {e}. {CIKTI} değiştirilmedi.')
            return 1
        kur = {g: sabit for v in vadeliler.values() for g in v}

    try:
        degisimler, degisim_kaynagi = opet_degisimler(), 'opet-istanbul'
    except Exception as e:
        print(f'⚠ Opet arşivi alınamadı ({e}); gecmis.json kullanılıyor.')
        try:
            degisimler, degisim_kaynagi = gecmisten_degisimler(), 'gecmis.json'
        except Exception as e2:
            print(f'❌ Son pompa değişikliği bulunamadı: {e2}. {CIKTI} değiştirilmedi.')
            return 1

    # Haber, son pompa değişikliğinin ertesi gününden (TSİ 00:00) sonra yayımlandıysa sayılır
    sinirlar = {u: datetime.combine(d[-1][0], datetime.min.time(), timezone.utc) + timedelta(hours=21)
                for u, d in degisimler.items() if d}
    try:
        haber = haberleri_ozetle(haber_basliklari(), sinirlar)
    except Exception as e:
        print(f'⚠ Haberler alınamadı ({e}); yalnızca hesap kullanılacak.')
        haber = {}

    sonuc = {
        'guncelleme': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'yontem': 'Ürün maliyeti (ABD dizel/benzin vadelisi × dolar kuru) son pompa değişikliğine göre',
        'kaynak': {'piyasa': 'Yahoo Finance', 'pompa': degisim_kaynagi, 'haber': 'Google Haberler'},
    }
    for u, ayar in URUNLER.items():
        gecmis = degisimler.get(u) or []
        if not gecmis:
            print(f'⚠ {u}: son pompa değişikliği bulunamadı, atlanıyor.')
            continue
        son_gun = gecmis[-1][0]
        maliyet = maliyet_serisi(vadeliler[u], kur)
        fark = bekleyen_fark(maliyet, son_gun, bugun, ayar['katsayi'])
        sonuc[u] = {
            **birlestir(fark, haber.get(u)),
            'hesap_fark': fark,
            'son_degisim': son_gun.isoformat(),
            'son_degisim_fark': round(gecmis[-1][1], 2),
            'haber': haber.get(u),
        }
        print(f"{u:8s} son değişiklik {son_gun} ({gecmis[-1][1]:+.2f}) | hesap {fark} TL | "
              f"haber {haber.get(u)} → {sonuc[u]['yon']} {sonuc[u]['tutar']} ({sonuc[u]['guven']})")

    if not any(u in sonuc for u in URUNLER):
        print(f'❌ Hiçbir ürün için tahmin yapılamadı. {CIKTI} değiştirilmedi.')
        return 1
    if deneme:
        print(json.dumps(sonuc, ensure_ascii=False, indent=1))
        return 0
    with open(CIKTI, 'w', encoding='utf-8') as f:
        json.dump(sonuc, f, ensure_ascii=False, indent=1)
    print(f'💾 {CIKTI} yazıldı.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
