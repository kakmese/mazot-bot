# -*- coding: utf-8 -*-
"""OtoYakıt fiyat botu.

doviz.com'daki ilçe bazlı akaryakıt fiyat tablolarını okur ve uygulamanın
indirdiği `veriler.json` dosyasını üretir.

Güvenlik kuralları (12 Eylül 2026'daki boş veri olayından sonra eklendi):
  * Tablo, CSS sınıfına göre değil sütun başlıklarına göre bulunur; site
    tasarımı değişse de başlıklar aynı kaldıkça çalışır.
  * Sonuç boş ya da şüpheli derecede küçükse `veriler.json`'a DOKUNULMAZ ve
    bot hata koduyla çıkar (GitHub Actions kırmızı olur, e-posta gelir).
  * Tek tek başarısız olan ilçelerde eski veri korunur.

Kullanım:
    python fiyat_botu.py                 # tüm Türkiye, veriler.json'ı günceller
    python fiyat_botu.py antalya bolu    # deneme: yalnızca bu iller,
                                         # veriler.test.json'a yazar
"""
import json
import os
import re
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests
from bs4 import BeautifulSoup

# Windows konsolunda ₺ ve emoji yazdırırken çökmesin
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# --- YEDEK İLÇE LİSTESİ ---
# İlçeler normalde her ilin sayfasındaki bağlantılardan otomatik keşfedilir.
# Keşif başarısız olursa bu liste kullanılır.
hedefler = {
    'adana': ['seyhan', 'yuregir', 'cukurova', 'saricam', 'ceyhan', 'kozan', 'imamoglu', 'karatas', 'karaisali', 'pozanti', 'yumurtalik', 'tufanbeyli', 'feke', 'aladag', 'saimbeyli'],
    'adiyaman': ['merkez', 'kahta', 'besni', 'golbasi', 'gerger', 'sincik', 'celikhan', 'tut', 'samsat'],
    'afyonkarahisar': ['merkez', 'sandikli', 'dinar', 'bolvadin', 'sinanpasa', 'emirdag', 'sultandagi', 'cay', 'iscehisar', 'ihsaniye', 'suhut', 'cobanlar', 'dazkiri', 'basmakci', 'evciler', 'hocalar', 'kiziloren'],
    'agri': ['merkez', 'patnos', 'dogubayazit', 'diyadin', 'eleskirt', 'tutak', 'taslicay', 'hamur'],
    'aksaray': ['merkez', 'ortakoy', 'eskil', 'guzelyurt', 'agacoren', 'sariyahsi', 'sultanhani'],
    'amasya': ['merkez', 'merzifon', 'suluova', 'tasova', 'gumushacikoy', 'goynucek', 'hamamozu'],
    'ankara': ['cankaya', 'kecioren', 'yenimahalle', 'mamak', 'etimesgut', 'sincan', 'altindag', 'pursaklar', 'golbasi', 'polatli', 'cubuk', 'kahramankazan', 'beypazari', 'elmadag', 'sereflikochisar', 'akyurt', 'nallihan', 'haymana', 'kizilcahamam', 'bala', 'kalecik', 'ayas', 'gudul', 'camlidere', 'evren'],
    'antalya': ['kepez', 'muratpasa', 'alanya', 'manavgat', 'konyaalti', 'serik', 'aksu', 'kumluca', 'dosemealti', 'kas', 'korkuteli', 'gazipasa', 'finike', 'kemer', 'elmali', 'demre', 'akseki', 'gundogmus', 'ibradi'],
    'ardahan': ['merkez', 'gole', 'cildir', 'hanak', 'posof', 'damal'],
    'artvin': ['merkez', 'hopa', 'borcka', 'yusufeli', 'arhavi', 'savsat', 'ardanuc', 'murgul', 'kemalpasa'],
    'aydin': ['efeler', 'nazilli', 'soke', 'kusadasi', 'didim', 'incirliova', 'cine', 'germencik', 'bozdogan', 'kosk', 'kuyucak', 'sultanhisar', 'karacasu', 'buharkent', 'yenipazar', 'karpuzlu'],
    'balikesir': ['altieylul', 'karesi', 'edremit', 'bandirma', 'gonen', 'ayvalik', 'burhaniye', 'bigadic', 'susurluk', 'dursunbey', 'sindirgi', 'ivrindi', 'erdek', 'havran', 'kepsut', 'manyas', 'savastepe', 'balya', 'gomec', 'marmara'],
    'bartin': ['merkez', 'ulus', 'amasra', 'kurucasile'],
    'batman': ['merkez', 'kozluk', 'sason', 'besiri', 'gercus', 'hasankeyf'],
    'bayburt': ['merkez', 'demirozu', 'aydintepe'],
    'bilecik': ['merkez', 'bozuyuk', 'osmaneli', 'sogut', 'golpazari', 'pazaryeri', 'inhisar', 'yenipazar'],
    'bingol': ['merkez', 'genc', 'solhan', 'karliova', 'adakli', 'kigi', 'yedisu', 'yayladere'],
    'bitlis': ['merkez', 'tatvan', 'guroymak', 'hizan', 'adilcevaz', 'ahlat', 'mutki'],
    'bolu': ['merkez', 'gerede', 'mudurnu', 'goynuk', 'mengen', 'yenicaga', 'dortdivan', 'seben', 'kibriscik'],
    'burdur': ['merkez', 'bucak', 'golhisar', 'yesilova', 'cavdir', 'tefenni', 'aglasun', 'karamanli', 'altinyayla', 'celtikci', 'kemer'],
    'bursa': ['osmangazi', 'yildirim', 'nilufer', 'inegol', 'gemlik', 'mustafakemalpasa', 'mudanya', 'gursu', 'karacabey', 'orhangazi', 'kestel', 'yenisehir', 'iznik', 'orhaneli', 'keles', 'buyukorhan', 'harmancik'],
    'canakkale': ['merkez', 'biga', 'can', 'gelibolu', 'bayramic', 'ezine', 'ayvacik', 'yenice', 'lapseki', 'eceabat', 'gokceada', 'bozcaada'],
    'cankiri': ['merkez', 'cerkes', 'ilgaz', 'orgun', 'kursunlu', 'yaprakli', 'sabanozu', 'kizilirmak', 'eldivan', 'atkaracalar', 'bayramoren', 'korgun'],
    'corum': ['merkez', 'sungurlu', 'osmancik', 'iskilip', 'alaca', 'bayat', 'mecitozu', 'kargi', 'ortakoy', 'ugurludag', 'dodurga', 'oguzlar', 'lacin', 'bogazkale'],
    'denizli': ['pamukkale', 'merkezefendi', 'civril', 'acipayam', 'tavas', 'honaz', 'saraykoy', 'buldan', 'kale', 'cal', 'cameli', 'serinhisar', 'bozkurt', 'guney', 'cardak', 'bekilli', 'beyagac', 'babadag', 'baklan'],
    'diyarbakir': ['baglar', 'kayapinar', 'yenisehir', 'sur', 'ergani', 'bismil', 'silvan', 'cinar', 'cermik', 'dicle', 'kulp', 'hani', 'lice', 'egil', 'hazro', 'kocakoy', 'cungus'],
    'duzce': ['merkez', 'akcakoca', 'kaynasli', 'golyaka', 'cilimli', 'yigilca', 'gumusova', 'cumayeri'],
    'edirne': ['merkez', 'kesan', 'uzunkopru', 'ipsala', 'havsa', 'meric', 'enez', 'suloglu', 'lalapasa'],
    'elazig': ['merkez', 'kovancilar', 'karakocan', 'palu', 'aracak', 'baskil', 'maden', 'sivrice', 'alacakaya', 'keban', 'agin'],
    'erzincan': ['merkez', 'uzumlu', 'tercan', 'cayirli', 'ilic', 'kemah', 'kemaliye', 'otlukbeli', 'refahiye'],
    'erzurum': ['yakutiye', 'palandoken', 'aziziye', 'horasan', 'oltu', 'pasinler', 'karayazi', 'hinis', 'tekman', 'karacoban', 'askale', 'senkaya', 'cat', 'koprukoy', 'ispir', 'tortum', 'narman', 'uzundere', 'olur', 'pazaryolu'],
    'eskisehir': ['odunpazari', 'tepebasi', 'sivrihisar', 'cifteler', 'seyitgazi', 'alpu', 'mihaliccik', 'mahmudiye', 'beylikova', 'inonu', 'gunyuzu', 'saricakaya', 'mihalgazi', 'han'],
    'gaziantep': ['sahinbey', 'sehitkamil', 'nizip', 'islahiye', 'oguzeli', 'araban', 'nurdagi', 'yavuzeli', 'karkamis'],
    'giresun': ['merkez', 'bulancak', 'espiye', 'gorele', 'tirebolu', 'dereli', 'yaglidere', 'kesap', 'piraziz', 'ebunesip', 'gucce', 'cavuslu', 'dogankent', 'camoluk'],
    'gumushane': ['merkez', 'kelkit', 'siran', 'kurtun', 'torul', 'kose'],
    'hakkari': ['merkez', 'yuksekova', 'semdinli', 'cukurca', 'derecik'],
    'hatay': ['antakya', 'iskenderun', 'defne', 'dortyol', 'samandag', 'kirikhan', 'reyhanli', 'arsuz', 'altinozu', 'hassa', 'erzin', 'payas', 'belen', 'yayladagi', 'kumlu'],
    'igdir': ['merkez', 'tuzluca', 'aralik', 'karakoyunlu'],
    'isparta': ['merkez', 'yalvac', 'egirdir', 'sarkikaraagac', 'gelendost', 'keciborlu', 'senirkent', 'sutculer', 'gonen', 'uluborlu', 'atabey', 'aksu', 'yenisarbademli'],
    'istanbul-avrupa': ['arnavutkoy', 'avcilar', 'bagcilar', 'bahcelievler', 'bakirkoy', 'basaksehir', 'bayrampasa', 'besiktas', 'beylikduzu', 'beyoglu', 'buyukcekmece', 'catalca', 'esenler', 'esenyurt', 'eyupsultan', 'fatih', 'gaziosmanpasa', 'gungoren', 'kagithane', 'kucukcekmece', 'sariyer', 'silivri', 'sultangazi', 'sisli', 'zeytinburnu'],
    'istanbul-anadolu': ['adalar', 'atasehir', 'beykoz', 'cekmekoy', 'kadikoy', 'kartal', 'maltepe', 'pendik', 'sancaktepe', 'sultanbeyli', 'sile', 'tuzla', 'umraniye', 'uskudar'],
    'izmir': ['buca', 'karabaglar', 'bornova', 'konak', 'karsiyaka', 'bayrakli', 'cigli', 'torbali', 'menemen', 'gaziemir', 'odemis', 'kemalpasa', 'bergama', 'aliaga', 'menderes', 'tire', 'balcova', 'narlidere', 'urla', 'kiraz', 'dikili', 'cesme', 'bayindir', 'seferihisar', 'selcuk', 'guzelbahce', 'foca', 'kinik', 'beydag', 'karaburun'],
    'kahramanmaras': ['onikisubat', 'dulkadiroglu', 'elbistan', 'afsin', 'turkoglu', 'pazarcik', 'goksun', 'andirin', 'caglayancerit', 'turkoglu', 'nurhak', 'ekinozu'],
    'karabuk': ['merkez', 'safranbolu', 'yenice', 'eskipazar', 'eflani', 'ovacik'],
    'karaman': ['merkez', 'ermenek', 'sariveliler', 'ayranci', 'kazimkarabekir', 'basyayla'],
    'kars': ['merkez', 'kagizman', 'sarikamis', 'selim', 'digor', 'arpaçay', 'akyaka', 'susuz'],
    'kastamonu': ['merkez', 'tosya', 'taskopru', 'cide', 'inebolu', 'arac', 'devrekani', 'bozkurt', 'daday', 'azdavay', 'catalzeytin', 'kure', 'doganyurt', 'ihsangazi', 'pinarbasi', 'senpazar', 'seydiler', 'hanonu', 'agli'],
    'kayseri': ['melikgazi', 'kocasinan', 'talas', 'develi', 'yahyali', 'bunyan', 'incesu', 'pinarbasi', 'tomarza', 'yesilhisar', 'sarioglan', 'hacilar', 'sariz', 'akkisla', 'felahiye', 'ozvatan'],
    'kilis': ['merkez', 'musabeyli', 'elbeyli', 'polateli'],
    'kirikkale': ['merkez', 'yahsihan', 'keskin', 'delice', 'bahsili', 'sulakyurt', 'baliseyh', 'karakecili', 'celebi'],
    'kirklareli': ['merkez', 'luleburgaz', 'babaeski', 'vize', 'pinarhisar', 'demirkoy', 'pehlivankoy', 'kofcaz'],
    'kirsehir': ['merkez', 'kaman', 'mucur', 'cicekdagi', 'akpinar', 'boztepe', 'akcakent'],
    'kocaeli': ['gebze', 'izmit', 'darica', 'korfez', 'golcuk', 'derince', 'cayirova', 'kartepe', 'basiskele', 'karamursel', 'dilovasi', 'kandira'],
    'konya': ['selcuklu', 'meram', 'karatay', 'eregli', 'aksehir', 'beysehir', 'cumra', 'seydisehir', 'ilgin', 'cihanbeyli', 'kulu', 'karapinar', 'kadinhani', 'sarayonu', 'bozkir', 'yunak', 'doganhisar', 'huyuik', 'altinekin', 'hadim', 'celtik', 'emirgazi', 'tuzlukcu', 'derebucak', 'akoren', 'halkapinar', 'yalihuyuk'],
    'kutahya': ['merkez', 'tavsanli', 'simav', 'gediz', 'emet', 'altintas', 'domanic', 'hisarcik', 'aslanapa', 'cavdarhisar', 'saphane', 'pazarlar', 'duumlupinar'],
    'malatya': ['battalgazi', 'yesilyurt', 'dogansehir', 'akcadag', 'darende', 'hekimhan', 'pazaryolu', 'yazihan', 'arapgir', 'arguvan', 'kale', 'kuluncak', 'doganyol'],
    'manisa': ['yunusemre', 'sehzadeler', 'akhisar', 'turgutlu', 'salihli', 'soma', 'alasehir', 'saruhanli', 'kula', 'kirkagac', 'demirci', 'sarigol', 'gordes', 'selendi', 'ahmetli', 'golmarmara', 'koprubasi'],
    'mardin': ['kiziltepe', 'artuklu', 'midyat', 'nusaybin', 'derik', 'mazidagi', 'dargecit', 'savur', 'yesilli', 'omerli'],
    'mersin': ['tarsus', 'toroslar', 'yenisehir', 'akdeniz', 'mezitli', 'erdemli', 'silifke', 'anamur', 'mut', 'bozyazi', 'gulnar', 'aydinci', 'camliyayla'],
    'mugla': ['bodrum', 'fethiye', 'milas', 'mentese', 'marmaris', 'seydikemer', 'ortaca', 'dalaman', 'yatagan', 'koycegiz', 'ula', 'datca', 'kavaklidere'],
    'mus': ['merkez', 'bulanik', 'malazgirt', 'varto', 'haskoy', 'korkut'],
    'nevsehir': ['merkez', 'urgup', 'avanos', 'gulsehir', 'derinkuyu', 'acigol', 'kozakli', 'hacibektas'],
    'nigde': ['merkez', 'bor', 'ciftlik', 'ulukisla', 'altunhisar', 'camardi'],
    'ordu': ['altinordu', 'unye', 'fatsa', 'golkoy', 'persembe', 'kumru', 'korgan', 'akkuis', 'aybasti', 'ulubey', 'ikizce', 'catalpinar', 'gurgen', 'caybasi', 'kabatas'],
    'osmaniye': ['merkez', 'kadirli', 'duzici', 'bahce', 'toprakkale', 'sumbas', 'hasanbeyli'],
    'rize': ['merkez', 'cayeli', 'ardesen', 'pazar', 'findikli', 'guneysu', 'kalkandere', 'iyidere', 'derepazari', 'camlihemsin', 'ikizdere', 'hemsin'],
    'sakarya': ['adapazari', 'serdivan', 'akyazi', 'erenler', 'hendek', 'karasu', 'geyve', 'arifiye', 'sapanca', 'pamukova', 'ferizli', 'kaynarca', 'kocaali', 'karapurcek', 'tarakli'],
    'samsun': ['ilkadim', 'atakum', 'bafra', 'carsamba', 'canik', 'vezirkopru', 'terme', 'tekkekoy', 'havza', 'alacam', '19-mayis', 'kavak', 'salipazari', 'asarcik', 'ladik', 'yakakent'],
    'siirt': ['merkez', 'kurtalan', 'pervari', 'baykan', 'sirvan', 'eruh', 'tillo'],
    'sinop': ['merkez', 'boyabat', 'gerze', 'ayancik', 'duragan', 'turkeli', 'erfelek', 'dikmen', 'sarayduzu'],
    'sivas': ['merkez', 'sarkisla', 'yildizeli', 'susehri', 'gemerek', 'kangal', 'zara', 'divrigi', 'gurun', 'hafik', 'ulastir', 'imranli', 'koyulhisar', 'akincilar', 'glova', 'doganisar'],
    'sanliurfa': ['eyyubiye', 'haliliye', 'siverek', 'viransehir', 'karakopru', 'akcakale', 'suruc', 'birecik', 'harran', 'ceylanpinar', 'bozova', 'hilvan', 'halfeti'],
    'sirnak': ['cizre', 'silopi', 'merkez', 'idil', 'uludere', 'beytussebap', 'guclukonak'],
    'tekirdag': ['corlu', 'suleymanpasa', 'cerkezkoy', 'kapakli', 'ergene', 'malkara', 'saray', 'hayrabolu', 'sarkoy', 'muratli', 'marmaraereglisi'],
    'tokat': ['merkez', 'erbaa', 'turhal', 'niksar', 'zile', 'resadiye', 'almus', 'pazar', 'basciftlik', 'yesilyurt', 'artova', 'sulusaray'],
    'trabzon': ['ortahisar', 'akcaabat', 'yomra', 'arakli', 'of', 'arsin', 'vakfikebir', 'surmene', 'macka', 'besikduzu', 'carsiibasi', 'caykara', 'tonya', 'duzkoy', 'salpazari', 'hayrat', 'koprubasi', 'dernekpazari'],
    'tunceli': ['merkez', 'pertek', 'mazgirt', 'cemisgezek', 'hozat', 'ovacik', 'pulumur', 'nazimiye'],
    'usak': ['merkez', 'banaz', 'esme', 'sivasli', 'ulubey', 'karahalli'],
    'van': ['ipekyolu', 'ercis', 'tusba', 'edremit', 'ozalp', 'caldiran', 'baskale', 'muradiye', 'gurpinar', 'gevas', 'saray', 'catak', 'bahcesaray'],
    'yalova': ['merkez', 'ciftlikkoy', 'cinarcik', 'altinova', 'armutlu', 'termal'],
    'yozgat': ['merkez', 'sorgun', 'akdagmadeni', 'yerkoy', 'bogazliyan', 'sarikaya', 'cekerek', 'sefaatli', 'saraykent', 'cayiralan', 'kadisehri', 'aydinci', 'yenifakili', 'candir'],
    'zonguldak': ['eregli', 'merkez', 'caycuma', 'devrek', 'kozlu', 'kilimli', 'gokcebey', 'alapli']
}

