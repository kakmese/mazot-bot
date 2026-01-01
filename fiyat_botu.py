import requests
from bs4 import BeautifulSoup
import json
import time

# --- TAM TÜRKİYE LİSTESİ (ALL STAR) ---
# Adana dahil tüm illerin tüm ilçeleri eklendi.
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

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def verileri_topla():
    tum_veriler = {} 
    
    toplam_il = len(hedefler)
    toplam_ilce = sum(len(v) for v in hedefler.values())
    sayac = 0

    print(f"🚀 DEV OPERASYON BAŞLIYOR: {toplam_il} İl ve {toplam_ilce} İlçe taranacak!")
    print("⚠️  Bu işlem yaklaşık 20-30 dakika sürebilir. Arkanıza yaslanın.\n")

    for il, ilceler in hedefler.items():
        tum_veriler[il] = {} 
        print(f"🏙️  {il.upper()} taranıyor... ({len(ilceler)} ilçe)")
        
        for ilce in ilceler:
            sayac += 1
            url = f"https://www.doviz.com/akaryakit-fiyatlari/{il}/{ilce}"
            
            # Sunucuyu yormamak için kısa bekleme
            time.sleep(0.3)

            try:
                response = requests.get(url, headers=headers, timeout=10)
                soup = BeautifulSoup(response.content, 'html.parser')
                
                tablo_kapsayici = soup.find('div', class_='value-table')
                
                if tablo_kapsayici:
                    tablo = tablo_kapsayici.find('table')
                    
                    if tablo:
                        ilce_fiyatlari = []
                        satirlar = tablo.find_all('tr')
                        
                        for satir in satirlar[1:]: 
                            hucreler = satir.find_all('td')
                            if len(hucreler) >= 4:
                                veri = {
                                    "marka": hucreler[0].get_text(strip=True),
                                    "benzin": hucreler[1].get_text(strip=True),
                                    "motorin": hucreler[2].get_text(strip=True),
                                    "lpg": hucreler[3].get_text(strip=True)
                                }
                                ilce_fiyatlari.append(veri)
                        
                        tum_veriler[il][ilce] = ilce_fiyatlari
                    else:
                        tum_veriler[il][ilce] = []
                else:
                    tum_veriler[il][ilce] = []

                # İlerleme çubuğu gibi her 10 ilçede bir bilgi ver
                if sayac % 10 == 0:
                    print(f"   ⏳ Toplam {sayac}/{toplam_ilce} ilçe tamamlandı...")

            except Exception as e:
                print(f"   ⚠️ Hata ({il}-{ilce}): {e}")
            
    # Veriyi kaydet
    print("\n💾 Tüm veriler 'veriler.json' dosyasına kaydediliyor...")
    with open('veriler.json', 'w', encoding='utf-8') as f:
        json.dump(tum_veriler, f, ensure_ascii=False, indent=4)
    print("🎉 OPERASYON BAŞARIYLA TAMAMLANDI!")

verileri_topla()