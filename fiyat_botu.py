import requests
import json
import datetime
import random

# NOT: Gerçek bir siteden çekmek için BeautifulSoup kullanılır.
# Şimdilik uygulamanın bozulmaması için "Rastgele Zam/İndirim Yapan" bir simülasyon yazdım.
# Eğer gerçek Opet/Petrol Ofisi verisi istersen o sitenin yapısına göre güncelleriz.

def fiyatlari_guncelle():
    # Mevcut verileri oku (Eğer varsa)
    try:
        with open('veriler.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("Veri dosyası bulunamadı, yeni oluşturuluyor...")
        data = {"sehirler": {}}

    print("Fiyatlar güncelleniyor...")

    # Şimdilik örnek olarak mevcut fiyatların üzerine +/- kuruş ekleyelim
    # Gerçek hayatta burası requests.get("opet.com.tr...") ile dolacak.
    
    yeni_data = data.copy()
    
    # Örnek: İstanbul ve Ankara için güncelleme yapalım (Mevcut yapıyı koruyarak)
    for sehir, ilceler in yeni_data.get("sehirler", {}).items():
        for ilce, istasyonlar in ilceler.items():
            for istasyon in istasyonlar:
                # Fiyatları string'den float'a çevir, ufak oyna, geri çevir
                try:
                    benzin = float(istasyon["benzin"].replace("₺", "").strip())
                    motorin = float(istasyon["motorin"].replace("₺", "").strip())
                    
                    # 5 kuruş ile 10 kuruş arası rastgele değişim (Simülasyon)
                    degisim = random.uniform(-0.10, 0.15)
                    
                    istasyon["benzin"] = f"{benzin + degisim:.2f}"
                    istasyon["motorin"] = f"{motorin + degisim:.2f}"
                except:
                    continue

    # Tarihi güncellemek istersen duyurulara ekleyebilirsin
    tarih = datetime.datetime.now().strftime("%d.%m.%Y")
    print(f"İşlem tamam! Tarih: {tarih}")

    # Dosyayı kaydet
    with open('veriler.json', 'w', encoding='utf-8') as f:
        json.dump(yeni_data, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    fiyatlari_guncelle()