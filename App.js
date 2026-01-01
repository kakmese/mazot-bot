import React, { useState, useEffect, useRef } from 'react'; 
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Image, TextInput, Linking, Alert, Platform, Keyboard, Dimensions, Modal, FlatList, ActionSheetIOS, ActivityIndicator, Switch } from 'react-native';
import { MaterialCommunityIcons, FontAwesome5, Feather, Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import * as Location from 'expo-location'; 
import * as Notifications from 'expo-notifications'; 
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import MapView, { Marker } from 'react-native-maps'; // HARİTA EKLENDİ
import veriDosyasi from './veriler.json'; 

const ONLINE_JSON_URL = "https://raw.githubusercontent.com/kakmese/mazot-bot/refs/heads/main/veriler.json"; 
const UYGULAMA_VERSIYONU = "v1.1.0";
const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.8; // Harita altındaki kart genişliği
const SPACING_FOR_CARD_INSET = width * 0.1 - 10;

// --- LÜKS RENK PALETİ ---
const THEME = {
  light: { 
    bg: '#F2F2F7',          
    card: '#FFFFFF',        
    text: '#3A3A3C',        
    subText: '#8E8E93',     
    inputBg: '#FFFFFF',     
    border: 'transparent',  
    primary: '#C7B299',     
    accent: '#FF3B30',      
    bestPrice: '#34C759',   
    icon: '#8E8E93',        
    tabBg: '#FFFFFF',       
    tabActive: '#EAE2D9',   
    shadow: '#000000'       
  }
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const LOGO_DOSYALARI = {
  'shell': require('./assets/logos/shell.png'), 'opet': require('./assets/logos/opet.png'), 'petrol ofisi': require('./assets/logos/po.png'),
  'po': require('./assets/logos/po.png'), 'bp': require('./assets/logos/bp.png'), 'total': require('./assets/logos/total.png'),
  'aytemiz': require('./assets/logos/aytemiz.png'), 'türkiye petrolleri': require('./assets/logos/tp.png'), 'tp': require('./assets/logos/tp.png'),
  'lukoil': require('./assets/logos/lukoil.png'), 'sunpet': require('./assets/logos/sunpet.png'), 'kadoil': require('./assets/logos/kadoil.png'),
  'alpet': require('./assets/logos/alpet.png'), 'termopet': require('./assets/logos/termopet.png'), 'termo': require('./assets/logos/termopet.png'), 
  'go': require('./assets/logos/go.png'), 'm oil': require('./assets/logos/moil.png'), 'moil': require('./assets/logos/moil.png'),
  'bpet': require('./assets/logos/bpet.png'), 'best': require('./assets/logos/best.png'), 'soil': require('./assets/logos/soil.png'),    
  's oıl': require('./assets/logos/soil.png'), '7kita': require('./assets/logos/7kita.png'),
  '7kıta': require('./assets/logos/7kita.png'), '7 kıta': require('./assets/logos/7kita.png'), '7 kita': require('./assets/logos/7kita.png'), 
  'yedi kıta': require('./assets/logos/7kita.png'), 'eurogaz': require('./assets/logos/eurogaz.png'), 'hypco': require('./assets/logos/hypco.png'),
  'parkoil': require('./assets/logos/parkoil.png'), 'petline': require('./assets/logos/petline.png'), 'petrall': require('./assets/logos/petrall.png'),
  'qplus': require('./assets/logos/qplus.png'), 'rpet': require('./assets/logos/rpet.png'), 'sahhoil': require('./assets/logos/sahhoil.png'),
  'şahhoil': require('./assets/logos/sahhoil.png'), 'sahh': require('./assets/logos/sahhoil.png'), 'şahh': require('./assets/logos/sahhoil.png'),
  'sanoil': require('./assets/logos/sanoil.png'), 'enerji': require('./assets/logos/enerji.png'), 'ben enerji': require('./assets/logos/enerji.png'),
  'aygaz': require('./assets/logos/aygaz.png'), 'milangaz': require('./assets/logos/milangaz.png'), 'ipragaz': require('./assets/logos/ipragaz.png'),
  'mogaz': require('./assets/logos/mogaz.png'),
};

const MarketSummaryBar = ({ data, colors }) => (
  <View style={[styles.marketBarContainer, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
    <View style={styles.marketItem}><Text style={[styles.marketLabel, { color: colors.subText }]}>💲 Dolar</Text><Text style={[styles.marketValue, { color: colors.text }]}>{data.dolar}₺</Text></View>
    <View style={[styles.verticalDividerSmall, { backgroundColor: colors.border }]} />
    <View style={styles.marketItem}><Text style={[styles.marketLabel, { color: colors.subText }]}>💶 Euro</Text><Text style={[styles.marketValue, { color: colors.text }]}>{data.euro}₺</Text></View>
    <View style={[styles.verticalDividerSmall, { backgroundColor: colors.border }]} />
    <View style={styles.marketItem}><Text style={[styles.marketLabel, { color: colors.subText }]}>🛢️ Brent</Text><Text style={[styles.marketValue, { color: colors.text }]}>{data.brent}$</Text></View>
  </View>
);

export default function App() {
  const [aktifEkran, setAktifEkran] = useState('anasayfa'); 
  const [seciliSehir, setSeciliSehir] = useState(null); 
  const [seciliIlce, setSeciliIlce] = useState(null); 
  const [aramaMetni, setAramaMetni] = useState("");
  const [seciliHaber, setSeciliHaber] = useState(null);
  const [kullaniciIsmi, setKullaniciIsmi] = useState('');
  const [kayitliKonum, setKayitliKonum] = useState(null); 
  const colors = THEME.light; 

  const [sehirVerileri, setSehirVerileri] = useState(veriDosyasi.sehirler ? veriDosyasi.sehirler : veriDosyasi);
  const [veriKaynagi, setVeriKaynagi] = useState('Yükleniyor...'); 

  const [ilkAcilisModali, setIlkAcilisModali] = useState(false); 
  const [modalGorunumu, setModalGorunumu] = useState('form'); 
  const [tempIsim, setTempIsim] = useState('');
  const [tempSehir, setTempSehir] = useState(null);
  const [tempIlce, setTempIlce] = useState(null);
  const [konumBulunuyor, setKonumBulunuyor] = useState(false);
  const [konumBasarili, setKonumBasarili] = useState(false);
  const [piyasaVerileri, setPiyasaVerileri] = useState({ dolar: '-', euro: '-', brent: '82.40' });
  const [duyurular, setDuyurular] = useState([]); 
  const [mesafe, setMesafe] = useState('');
  const [tuketim, setTuketim] = useState('6.0'); 
  const [yakitFiyati, setYakitFiyati] = useState('42.00'); 
  const [sonucTutar, setSonucTutar] = useState(null);
  const [favoriler, setFavoriler] = useState([]); 
  
  // --- HARİTA İÇİN STATE ---
  const [haritaModuAktif, setHaritaModuAktif] = useState(false);
  const mapRef = useRef(null);
  const flatListRef = useRef(null);

  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    const verileriYukle = async () => {
        try {
            const kayitliVeriString = await AsyncStorage.getItem('sonGuncelVeriler');
            const kayitliKonumData = await AsyncStorage.getItem('kullaniciKonumu');
            const kayitliIsimData = await AsyncStorage.getItem('kullaniciIsmi');
            const kayitliFavoriler = await AsyncStorage.getItem('favorilerim');
            if (kayitliFavoriler) setFavoriler(JSON.parse(kayitliFavoriler));

            if (kayitliVeriString) {
                const kayitliVeri = JSON.parse(kayitliVeriString);
                if(kayitliVeri.sehirler) {
                    setSehirVerileri(kayitliVeri.sehirler);
                    setVeriKaynagi('Hafıza');
                } else if (kayitliVeri) {
                      setSehirVerileri(kayitliVeri); 
                      setVeriKaynagi('Hafıza');
                }
            }

            if (kayitliKonumData && kayitliIsimData) {
                setKayitliKonum(JSON.parse(kayitliKonumData));
                setKullaniciIsmi(kayitliIsimData);
            } else { setIlkAcilisModali(true); }

            if (ONLINE_JSON_URL) {
                fetch(ONLINE_JSON_URL)
                    .then(res => res.json())
                    .then(async (onlineData) => {
                        const yeniVeri = onlineData.sehirler ? onlineData.sehirler : onlineData;
                        setSehirVerileri(yeniVeri);
                        setVeriKaynagi('Canlı');
                        await AsyncStorage.setItem('sonGuncelVeriler', JSON.stringify(onlineData));
                    })
                    .catch((err) => { console.log("Hafızadan devam."); });
            }

        } catch (e) { console.log("Hata:", e); }
    };

    verileriYukle();
    
    registerForPushNotificationsAsync();
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {});

    fetch('https://api.exchangerate-api.com/v4/latest/USD').then(r=>r.json()).then(d=>setPiyasaVerileri({dolar:d.rates.TRY.toFixed(2),euro:(d.rates.TRY/d.rates.EUR).toFixed(2),brent:'82.40'})).catch(e=>{});
    
    const duyurulariGetir = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "duyurular"));
        const fd = []; querySnapshot.forEach((d) => fd.push({ id: d.id, ...d.data() }));
        if (fd.length > 0) setDuyurular(fd); else setDuyurular(veriDosyasi.duyurular || []);
      } catch (e) { setDuyurular(veriDosyasi.duyurular || []); }
    };
    duyurulariGetir();

    return () => {
      if(notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current);
      if(responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []); 

  async function registerForPushNotificationsAsync() {
    if (!Device.isDevice) return;
    const { status: es } = await Notifications.getPermissionsAsync();
    let fs = es;
    if (es !== 'granted') { const { status } = await Notifications.requestPermissionsAsync(); fs = status; }
    if (fs !== 'granted') return;
    try {
        const pid = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        const t = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data;
        console.log("Token:", t);
    } catch(e) {}
  }

  const favoriIslemi = async (marka, ilce, sehir) => {
    const yeniFav = { marka, ilce, sehir };
    let guncelFavoriler = [...favoriler];
    const varMi = guncelFavoriler.some(f => f.marka === marka && f.ilce === ilce && f.sehir === sehir);
    if (varMi) { guncelFavoriler = guncelFavoriler.filter(f => !(f.marka === marka && f.ilce === ilce && f.sehir === sehir)); } else { guncelFavoriler.push(yeniFav); }
    setFavoriler(guncelFavoriler);
    await AsyncStorage.setItem('favorilerim', JSON.stringify(guncelFavoriler));
  };

  const favoriKontrol = (marka, ilce, sehir) => { return favoriler.some(f => f.marka === marka && f.ilce === ilce && f.sehir === sehir); };

  const konumIsleminiBaslat = async () => {
    setKonumBulunuyor(true); setKonumBasarili(false);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('İzin Gerekli', 'Konum izni vermeniz gerekir.'); setKonumBulunuyor(false); return; }
      
      let location = await Location.getCurrentPositionAsync({});
      let address = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      if (address && address.length > 0) {
        const { region, subregion } = address[0]; 
        const bulunanSehir = Object.keys(sehirVerileri).find(s => s.toLocaleUpperCase('tr-TR') === region?.toLocaleUpperCase('tr-TR'));
        
        if (bulunanSehir) {
            setTempSehir(bulunanSehir);
            const bulunanIlce = Object.keys(sehirVerileri[bulunanSehir]).find(i => i.toLocaleUpperCase('tr-TR') === subregion?.toLocaleUpperCase('tr-TR'));
            if (bulunanIlce) { setTempIlce(bulunanIlce); setKonumBasarili(true); }
             else { Alert.alert("Bilgi", "İlçeniz tam eşleşmedi, lütfen listeden seçiniz."); }
        } else { Alert.alert("Bilgi", "Şehriniz bulunamadı, lütfen elle seçiniz."); }
      }
    } catch (error) { Alert.alert("Hata", "GPS hatası."); } finally { setKonumBulunuyor(false); }
  };

  const konumumuBul = async () => {
    Alert.alert("Konum İzni", "İlçenizi bulmak için izin gerekiyor.", [{ text: "Vazgeç", style: "cancel" }, { text: "İzin Ver", onPress: konumIsleminiBaslat }]);
  };

  const kurulumuTamamla = async () => {
    if (!tempIsim || !tempSehir || !tempIlce) { Alert.alert("Eksik", "Lütfen tüm alanları doldurunuz."); return; }
    const yk = { sehir: tempSehir, ilce: tempIlce };
    await AsyncStorage.setItem('kullaniciKonumu', JSON.stringify(yk));
    await AsyncStorage.setItem('kullaniciIsmi', tempIsim);
    setKayitliKonum(yk); setKullaniciIsmi(tempIsim); setIlkAcilisModali(false);
  };

  const ayarDuzenlemeyiAc = () => {
      setTempIsim(kullaniciIsmi); setTempSehir(kayitliKonum?.sehir); setTempIlce(kayitliKonum?.ilce);
      setKonumBasarili(false); setModalGorunumu('form'); setIlkAcilisModali(true);
  }

  const maliyetHesapla = () => {
    Keyboard.dismiss(); const k = parseFloat(mesafe); const l = parseFloat(tuketim); const f = parseFloat(yakitFiyati);
    if (isNaN(k) || isNaN(l) || isNaN(f)) { Alert.alert("Hata", "Sayı giriniz."); return; }
    setSonucTutar(((k / 100) * l * f).toFixed(2)); 
  };

  const navigasyonuBaslat = (marka, ilce=null, sehir=null) => {
    const h = `${marka} ${ilce || seciliIlce || kayitliKonum?.ilce} ${sehir || seciliSehir || kayitliKonum?.sehir}`;
    const enc = encodeURIComponent(h);
    Linking.openURL(`http://maps.google.com/?q=${enc}`);
  };

  const baslikDuzenle = (metin) => metin ? metin.replace(/-/g, ' ').toUpperCase() : "";
  const getIstasyonlar = (s, i) => (s && i && sehirVerileri[s] && sehirVerileri[s][i]) ? sehirVerileri[s][i] : [];
  
  const getFavoriIstasyonVerisi = (fav) => {
      const liste = getIstasyonlar(fav.sehir, fav.ilce);
      const bulunan = liste.find(i => i.marka === fav.marka);
      return bulunan ? { ...bulunan, sehir: fav.sehir, ilce: fav.ilce } : null;
  };

  const fiyatTemizle = (fiyatStr) => {
    if(!fiyatStr) return 9999;
    return parseFloat(fiyatStr.replace('₺','').replace(',','.').trim());
  }

  const enUcuzlariBul = (s, i) => {
      const liste = getIstasyonlar(s, i);
      if(!liste || liste.length === 0) return { benzin: null, motorin: null, lpg: null };
      let minBenzin = {fiyat: 9999, istasyon: null}, minMotorin = {fiyat: 9999, istasyon: null}, minLpg = {fiyat: 9999, istasyon: null};
      liste.forEach(ist => {
          const b = fiyatTemizle(ist.benzin); const m = fiyatTemizle(ist.motorin); const l = fiyatTemizle(ist.lpg);
          if(b > 1 && b < minBenzin.fiyat) minBenzin = {fiyat: b, istasyon: ist};
          if(m > 1 && m < minMotorin.fiyat) minMotorin = {fiyat: m, istasyon: ist};
          if(l > 1 && l < minLpg.fiyat) minLpg = {fiyat: l, istasyon: ist};
      });
      return { benzin: minBenzin.istasyon, motorin: minMotorin.istasyon, lpg: minLpg.istasyon };
  }

  // --- HARİTA İÇİN RASTGELE KOORDİNAT OLUŞTURUCU ---
  // (Çünkü robotumuz henüz koordinat çekmiyor, şimdilik Antalya merkezli simüle ediyoruz)
  const getCoordinate = (index) => {
      const baseLat = 36.8841; 
      const baseLng = 30.7056;
      return {
          latitude: baseLat + (Math.random() - 0.5) * 0.05,
          longitude: baseLng + (Math.random() - 0.5) * 0.05
      };
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      
      {!ilkAcilisModali && (
        <View>
          <View style={[styles.headerContainer, { backgroundColor: colors.bg }]}>
             <View>
                 <Text style={[styles.headerGreeting, { color: colors.text }]}>Merhaba, {kullaniciIsmi} 👋</Text>
                 <TouchableOpacity style={[styles.locationPill, { backgroundColor: colors.card, shadowColor: colors.shadow }]} onPress={ayarDuzenlemeyiAc}>
                     <MaterialCommunityIcons name="map-marker" size={14} color={colors.primary} />
                     <Text style={[styles.locationText, { color: colors.primary }]}>{kayitliKonum ? `${baslikDuzenle(kayitliKonum.ilce)}, ${baslikDuzenle(kayitliKonum.sehir)}` : "Seç"}</Text>
                     <Feather name="edit-2" size={12} color={colors.subText} style={{marginLeft:5}} />
                 </TouchableOpacity>
             </View>
             <TouchableOpacity onPress={ayarDuzenlemeyiAc}><MaterialCommunityIcons name="account-circle" size={40} color={colors.text} /></TouchableOpacity>
          </View>
          <MarketSummaryBar data={piyasaVerileri} colors={colors} />
        </View>
      )}

      {/* --- HARİTA MODU MANTIĞI --- */}
      {aktifEkran === 'ilce_secimi' && seciliIlce && haritaModuAktif ? (
          <View style={{flex:1}}>
              <MapView
                ref={mapRef}
                style={{flex:1}}
                initialRegion={{ latitude: 36.8841, longitude: 30.7056, latitudeDelta: 0.0922, longitudeDelta: 0.0421 }}
              >
                  {getIstasyonlar(seciliSehir, seciliIlce).map((ist, index) => {
                      const coord = getCoordinate(index); // Simüle edilmiş koordinat
                      return (
                          <Marker 
                            key={index}
                            coordinate={coord}
                            onPress={() => flatListRef.current.scrollToIndex({index, animated: true})}
                          >
                              <View style={[styles.markerWrap, {backgroundColor: colors.card}]}>
                                  <Image source={require('./assets/adaptive-icon.png')} style={{width:20, height:20}} resizeMode='contain' />
                              </View>
                          </Marker>
                      );
                  })}
              </MapView>
              
              {/* --- HARİTA ÜSTÜ BUTONLAR --- */}
              <TouchableOpacity style={styles.closeMapButton} onPress={() => setHaritaModuAktif(false)}>
                  <Feather name="list" size={20} color="#fff" />
                  <Text style={{color:'#fff', fontWeight:'bold', marginLeft:5}}>Liste Görünümü</Text>
              </TouchableOpacity>

              {/* --- KAYAN KARTLAR (CAROUSEL) --- */}
              <FlatList
                ref={flatListRef}
                data={getIstasyonlar(seciliSehir, seciliIlce)}
                horizontal
                pagingEnabled
                scrollEventThrottle={1}
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + 20}
                snapToAlignment="center"
                style={styles.carousel}
                contentContainerStyle={{paddingHorizontal: SPACING_FOR_CARD_INSET}}
                renderItem={({ item, index }) => {
                    let logo = null; Object.keys(LOGO_DOSYALARI).forEach(k => { if(item.marka.toLowerCase().includes(k)) logo = LOGO_DOSYALARI[k]; });
                    return (
                        <View style={[styles.carouselCard, {backgroundColor: colors.card, shadowColor: colors.shadow}]}>
                            <View style={styles.carouselHeader}>
                                <View style={styles.miniLogoBox}>{logo ? <Image source={logo} style={{width:'100%', height:'100%'}} resizeMode='contain'/> : <Text>⛽</Text>}</View>
                                <Text numberOfLines={1} style={[styles.carouselTitle, {color: colors.text}]}>{item.marka}</Text>
                            </View>
                            <View style={styles.newPriceRow}>
                                <View style={styles.newPriceItem}><Text style={[styles.newPriceLabel, {color: colors.subText}]}>B</Text><Text style={[styles.newPriceVal, {color: colors.text}]}>{item.benzin}</Text></View>
                                <View style={styles.newPriceItem}><Text style={[styles.newPriceLabel, {color: colors.subText}]}>M</Text><Text style={[styles.newPriceVal, {color: colors.text}]}>{item.motorin}</Text></View>
                                <View style={styles.newPriceItem}><Text style={[styles.newPriceLabel, {color: colors.subText}]}>L</Text><Text style={[styles.newPriceVal, {color: colors.text}]}>{item.lpg}</Text></View>
                            </View>
                            <TouchableOpacity onPress={() => navigasyonuBaslat(item.marka)} style={[styles.carouselButton, {backgroundColor: colors.primary}]}>
                                <Text style={{color:'#fff', fontWeight:'bold'}}>Git</Text>
                            </TouchableOpacity>
                        </View>
                    );
                }}
              />
          </View>
      ) : (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* --- ANA SAYFA --- */}
        {aktifEkran === 'anasayfa' && kayitliKonum && (
           <>
             {/* --- EN UCUZLAR ALANI --- */}
             <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 10 }]}>🏆 En Uygun Fiyatlar</Text>
             <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25}}>
                {[
                    {label: 'Benzin', data: enUcuzlariBul(kayitliKonum.sehir, kayitliKonum.ilce).benzin, key: 'benzin'},
                    {label: 'Motorin', data: enUcuzlariBul(kayitliKonum.sehir, kayitliKonum.ilce).motorin, key: 'motorin'},
                    {label: 'LPG', data: enUcuzlariBul(kayitliKonum.sehir, kayitliKonum.ilce).lpg, key: 'lpg'}
                ].map((item, idx) => (
                    <View key={idx} style={[styles.bestPriceCard, {backgroundColor: colors.card, shadowColor: colors.shadow}]}>
                        <View style={{flexDirection:'row', alignItems:'center', marginBottom:4}}>
                            <View style={{width:8, height:8, borderRadius:4, backgroundColor: colors.bestPrice, marginRight:6}}/>
                            <Text style={{fontSize:11, fontWeight:'600', color:colors.subText}}>{item.label}</Text>
                        </View>
                        <Text style={{fontSize:16, fontWeight:'800', color:colors.text}}>{item.data ? item.data[item.key] : '-'}</Text>
                        <Text numberOfLines={1} style={{fontSize:11, color:colors.subText, marginTop:2}}>{item.data ? item.data.marka : 'Veri Yok'}</Text>
                        <TouchableOpacity onPress={() => item.data && navigasyonuBaslat(item.data.marka)} style={{marginTop:8, backgroundColor:colors.inputBg, padding:4, borderRadius:8, alignItems:'center'}}>
                            <Text style={{fontSize:10, fontWeight:'700', color:colors.primary}}>GİT</Text>
                        </TouchableOpacity>
                    </View>
                ))}
             </View>

             <View style={styles.sectionContainer}>
               <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                   <Text style={[styles.sectionTitle, { color: colors.text }]}>📍 İstasyon Listesi</Text>
                   <TouchableOpacity onPress={() => { setSeciliSehir(kayitliKonum.sehir); setSeciliIlce(kayitliKonum.ilce); setAktifEkran('ilce_secimi'); }}><Text style={{color: colors.primary, fontWeight:'600'}}>Tümünü Gör</Text></TouchableOpacity>
               </View>
               {getIstasyonlar(kayitliKonum.sehir, kayitliKonum.ilce).slice(0, 3).map((ist, i) => {
                  let logo = null; Object.keys(LOGO_DOSYALARI).forEach(k => { if(ist.marka.toLowerCase().includes(k)) logo = LOGO_DOSYALARI[k]; });
                  const isFav = favoriKontrol(ist.marka, kayitliKonum.ilce, kayitliKonum.sehir);
                  return (
                    <View key={i} style={[styles.miniStationCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                      <View style={[styles.miniLogoBox, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>{logo ? <Image source={logo} style={{width:'100%', height:'100%'}} resizeMode='contain'/> : <Text>⛽</Text>}</View>
                      <View style={{flex:1, marginLeft:12}}>
                        <Text style={{fontWeight:'700', fontSize:15, color: colors.text}}>{ist.marka}</Text>
                        <View style={{flexDirection:'row', marginTop:2}}>
                            <Text style={{fontSize:12, color: colors.subText}}>B: {ist.benzin}</Text><Text style={{fontSize:12, color: colors.subText, marginLeft:8}}>M: {ist.motorin}</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => favoriIslemi(ist.marka, kayitliKonum.ilce, kayitliKonum.sehir)} style={{padding:8}}>
                          <FontAwesome5 name={isFav ? "heart" : "heart"} solid={isFav} size={20} color={isFav ? colors.accent : colors.subText} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => navigasyonuBaslat(ist.marka)} style={[styles.navPill, { backgroundColor: colors.primary, shadowColor: colors.primary, marginLeft:5 }]}>
                          <Text style={{color:'#fff', fontSize:12, fontWeight:'bold'}}>Git</Text>
                      </TouchableOpacity>
                    </View>
                  );
               })}
             </View>

             <View style={[styles.largeCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                 <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>⛽ Yakıt Hesapla</Text>
                    <TouchableOpacity onPress={maliyetHesapla}><Text style={{color: colors.primary, fontWeight:'600'}}>Hesapla</Text></TouchableOpacity>
                 </View>
                 <View style={styles.inputRow}>
                    <View style={styles.cleanInputContainer}><Text style={[styles.cleanLabel, {color: colors.subText}]}>Mesafe</Text><TextInput style={[styles.cleanInput, { backgroundColor: colors.inputBg, color: colors.text, shadowColor: colors.shadow }]} placeholder="500" placeholderTextColor={colors.subText} keyboardType="numeric" value={mesafe} onChangeText={setMesafe}/></View>
                    <View style={styles.cleanInputContainer}><Text style={[styles.cleanLabel, {color: colors.subText}]}>Tüketim</Text><TextInput style={[styles.cleanInput, { backgroundColor: colors.inputBg, color: colors.text, shadowColor: colors.shadow }]} placeholder="6.0" placeholderTextColor={colors.subText} keyboardType="numeric" value={tuketim} onChangeText={setTuketim}/></View>
                    <View style={styles.cleanInputContainer}><Text style={[styles.cleanLabel, {color: colors.subText}]}>Fiyat</Text><TextInput style={[styles.cleanInput, { backgroundColor: colors.inputBg, color: colors.text, shadowColor: colors.shadow }]} value={yakitFiyati} keyboardType="numeric" onChangeText={setYakitFiyati}/></View>
                 </View>
                 {sonucTutar && (<View style={[styles.resultBar]}><Text style={{color: colors.primary, fontWeight:'600'}}>Tahmini Tutar</Text><Text style={{color: colors.primary, fontWeight:'800', fontSize:18}}>{sonucTutar} ₺</Text></View>)}
             </View>
           </>
        )}

        {/* --- ŞEHİR ARAMA / LİSTELEME EKRANLARI --- */}
        {(aktifEkran === 'sehir_secimi' || aktifEkran === 'ilce_secimi') && (
            <View style={{marginTop:10}}>
                {aktifEkran === 'sehir_secimi' && (
                    <View style={[styles.searchBar, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                        <Feather name="search" size={20} color={colors.subText} /><TextInput style={{flex:1, marginLeft:10, color: colors.text}} placeholder="İl veya İlçe Ara..." placeholderTextColor={colors.subText} value={aramaMetni} onChangeText={setAramaMetni} />
                    </View>
                )}
                
                {aktifEkran === 'sehir_secimi' && Object.keys(sehirVerileri).filter(s=>s.toLowerCase().includes(aramaMetni.toLowerCase())).map(sehir => (
                    <TouchableOpacity key={sehir} style={[styles.simpleListItem]} onPress={() => { setSeciliSehir(sehir); setAktifEkran('ilce_secimi'); setAramaMetni(''); }}>
                        <Text style={[styles.simpleListText, { color: colors.text }]}>{baslikDuzenle(sehir)}</Text><Feather name="chevron-right" size={18} color={colors.icon} />
                    </TouchableOpacity>
                ))}
                {aktifEkran === 'ilce_secimi' && !seciliIlce && seciliSehir && (
                    <>
                        <TouchableOpacity onPress={() => setAktifEkran('sehir_secimi')} style={{marginBottom:10, flexDirection:'row', alignItems:'center'}}><Feather name="arrow-left" size={20} color={colors.text}/><Text style={{fontSize:18, fontWeight:'bold', marginLeft:10, color: colors.text}}>{baslikDuzenle(seciliSehir)}</Text></TouchableOpacity>
                        {Object.keys(sehirVerileri[seciliSehir]).map(ilce => (
                            <TouchableOpacity key={ilce} style={[styles.simpleListItem]} onPress={() => setSeciliIlce(ilce)}>
                                <Text style={[styles.simpleListText, { color: colors.text }]}>{baslikDuzenle(ilce)}</Text><Feather name="chevron-right" size={18} color={colors.icon} />
                            </TouchableOpacity>
                        ))}
                    </>
                )}
                {aktifEkran === 'ilce_secimi' && seciliIlce && (
                    <>
                        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:15}}>
                            <TouchableOpacity onPress={() => setSeciliIlce(null)} style={{flexDirection:'row', alignItems:'center'}}><Feather name="arrow-left" size={20} color={colors.text}/><Text style={{fontSize:18, fontWeight:'bold', marginLeft:10, color: colors.text}}>{baslikDuzenle(seciliIlce)} Fiyatları</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setHaritaModuAktif(true)} style={{backgroundColor: colors.card, padding:8, borderRadius:12, shadowColor:colors.shadow, shadowOffset:{width:0,height:2}, shadowOpacity:0.1, elevation:3}}>
                                <Feather name="map" size={24} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                            {[
                                {label: 'Benzin', data: enUcuzlariBul(seciliSehir, seciliIlce).benzin, key: 'benzin'},
                                {label: 'Motorin', data: enUcuzlariBul(seciliSehir, seciliIlce).motorin, key: 'motorin'},
                                {label: 'LPG', data: enUcuzlariBul(seciliSehir, seciliIlce).lpg, key: 'lpg'}
                            ].map((item, idx) => (
                                <View key={idx} style={[styles.bestPriceCard, {backgroundColor: colors.card, shadowColor: colors.shadow}]}>
                                    <View style={{flexDirection:'row', alignItems:'center', marginBottom:4}}>
                                        <View style={{width:8, height:8, borderRadius:4, backgroundColor: colors.bestPrice, marginRight:6}}/>
                                        <Text style={{fontSize:11, fontWeight:'600', color:colors.subText}}>{item.label}</Text>
                                    </View>
                                    <Text style={{fontSize:16, fontWeight:'800', color:colors.text}}>{item.data ? item.data[item.key] : '-'}</Text>
                                    <Text numberOfLines={1} style={{fontSize:11, color:colors.subText, marginTop:2}}>{item.data ? item.data.marka : 'Veri Yok'}</Text>
                                </View>
                            ))}
                        </View>

                        {getIstasyonlar(seciliSehir, seciliIlce).map((ist, i) => {
                             let logo = null; Object.keys(LOGO_DOSYALARI).forEach(k => { if(ist.marka.toLowerCase().includes(k)) logo = LOGO_DOSYALARI[k]; });
                             const isFav = favoriKontrol(ist.marka, seciliIlce, seciliSehir);
                             return (
                                <View key={i} style={[styles.newStationCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                                   <View style={styles.newStationHeader}>
                                      <View style={[styles.newLogoBox, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>{logo ? <Image source={logo} style={{width:'100%', height:'100%'}} resizeMode='contain'/> : <Text>⛽</Text>}</View>
                                      <Text style={[styles.newStationName, {flex:1, marginLeft:10, color: colors.text}]}>{ist.marka}</Text>
                                      <TouchableOpacity onPress={() => favoriIslemi(ist.marka, seciliIlce, seciliSehir)} style={{padding:8, marginRight:5}}>
                                          <FontAwesome5 name={isFav ? "heart" : "heart"} solid={isFav} size={22} color={isFav ? colors.accent : colors.subText} />
                                      </TouchableOpacity>
                                      <TouchableOpacity onPress={() => navigasyonuBaslat(ist.marka)} style={[styles.navPill, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
                                          <Text style={{color:'#fff', fontWeight:'bold'}}>Git</Text>
                                      </TouchableOpacity>
                                   </View>
                                   <View style={styles.newPriceRow}>
                                      <View style={styles.newPriceItem}><Text style={[styles.newPriceLabel, {color: colors.subText}]}>BENZİN</Text><Text style={[styles.newPriceVal, {color: colors.text}]}>{ist.benzin}</Text></View>
                                      <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} /><View style={styles.newPriceItem}><Text style={[styles.newPriceLabel, {color: colors.subText}]}>MOTORİN</Text><Text style={[styles.newPriceVal, {color: colors.text}]}>{ist.motorin}</Text></View>
                                      <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} /><View style={styles.newPriceItem}><Text style={[styles.newPriceLabel, {color: colors.subText}]}>LPG</Text><Text style={[styles.newPriceVal, {color: colors.text}]}>{ist.lpg}</Text></View>
                                   </View>
                                </View>
                             );
                        })}
                    </>
                )}
            </View>
        )}

        {/* --- FAVORİLER EKRANI --- */}
        {aktifEkran === 'favoriler' && (
            <View style={{marginTop:10}}>
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom:15 }]}>❤️ Favori İstasyonlarım</Text>
                {favoriler.length === 0 ? (
                    <View style={{alignItems:'center', marginTop:50}}>
                        <View style={{backgroundColor: colors.card, padding:20, borderRadius:50, marginBottom:20, shadowColor: colors.shadow, shadowOffset: {width:0, height:4}, shadowOpacity:0.1, shadowRadius:8, elevation:5}}>
                            <Feather name="heart" size={40} color={colors.subText} />
                        </View>
                        <Text style={{color:colors.text, fontSize:18, fontWeight:'bold'}}>Henüz Favori Yok</Text>
                    </View>
                ) : (
                    favoriler.map((fav, i) => {
                        const ist = getFavoriIstasyonVerisi(fav);
                        if(!ist) return null; 
                        let logo = null; Object.keys(LOGO_DOSYALARI).forEach(k => { if(ist.marka.toLowerCase().includes(k)) logo = LOGO_DOSYALARI[k]; });
                        return (
                            <View key={i} style={[styles.newStationCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                                <View style={styles.newStationHeader}>
                                    <View style={[styles.newLogoBox, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>{logo ? <Image source={logo} style={{width:'100%', height:'100%'}} resizeMode='contain'/> : <Text>⛽</Text>}</View>
                                    <View style={{flex:1, marginLeft:10}}>
                                        <Text style={[styles.newStationName, {color: colors.text}]}>{ist.marka}</Text>
                                        <Text style={{fontSize:11, color: colors.subText}}>{baslikDuzenle(ist.ilce)} / {baslikDuzenle(ist.sehir)}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => favoriIslemi(ist.marka, ist.ilce, ist.sehir)} style={{padding:8, marginRight:5}}>
                                        <FontAwesome5 name="heart" solid size={22} color={colors.accent} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => navigasyonuBaslat(ist.marka, ist.ilce, ist.sehir)} style={[styles.navPill, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
                                        <Text style={{color:'#fff', fontWeight:'bold'}}>Git</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.newPriceRow}>
                                    <View style={styles.newPriceItem}><Text style={[styles.newPriceLabel, {color: colors.subText}]}>BENZİN</Text><Text style={[styles.newPriceVal, {color: colors.text}]}>{ist.benzin}</Text></View>
                                    <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} /><View style={styles.newPriceItem}><Text style={[styles.newPriceLabel, {color: colors.subText}]}>MOTORİN</Text><Text style={[styles.newPriceVal, {color: colors.text}]}>{ist.motorin}</Text></View>
                                    <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} /><View style={styles.newPriceItem}><Text style={[styles.newPriceLabel, {color: colors.subText}]}>LPG</Text><Text style={[styles.newPriceVal, {color: colors.text}]}>{ist.lpg}</Text></View>
                                </View>
                            </View>
                        );
                    })
                )}
            </View>
        )}

        {/* --- DİĞER EKRANI --- */}
        {aktifEkran === 'diger' && (
            <View style={{marginTop:20}}>
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom:15 }]}>Diğer Seçenekler</Text>
                
                <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.card, shadowColor: colors.shadow }]} onPress={ayarDuzenlemeyiAc}>
                    <View style={[styles.menuIconBox, {backgroundColor: colors.bg}]}><Feather name="settings" size={20} color={colors.primary}/></View>
                    <Text style={[styles.menuText, {color:colors.text}]}>Uygulama Ayarları</Text>
                    <Feather name="chevron-right" size={20} color={colors.subText}/>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                    <View style={[styles.menuIconBox, {backgroundColor: colors.bg}]}><Feather name="star" size={20} color={colors.primary}/></View>
                    <Text style={[styles.menuText, {color:colors.text}]}>Uygulamayı Değerlendir</Text>
                    <Feather name="chevron-right" size={20} color={colors.subText}/>
                </TouchableOpacity>
                
                <View style={{alignItems:'center', marginTop:40}}>
                    <Text style={{color:colors.subText, fontSize:12}}>OtoYakıt {UYGULAMA_VERSIYONU}</Text>
                    <Text style={{color:colors.subText, fontSize:12, marginTop:4}}>Design by Kadir Akmese</Text>
                </View>
            </View>
        )}

        <View style={{height:100}} />
      </ScrollView>
      )}

      {/* --- FLOATING TAB BAR --- */}
      {!haritaModuAktif && (
      <View style={[styles.floatingTabBar, { backgroundColor: colors.tabBg, shadowColor: colors.shadow }]}>
         <TouchableOpacity style={styles.floatingTabItem} onPress={() => { setAktifEkran('anasayfa'); setHaritaModuAktif(false); }}>
            <View style={[styles.floatingTabIconWrapper, aktifEkran==='anasayfa' && {backgroundColor: colors.tabActive}]}>
                <Feather name="home" size={24} color={aktifEkran==='anasayfa' ? colors.primary : colors.subText}/>
            </View>
         </TouchableOpacity>

         <TouchableOpacity style={styles.floatingTabItem} onPress={() => { setAktifEkran('sehir_secimi'); setSeciliSehir(null); setSeciliIlce(null); setHaritaModuAktif(false); }}>
             <View style={[styles.floatingTabIconWrapper, (aktifEkran==='sehir_secimi'||aktifEkran==='ilce_secimi') && {backgroundColor: colors.tabActive}]}>
                <Feather name="search" size={24} color={(aktifEkran==='sehir_secimi'||aktifEkran==='ilce_secimi') ? colors.primary : colors.subText}/>
             </View>
         </TouchableOpacity>

         <TouchableOpacity style={styles.floatingTabItem} onPress={() => { setAktifEkran('favoriler'); setHaritaModuAktif(false); }}>
             <View style={[styles.floatingTabIconWrapper, aktifEkran==='favoriler' && {backgroundColor: colors.tabActive}]}>
                <Feather name="heart" size={24} color={aktifEkran==='favoriler' ? colors.primary : colors.subText}/>
             </View>
         </TouchableOpacity>

         <TouchableOpacity style={styles.floatingTabItem} onPress={() => { setAktifEkran('diger'); setHaritaModuAktif(false); }}>
             <View style={[styles.floatingTabIconWrapper, aktifEkran==='diger' && {backgroundColor: colors.tabActive}]}>
                <Feather name="more-horizontal" size={24} color={aktifEkran==='diger' ? colors.primary : colors.subText}/>
             </View>
         </TouchableOpacity>
      </View>
      )}

      <Modal visible={ilkAcilisModali} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                  {modalGorunumu === 'form' ? (
                    <>
                        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:15}}>
                            <Text style={[styles.modalTitleCenter, {color: colors.text}]}>Ayarlar</Text>
                        </View>
                        <TextInput style={[styles.textInputBox, { backgroundColor: colors.inputBg, color: colors.text, shadowColor: colors.shadow }]} placeholder="Adınız" placeholderTextColor={colors.subText} value={tempIsim} onChangeText={setTempIsim} />
                        <TouchableOpacity style={[styles.gpsButton, { borderColor: colors.primary }]} onPress={konumumuBul} disabled={konumBulunuyor || konumBasarili}>
                            {konumBulunuyor ? <ActivityIndicator size="small" color={colors.primary} /> : 
                            <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center'}}><Feather name={konumBasarili?"check":"map-pin"} size={16} color={colors.primary} style={{marginRight:6}}/><Text style={{color: colors.primary, fontWeight:'600', fontSize:14}}>{konumBasarili ? "Konum Alındı" : "Konumumu Bul"}</Text></View>}
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.selectorBox, { backgroundColor: colors.inputBg, shadowColor: colors.shadow }]} onPress={() => setModalGorunumu('sehir')}><Text style={{color: colors.text, fontSize:15}}>{tempSehir ? baslikDuzenle(tempSehir) : "Şehir Seç"}</Text><Feather name="chevron-down" size={16} color={colors.subText} /></TouchableOpacity>
                        <TouchableOpacity style={[styles.selectorBox, { backgroundColor: colors.inputBg, shadowColor: colors.shadow }, !tempSehir && {opacity:0.5}]} onPress={() => tempSehir && setModalGorunumu('ilce')} disabled={!tempSehir}><Text style={{color: colors.text, fontSize:15}}>{tempIlce ? baslikDuzenle(tempIlce) : "İlçe Seç"}</Text><Feather name="chevron-down" size={16} color={colors.subText} /></TouchableOpacity>
                        <View style={{marginTop:20}}>
                            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={kurulumuTamamla}><Text style={styles.saveButtonText}>Kaydet</Text></TouchableOpacity>
                            {kayitliKonum && <TouchableOpacity style={styles.cancelButtonTextOnly} onPress={() => setIlkAcilisModali(false)}><Text style={{color: colors.subText, fontSize:14}}>Vazgeç</Text></TouchableOpacity>}
                        </View>
                    </>
                  ) : (
                    <View style={{flex:1}}>
                        <View style={[styles.selectorHeader]}><Text style={[styles.selectorTitle, { color: colors.text }]}>{modalGorunumu === 'sehir' ? 'Şehir Seç' : 'İlçe Seç'}</Text><TouchableOpacity onPress={() => setModalGorunumu('form')}><Text style={{color: colors.primary, fontSize:14}}>Bitti</Text></TouchableOpacity></View>
                        <FlatList data={modalGorunumu === 'sehir' ? Object.keys(sehirVerileri).sort() : Object.keys(sehirVerileri[tempSehir] || {}).sort()} renderItem={({item}) => (
                                <TouchableOpacity style={[styles.modalItem]} onPress={() => { if(modalGorunumu==='sehir'){ setTempSehir(item); setTempIlce(null); setKonumBasarili(false); } else { setTempIlce(item); } setModalGorunumu('form'); }}>
                                    <Text style={[styles.modalItemText, { color: colors.text }]}>{baslikDuzenle(item)}</Text>{((modalGorunumu==='sehir' && tempSehir===item) || (modalGorunumu==='ilce' && tempIlce===item)) && <Feather name="check" size={16} color={colors.primary}/>}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                  )}
              </View>
          </View>
      </Modal>

      <Modal animationType="slide" transparent={true} visible={!!seciliHaber} onRequestClose={() => setSeciliHaber(null)}>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                {seciliHaber && (
                    <>
                        <View style={styles.modalHeader}><View style={{flex:1}}><Text style={[styles.modalDate, {color: colors.subText}]}>{seciliHaber.tarih}</Text><Text style={[styles.modalTitle, {color: colors.text}]}>{seciliHaber.baslik}</Text></View><TouchableOpacity onPress={() => setSeciliHaber(null)} style={styles.closeButton}><Feather name="x" size={24} color={colors.text} /></TouchableOpacity></View>
                        <ScrollView style={{maxHeight: 300}}><Text style={[styles.modalBody, {color: colors.text}]}>{seciliHaber.mesaj}</Text></ScrollView>
                    </>
                )}
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { paddingHorizontal: 24, paddingTop: 15, paddingBottom: 10, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  headerGreeting: { fontSize: 22, fontWeight: '800' },
  locationPill: { flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, alignSelf: 'flex-start', shadowOffset: {width:0, height:2}, shadowOpacity:0.08, shadowRadius:6, elevation:3 },
  locationText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  marketBarContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginHorizontal: 20, marginTop: 15, marginBottom: 10, paddingVertical: 15, borderRadius: 20, shadowOffset: {width:0, height:4}, shadowOpacity:0.08, shadowRadius:10, elevation: 4 },
  marketItem: { alignItems: 'center' },
  marketLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  marketValue: { fontSize: 15, fontWeight: '800' },
  verticalDividerSmall: { width: 1, height: 25 },
  scrollContent: { paddingHorizontal: 20 },
  sectionContainer: { marginBottom: 25, marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  miniStationCard: { flexDirection:'row', alignItems:'center', padding:15, borderRadius:20, marginBottom:12, shadowOffset: {width:0, height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:3 },
  miniLogoBox: { width: 44, height: 44, borderRadius:14, justifyContent:'center', alignItems:'center', padding:4, shadowOffset: {width:0, height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  navPill: { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:8, borderRadius:20, shadowOffset: {width:0, height:2}, shadowOpacity:0.2, shadowRadius:4, elevation:3 },
  largeCard: { borderRadius: 28, padding: 24, marginBottom: 25, shadowOffset: {width:0, height:6}, shadowOpacity:0.08, shadowRadius:15, elevation:5 },
  cardHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:18 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cleanInputContainer: { width: '31%' },
  cleanLabel: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  cleanInput: { borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14, fontSize: 14, fontWeight: '600', shadowOffset: {width:0, height:2}, shadowOpacity:0.05, shadowRadius:6, elevation:2 },
  resultBar: { marginTop: 18, paddingTop: 18, borderTopWidth: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 24, marginBottom: 12, shadowOffset: {width:0, height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:3 },
  listIconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  listTitle: { fontSize: 16, fontWeight: '700' },
  listSubTitle: { fontSize: 12, marginTop: 3, fontWeight:'500' },
  newStationCard: { borderRadius:26, padding:20, marginBottom:18, shadowOffset: {width:0, height:4}, shadowOpacity:0.08, shadowRadius:12, elevation:4 },
  newStationHeader: { flexDirection:'row', alignItems:'center', marginBottom:20 },
  newLogoBox: { width: 52, height: 52, borderRadius:18, justifyContent:'center', alignItems:'center', padding:6, shadowOffset: {width:0, height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  newStationName: { fontSize:17, fontWeight:'700' },
  newPriceRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  newPriceItem: { flex:1, alignItems:'center' },
  newPriceLabel: { fontSize:11, fontWeight:'600', marginBottom:5, textTransform:'uppercase' },
  newPriceVal: { fontSize:18, fontWeight:'800' },
  verticalDivider: { width:1, height:30 },
  floatingTabBar: { position: 'absolute', bottom: 30, left: 20, right: 20, borderRadius: 35, height: 75, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 25, elevation: 10 },
  floatingTabItem: { alignItems: 'center', justifyContent: 'center' },
  floatingTabIconWrapper: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  menuItem: { flexDirection:'row', alignItems:'center', padding:16, borderRadius:20, marginBottom:12, shadowOffset: {width:0, height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:3 },
  menuIconBox: { width:44, height:44, borderRadius:14, justifyContent:'center', alignItems:'center', marginRight:15 },
  menuText: { flex:1, fontSize:16, fontWeight:'600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { borderRadius: 28, padding: 24, width: '82%', shadowOffset: {width:0, height:10}, shadowOpacity:0.1, shadowRadius:30, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalDate: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  modalBody: { fontSize: 16, lineHeight: 24 },
  modalTitleCenter: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  textInputBox: { borderRadius: 14, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16, marginBottom:12, shadowOffset: {width:0, height:2}, shadowOpacity:0.05, shadowRadius:6, elevation:2 },
  selectorBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 14, marginBottom:10, shadowOffset: {width:0, height:2}, shadowOpacity:0.05, shadowRadius:6, elevation:2 },
  saveButton: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', shadowOffset:{width:0, height:4}, shadowOpacity:0.2, shadowRadius:8, elevation:4 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButtonTextOnly: { marginTop: 15, paddingVertical: 8, alignItems: 'center', justifyContent:'center' },
  gpsButton: { flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:12, borderRadius:14, marginBottom:20, borderWidth: 1, borderStyle: 'dashed' },
  selectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 0 },
  selectorTitle: { fontSize: 16, fontWeight: 'bold' },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0 },
  modalItemText: { fontSize: 15 },
  searchBar: { flexDirection:'row', alignItems:'center', padding:14, borderRadius:20, marginBottom:20, shadowOffset: {width:0, height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:3 },
  simpleListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 0, paddingHorizontal: 10 },
  simpleListText: { fontSize: 16, fontWeight: '600', marginLeft: 12 },
  bestPriceCard: { width: '31%', borderRadius: 20, padding: 12, alignItems: 'flex-start', justifyContent: 'space-between', shadowOffset: {width:0, height:4}, shadowOpacity:0.08, shadowRadius:10, elevation:4 },
  closeMapButton: { position:'absolute', top: 50, right: 20, backgroundColor: '#3A3A3C', borderRadius:20, padding:10, flexDirection:'row', alignItems:'center', shadowColor: '#000', shadowOffset:{width:0, height:4}, shadowOpacity:0.3, shadowRadius:5, elevation:5, zIndex:10 },
  carousel: { position: 'absolute', bottom: 100, left: 0, right: 0, paddingVertical: 10 },
  carouselCard: { backgroundColor: '#fff', borderRadius: 24, height: 160, padding: 20, marginLeft: 10, marginRight: 10, width: CARD_WIDTH, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  carouselHeader: { flexDirection:'row', alignItems:'center', marginBottom:15 },
  carouselTitle: { fontSize: 18, fontWeight:'700', marginLeft:10, flex:1 },
  carouselButton: { marginTop:15, paddingVertical:10, borderRadius:14, alignItems:'center' },
  markerWrap: { width:40, height:40, borderRadius:20, justifyContent:'center', alignItems:'center', borderWidth:2, borderColor:'#fff', shadowColor:'#000', shadowOffset:{width:0, height:2}, shadowOpacity:0.2, shadowRadius:4, elevation:5 }
});