BASE_URL = 'https://www.doviz.com/akaryakit-fiyatlari'
CIKTI_DOSYASI = 'veriler.json'
DURUM_DOSYASI = 'durum.json'
GECMIS_DOSYASI = 'gecmis.json'
GECMIS_GUN = 30           # gecmis.json'da tutulan gün sayısı

BEKLEME_SN = 0.3          # her istekten sonra bekleme (siteyi yormamak için)
ES_ZAMANLI_ISTEK = 4      # aynı anda en fazla bu kadar sayfa indirilir
ESKI_FIYAT_GUN = 45       # tarihi bundan eski olan fiyat satırları atılır
AYKIRI_ORAN = 0.15        # Türkiye medyanından ±%15'ten fazla sapan fiyat silinir
DENEME_SAYISI = 3         # bir sayfa için en fazla deneme
ZAMAN_ASIMI_SN = 15

# Boş veri koruması eşikleri
MIN_KAYIT = 5000          # toplam fiyat satırı bundan azsa yazma
MIN_DOLU_IL = 60          # en az bu kadar ilde veri olmalı
MIN_ESKIYE_ORAN = 0.6     # eski dosyadaki kayıt sayısının en az %60'ı

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'tr-TR,tr;q=0.9',
}

oturum = requests.Session()
oturum.headers.update(HEADERS)


def sayfa_getir(url):
    """Sayfayı indirir; geçici hatalarda birkaç kez yeniden dener.
    Başarısızsa None döner."""
    for deneme in range(1, DENEME_SAYISI + 1):
        try:
            yanit = oturum.get(url, timeout=ZAMAN_ASIMI_SN)
            if yanit.status_code == 404:
                return None
            yanit.raise_for_status()
            return yanit.content
        except requests.RequestException as e:
            if deneme == DENEME_SAYISI:
                print(f"   ⚠️ İndirilemedi ({url}): {e}")
                return None
            time.sleep(1.5 * deneme)
    return None


def fiyat_tablosunu_ayristir(html):
    """Sayfadaki fiyat tablosunu bulur ve satırları döndürür.

    Tabloyu sütun başlıklarından tanır (Benzin + Motorin içeren tablo).
    Tablo yoksa None, tablo var ama satır yoksa [] döner."""
    soup = BeautifulSoup(html, 'html.parser')
    for tablo in soup.find_all('table'):
        satirlar = tablo.find_all('tr')
        if not satirlar:
            continue
        basliklar = [h.get_text(strip=True).lower()
                     for h in satirlar[0].find_all(['th', 'td'])]
        if 'benzin' not in basliklar or 'motorin' not in basliklar:
            continue

        i_benzin = basliklar.index('benzin')
        i_motorin = basliklar.index('motorin')
        i_lpg = basliklar.index('lpg') if 'lpg' in basliklar else None
        i_tarih = basliklar.index('tarih') if 'tarih' in basliklar else None

        sonuc = []
        for satir in satirlar[1:]:
            h = satir.find_all('td')
            if len(h) <= max(i_benzin, i_motorin):
                continue
            marka = h[0].get_text(strip=True)
            if not marka:
                continue
            kayit = {
                'marka': marka,
                'benzin': h[i_benzin].get_text(strip=True),
                'motorin': h[i_motorin].get_text(strip=True),
                'lpg': h[i_lpg].get_text(strip=True) if i_lpg is not None and len(h) > i_lpg else '-',
            }
            if i_tarih is not None and len(h) > i_tarih:
                tarih = h[i_tarih].get_text(strip=True)
                if tarih:
                    kayit['tarih'] = tarih
            sonuc.append(kayit)
        return sonuc
    return None


def ilceleri_kesfet(html, il):
    """İl sayfasındaki bağlantılardan o ilin ilçe adreslerini çıkarır."""
    soup = BeautifulSoup(html, 'html.parser')
    desen = re.compile(r'/akaryakit-fiyatlari/' + re.escape(il) + r'/([a-z0-9-]+)/?$')
    bulunan = []
    for a in soup.find_all('a', href=True):
        m = desen.search(a['href'])
        if m and m.group(1) not in bulunan:
            bulunan.append(m.group(1))
    return bulunan


def bayat_mi(tarih_str, bugun):
    """Satırın tarihi ESKI_FIYAT_GUN günden eskiyse True. Tarih yoksa ya da
    okunamıyorsa satır korunur."""
    if not tarih_str:
        return False
    try:
        tarih = datetime.strptime(tarih_str, '%d.%m.%Y').date()
    except ValueError:
        return False
    return (bugun - tarih).days > ESKI_FIYAT_GUN


def fiyat_sayi(metin):
    """'₺73,40' → 73.4 ; boş ya da '-' ise None."""
    if not metin or metin.strip() in ('-', ''):
        return None
    try:
        return float(metin.replace('₺', '').replace('.', '').replace(',', '.').strip())
    except ValueError:
        return None


def aykiri_fiyatlari_temizle(veri):
    """Türkiye medyanından AYKIRI_ORAN'dan fazla sapan fiyatları '-' yapar.

    Kaynakta zaman zaman bariz hatalı satırlar oluyor (ör. herkes 72 ₺ iken
    42 ₺ benzin). Bunlar uygulamada "en ucuz" diye öne çıkmasın diye silinir.
    Üç yakıtı da boş kalan satır tamamen atılır. Temizlenen fiyat sayısını döner."""
    temizlenen = 0
    for yakit in ('benzin', 'motorin', 'lpg'):
        degerler = sorted(
            x for ilceler in veri.values() for liste in ilceler.values()
            for s in liste for x in [fiyat_sayi(s.get(yakit))] if x is not None)
        if len(degerler) < 100:
            continue  # sağlıklı medyan için yeterli veri yok
        medyan = degerler[len(degerler) // 2]
        alt, ust = medyan * (1 - AYKIRI_ORAN), medyan * (1 + AYKIRI_ORAN)
        for ilceler in veri.values():
            for liste in ilceler.values():
                for s in liste:
                    x = fiyat_sayi(s.get(yakit))
                    if x is not None and not (alt <= x <= ust):
                        s[yakit] = '-'
                        temizlenen += 1
    for ilceler in veri.values():
        for ilce, liste in ilceler.items():
            ilceler[ilce] = [s for s in liste
                             if any(fiyat_sayi(s.get(y)) is not None
                                    for y in ('benzin', 'motorin', 'lpg'))]
    return temizlenen


def tr_sayi(metin):
    """Türkçe biçimli sayıyı çözer: '$1.960,61' → 1960.61 ; '%-0,02' → -0.02."""
    if not metin:
        return None
    temiz = re.sub(r'[^0-9,.\-]', '', metin).replace('.', '').replace(',', '.')
    try:
        return float(temiz)
    except ValueError:
        return None


def piyasa_ayristir(html):
    """Sayfanın üst şeridindeki dolar, euro ve Brent değerlerini okur.

    Dönen biçim: {'dolar': {'deger': 50.37, 'degisim': 0.22}, 'euro': ..., 'brent': ...}
    `degisim` günlük yüzde değişimdir. Hiçbiri bulunamazsa None döner."""
    soup = BeautifulSoup(html, 'html.parser')
    anahtarlar = {'USD': 'dolar', 'EUR': 'euro', 'BRENT': 'brent'}
    sonuc = {}
    for site_adi, ad in anahtarlar.items():
        deger = soup.find(attrs={'data-socket-key': site_adi, 'data-socket-attr': 's'})
        degisim = soup.find(attrs={'data-socket-key': site_adi, 'data-socket-attr': 'c'})
        d = tr_sayi(deger.get_text(strip=True)) if deger else None
        if d is None:
            continue
        sonuc[ad] = {
            'deger': round(d, 4),
            'degisim': tr_sayi(degisim.get_text(strip=True)) if degisim else None,
        }
    return sonuc or None


def medyan(sayilar):
    s = sorted(sayilar)
    return round(s[len(s) // 2], 2) if s else None


def gecmisi_guncelle(veri, gun):
    """gecmis.json'a bugünün il bazlı medyan fiyatlarını ekler (son GECMIS_GUN gün).

    Uygulamadaki "son 7 gün" grafiği ve günlük değişim yüzdeleri bu dosyadan
    hesaplanır. Aynı gün ikinci kez çalışırsa o günün kaydı yenilenir."""
    yakitlar = ('benzin', 'motorin', 'lpg')
    try:
        with open(GECMIS_DOSYASI, encoding='utf-8') as f:
            gecmis = json.load(f)
    except Exception:
        gecmis = {}
    gunler = list(gecmis.get('gunler', []))
    turkiye = {y: list(gecmis.get('turkiye', {}).get(y, [])) for y in yakitlar}
    iller = {il: {y: list(d.get(y, [])) for y in yakitlar}
             for il, d in gecmis.get('iller', {}).items()}

    if gunler and gunler[-1] == gun:
        konum = len(gunler) - 1          # bugünün kaydını yenile
    else:
        gunler.append(gun)
        konum = len(gunler) - 1

    def yerlestir(seri, deger):
        while len(seri) < konum:          # eksik günleri boşlukla doldur
            seri.append(None)
        if len(seri) == konum:
            seri.append(deger)
        else:
            seri[konum] = deger
        del seri[konum + 1:]

    for y in yakitlar:
        tum = [x for ilceler in veri.values() for l in ilceler.values()
               for s in l for x in [fiyat_sayi(s.get(y))] if x is not None]
        yerlestir(turkiye[y], medyan(tum))
    for il in set(list(veri.keys()) + list(iller.keys())):
        iller.setdefault(il, {y: [] for y in yakitlar})
        for y in yakitlar:
            degerler = [x for l in veri.get(il, {}).values()
                        for s in l for x in [fiyat_sayi(s.get(y))] if x is not None]
            yerlestir(iller[il][y], medyan(degerler))

    # Yalnızca son GECMIS_GUN günü tut
    fazla = len(gunler) - GECMIS_GUN
    if fazla > 0:
        gunler = gunler[fazla:]
        turkiye = {y: s[fazla:] for y, s in turkiye.items()}
        iller = {il: {y: s[fazla:] for y, s in d.items()} for il, d in iller.items()}

    with open(GECMIS_DOSYASI, 'w', encoding='utf-8') as f:
        json.dump({'gunler': gunler, 'turkiye': turkiye, 'iller': iller},
                  f, ensure_ascii=False, separators=(',', ':'))
    return len(gunler)


def eski_veriyi_oku():
    try:
        with open(CIKTI_DOSYASI, encoding='utf-8') as f:
            veri = json.load(f)
        return veri.get('sehirler', veri) if isinstance(veri, dict) else {}
    except Exception:
        return {}


def kayit_say(veri):
    return sum(len(liste) for ilceler in veri.values() if isinstance(ilceler, dict)
               for liste in ilceler.values() if isinstance(liste, list))


def verileri_topla(secili_iller=None):
    deneme_modu = bool(secili_iller)
    iller = secili_iller or list(hedefler.keys())
    eski = eski_veriyi_oku()

    tum_veriler = {}
    indirilemeyen = []     # ağ hatası: eski veri korundu
    tablosuz = []          # sayfa geldi ama fiyat tablosu yok
    tarih_sayaci = Counter()
    atilan_bayat = 0       # tarihi çok eski olduğu için atılan satır sayısı
    piyasa = None          # dolar / euro / Brent (ilk açılan sayfadan okunur)
    simdi_tr = datetime.now(timezone.utc) + timedelta(hours=3)   # Türkiye saati
    bugun = simdi_tr.date()

    print(f"🚀 {len(iller)} il taranacak.\n")

    for il in iller:
        tum_veriler[il] = {}

        # 1) İlçe listesini il sayfasından keşfet; olmazsa yedek listeyi kullan
        ilceler = []
        il_html = sayfa_getir(f"{BASE_URL}/{il}")
        time.sleep(BEKLEME_SN)
        if il_html:
            ilceler = ilceleri_kesfet(il_html, il)
            if piyasa is None:
                piyasa = piyasa_ayristir(il_html)
        if not ilceler:
            ilceler = list(dict.fromkeys(hedefler.get(il, [])))
            print(f"   ℹ️ {il}: ilçeler keşfedilemedi, yedek liste kullanılıyor")

        print(f"🏙️  {il.upper()} taranıyor... ({len(ilceler)} ilçe)", flush=True)

        # 2) Her ilçenin fiyat tablosunu oku (birkaç sayfa aynı anda)
        def ilce_indir(ilce, il=il):
            html = sayfa_getir(f"{BASE_URL}/{il}/{ilce}")
            time.sleep(BEKLEME_SN)
            return html

        with ThreadPoolExecutor(max_workers=ES_ZAMANLI_ISTEK) as havuz:
            sayfalar = list(havuz.map(ilce_indir, ilceler))

        for ilce, html in zip(ilceler, sayfalar):
            if html is None:
                # Ağ hatası: varsa dünkü veriyi koru
                tum_veriler[il][ilce] = eski.get(il, {}).get(ilce, [])
                indirilemeyen.append(f"{il}/{ilce}")
                continue

            satirlar = fiyat_tablosunu_ayristir(html)
            if satirlar is None:
                tablosuz.append(f"{il}/{ilce}")
                satirlar = []

            # Aylardır güncellenmemiş fiyatları at: bunlar bugünkü fiyatlardan
            # çok düşük kaldığı için uygulamada yanlışlıkla "en ucuz" görünüyor.
            taze = [s for s in satirlar if not bayat_mi(s.get('tarih'), bugun)]
            atilan_bayat += len(satirlar) - len(taze)
            satirlar = taze
            tum_veriler[il][ilce] = satirlar
            for s in satirlar:
                if s.get('tarih'):
                    tarih_sayaci[s['tarih']] += 1

    temizlenen_aykiri = aykiri_fiyatlari_temizle(tum_veriler)

    # --- ÖZET ---
    toplam_kayit = kayit_say(tum_veriler)
    toplam_ilce = sum(len(v) for v in tum_veriler.values())
    dolu_il = sum(1 for v in tum_veriler.values() if any(v.values()))
    bos_ilce = [f"{il}/{ilce}" for il, v in tum_veriler.items()
                for ilce, liste in v.items() if not liste]
    eski_kayit = kayit_say(eski)

    print(f"\n📊 {len(tum_veriler)} il, {toplam_ilce} ilçe, {toplam_kayit} fiyat satırı")
    print(f"   veri olan il: {dolu_il} | boş ilçe: {len(bos_ilce)} | "
          f"indirilemeyen: {len(indirilemeyen)} | tablosuz: {len(tablosuz)} | "
          f"atılan eski fiyat: {atilan_bayat} | silinen aykırı fiyat: {temizlenen_aykiri}")
    if bos_ilce[:15]:
        print(f"   boş ilçe örnekleri: {', '.join(bos_ilce[:15])}")

    if deneme_modu:
        hedef = 'veriler.test.json'
        with open(hedef, 'w', encoding='utf-8') as f:
            json.dump(tum_veriler, f, ensure_ascii=False, indent=1)
        print(f"\n🧪 Deneme modu: sonuç '{hedef}' dosyasına yazıldı, {CIKTI_DOSYASI} değişmedi.")
        return 0

    # --- BOŞ VERİ KORUMASI ---
    sorunlar = []
    if toplam_kayit < MIN_KAYIT:
        sorunlar.append(f"toplam satır {toplam_kayit} < {MIN_KAYIT}")
    if dolu_il < MIN_DOLU_IL:
        sorunlar.append(f"veri olan il {dolu_il} < {MIN_DOLU_IL}")
    if eski_kayit and toplam_kayit < eski_kayit * MIN_ESKIYE_ORAN:
        sorunlar.append(f"satır sayısı önceki veriye göre çok düştü ({eski_kayit} → {toplam_kayit})")

    if sorunlar:
        print("\n❌ VERİ GÜVENİLİR DEĞİL — veriler.json DEĞİŞTİRİLMEDİ.")
        for s in sorunlar:
            print(f"   • {s}")
        print("   Büyük ihtimalle kaynak sitenin sayfa yapısı değişti ya da erişim engellendi.")
        return 1

    with open(CIKTI_DOSYASI, 'w', encoding='utf-8') as f:
        json.dump(tum_veriler, f, ensure_ascii=False, indent=1)

    durum = {
        'guncelleme': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'veri_tarihi': tarih_sayaci.most_common(1)[0][0] if tarih_sayaci else None,
        'il': len(tum_veriler),
        'ilce': toplam_ilce,
        'kayit': toplam_kayit,
        'bos_ilce': len(bos_ilce),
        'indirilemeyen': len(indirilemeyen),
        'atilan_eski_fiyat': atilan_bayat,
        'silinen_aykiri_fiyat': temizlenen_aykiri,
        'piyasa': piyasa,
    }
    with open(DURUM_DOSYASI, 'w', encoding='utf-8') as f:
        json.dump(durum, f, ensure_ascii=False, indent=1)

    gun_sayisi = gecmisi_guncelle(tum_veriler, bugun.isoformat())

    print(f"\n💾 '{CIKTI_DOSYASI}', '{DURUM_DOSYASI}' ve '{GECMIS_DOSYASI}' güncellendi "
          f"(geçmiş: {gun_sayisi} gün, piyasa: {'var' if piyasa else 'YOK'}).")
    return 0


if __name__ == '__main__':
    sys.exit(verileri_topla(sys.argv[1:]))
