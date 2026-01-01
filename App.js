import React, { useState, useEffect, useRef } from 'react'; 
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Image, TextInput, Linking, Alert, Platform, Keyboard, Dimensions, Modal, FlatList, ActionSheetIOS, ActivityIndicator, Switch } from 'react-native';
import { MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import * as Location from 'expo-location'; 
import * as Notifications from 'expo-notifications'; 
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import veriDosyasi from './veriler.json'; // İlk kurulum yedeği

// --- FİNAL GITHUB RAW LINKINI BURAYA KOYUYORSUN ---
const ONLINE_JSON_URL = "https://raw.githubusercontent.com/kakmese/mazot-bot/refs/heads/main/veriler.json"; 

// --- RENK PALETİ ---
const THEME = {
  light: { bg: '#F5F7FA', card: '#FFFFFF', text: '#1E293B', subText: '#64748B', inputBg: '#F8FAFC', border: '#E2E8F0', primary: '#2563EB', icon: '#334155', success: '#10B981' },
  dark: { bg: '#0F172A', card: '#1E293B', text: '#F1F5F9', subText: '#94A3B8', inputBg: '#334155', border: '#475569', primary: '#3B82F6', icon: '#CBD5E1', success: '#059669' }
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

// --- LOGO TANIMLAMALARI (DÜZELTİLDİ: Hepsi .png yapıldı ve bozuk dosya silindi) ---
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
  <View style={[styles.marketBarContainer, { backgroundColor: colors.card }]}>
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const colors = isDarkMode ? THEME.dark : THEME.light;

  // Başlangıçta boş veri ile başlıyoruz, useEffect içinde dolduracağız
  const [sehirVerileri, setSehirVerileri] = useState(veriDosyasi.sehirler ? veriDosyasi.sehirler : veriDosyasi);
  const [veriKaynagi, setVeriKaynagi] = useState('Yükleniyor...'); // Kullanıcıya bilgi vermek için

  const [ilkAcilisModali, setIlkAcilisModali] = useState(false); 
  const [modalGorunumu, setModalGorunumu] = useState('form'); 
  const [tempIsim, setTempIsim] = useState('');
  const [tempSehir, setTempSehir] = useState(null);
  const [tempIlce, setTempIlce] = useState(null);
  const [konumBulunuyor, setKonumBulunuyor] = useState(false);
  const [konumBasarili, setKonumBasarili] = useState(false);
  const [bildirimGonderiliyor, setBildirimGonderiliyor] = useState(false);
  const [piyasaVerileri, setPiyasaVerileri] = useState({ dolar: '-', euro: '-', brent: '82.40' });
  const [duyurular, setDuyurular] = useState([]); 
  const [mesafe, setMesafe] = useState('');
  const [tuketim, setTuketim] = useState('6.0'); 
  const [yakitFiyati, setYakitFiyati] = useState('42.00'); 
  const [sonucTutar, setSonucTutar] = useState(null);

  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // --- AKILLI HAFIZA SİSTEMİ ---
    const verileriYukle = async () => {
        try {
            // 1. ÖNCE TELEFON HAFIZASINA BAK (Offline Mod)
            const kayitliVeriString = await AsyncStorage.getItem('sonGuncelVeriler');
            const kayitliKonumData = await AsyncStorage.getItem('kullaniciKonumu');
            const kayitliIsimData = await AsyncStorage.getItem('kullaniciIsmi');
            const temaTercihi = await AsyncStorage.getItem('temaTercihi');

            if (kayitliVeriString) {
                const kayitliVeri = JSON.parse(kayitliVeriString);
                // Eğer kayıtlı veri düzgünse hemen ekrana bas
                if(kayitliVeri.sehirler) {
                    setSehirVerileri(kayitliVeri.sehirler);
                    setVeriKaynagi('Hafıza');
                } else if (kayitliVeri) {
                      setSehirVerileri(kayitliVeri); // Eski format desteği
                      setVeriKaynagi('Hafıza');
                }
            }

            if (kayitliKonumData && kayitliIsimData) {
                setKayitliKonum(JSON.parse(kayitliKonumData));
                setKullaniciIsmi(kayitliIsimData);
            } else { setIlkAcilisModali(true); }
            if (temaTercihi) setIsDarkMode(temaTercihi === 'dark');

            // 2. ARKA PLANDA GITHUB'DAN EN YENİSİNİ ÇEK (Online Mod)
            if (ONLINE_JSON_URL) {
                fetch(ONLINE_JSON_URL)
                    .then(res => res.json())
                    .then(async (onlineData) => {
                        // Veri yapısını kontrol et ve ayıkla
                        const yeniVeri = onlineData.sehirler ? onlineData.sehirler : onlineData;
                        
                        // State'i güncelle (Ekrana yansıt)
                        setSehirVerileri(yeniVeri);
                        setVeriKaynagi('Canlı');
                        console.log("✅ Veriler GitHub'dan güncellendi!");

                        // Gelecek sefer için hafızaya kaydet
                        await AsyncStorage.setItem('sonGuncelVeriler', JSON.stringify(onlineData));
                    })
                    .catch((err) => {
                        console.log("⚠️ İnternet yok veya GitHub'a ulaşılamadı. Hafızadaki veri kullanılıyor.");
                        // Hata olsa bile sorun yok, çünkü yukarıda hafızadan yüklemiştik :)
                    });
            }

        } catch (e) {
            console.log("Veri yükleme hatası:", e);
        }
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

  const toggleTheme = async () => {
      const yeniDurum = !isDarkMode; setIsDarkMode(yeniDurum);
      await AsyncStorage.setItem('temaTercihi', yeniDurum ? 'dark' : 'light');
  };

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

  async function schedulePushNotification() {
    setBildirimGonderiliyor(true);
    try {
        await Notifications.scheduleNotificationAsync({
          content: { title: "🔔 Bildirim Testi", body: "Sistem sorunsuz çalışıyor!", sound: true }, trigger: null,
        });
        setTimeout(() => setBildirimGonderiliyor(false), 2000);
    } catch (e) { setBildirimGonderiliyor(false); }
  }

  const konumumuBul = async () => {
    setKonumBulunuyor(true); setKonumBasarili(false);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Hata', 'Konum izni verilmedi.'); setKonumBulunuyor(false); return; }
      let location = await Location.getCurrentPositionAsync({});
      let address = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      if (address && address.length > 0) {
        const { region, subregion } = address[0]; 
        const es = Object.keys(sehirVerileri).find(s => s.toLocaleUpperCase('tr-TR') === region?.toLocaleUpperCase('tr-TR'));
        if (es) {
            setTempSehir(es);
            const ei = Object.keys(sehirVerileri[es]).find(i => i.toLocaleUpperCase('tr-TR') === subregion?.toLocaleUpperCase('tr-TR'));
            if (ei) { setTempIlce(ei); setKonumBasarili(true); }
        } else { Alert.alert("Hata", "Bulunduğunuz şehir sistemde yok."); }
      }
    } catch (error) { Alert.alert("Hata", "GPS hatası."); } finally { setKonumBulunuyor(false); }
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

  const navigasyonuBaslat = (marka) => {
    const h = `${marka} ${seciliIlce || kayitliKonum?.ilce} ${seciliSehir || kayitliKonum?.sehir}`;
    const enc = encodeURIComponent(h);
    if(Platform.OS === 'ios'){
        ActionSheetIOS.showActionSheetWithOptions({ options: ['Vazgeç', 'Apple Haritalar', 'Google Haritalar'], cancelButtonIndex: 0 }, (idx) => {
            if(idx===1) Linking.openURL(`http://maps.apple.com/?q=${enc}`);
            if(idx===2) Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${enc}`);
        });
    } else { Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${enc}`); }
  };

  const baslikDuzenle = (metin) => metin ? metin.replace(/-/g, ' ').toUpperCase() : "";
  const getIstasyonlar = (s, i) => (s && i && sehirVerileri[s] && sehirVerileri[s][i]) ? sehirVerileri[s][i] : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={colors.bg} />
      
      {!ilkAcilisModali && (
        <View>
          <View style={[styles.headerContainer, { backgroundColor: colors.bg }]}>
             <View>
                 <Text style={[styles.headerGreeting, { color: colors.text }]}>Merhaba, {kullaniciIsmi} 👋</Text>
                 <TouchableOpacity style={[styles.locationPill, { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' }]} onPress={ayarDuzenlemeyiAc}>
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {aktifEkran === 'anasayfa' && kayitliKonum && (
           <>
             <View style={styles.sectionContainer}>
               <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                   <Text style={[styles.sectionTitle, { color: colors.text }]}>📍 {baslikDuzenle(kayitliKonum.ilce)} Fiyatları</Text>
                   <TouchableOpacity onPress={() => { setSeciliSehir(kayitliKonum.sehir); setSeciliIlce(kayitliKonum.ilce); setAktifEkran('ilce_secimi'); }}><Text style={{color: colors.primary, fontWeight:'600'}}>Tümünü Gör</Text></TouchableOpacity>
               </View>
               {getIstasyonlar(kayitliKonum.sehir, kayitliKonum.ilce).slice(0, 3).map((ist, i) => {
                  let logo = null; Object.keys(LOGO_DOSYALARI).forEach(k => { if(ist.marka.toLowerCase().includes(k)) logo = LOGO_DOSYALARI[k]; });
                  return (
                    <View key={i} style={[styles.miniStationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[styles.miniLogoBox, { backgroundColor: '#fff', borderColor: colors.border }]}>{logo ? <Image source={logo} style={{width:'100%', height:'100%'}} resizeMode='contain'/> : <Text>⛽</Text>}</View>
                      <View style={{flex:1, marginLeft:12}}>
                        <Text style={{fontWeight:'700', fontSize:15, color: colors.text}}>{ist.marka}</Text>
                        <View style={{flexDirection:'row', marginTop:2}}>
                            <Text style={{fontSize:12, color: colors.subText}}>B: {ist.benzin}</Text><Text style={{fontSize:12, color: colors.subText, marginLeft:8}}>M: {ist.motorin}</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => navigasyonuBaslat(ist.marka)} style={[styles.navPill, { backgroundColor: colors.primary }]}><Text style={{color:'#fff', fontSize:12, fontWeight:'bold'}}>Git</Text></TouchableOpacity>
                    </View>
                  );
               })}
             </View>

             <View style={[styles.largeCard, { backgroundColor: colors.card, shadowColor: isDarkMode ? '#000' : '#000' }]}>
                 <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>⛽ Yakıt Hesapla</Text>
                    <TouchableOpacity onPress={maliyetHesapla}><Text style={{color: colors.primary, fontWeight:'600'}}>Hesapla</Text></TouchableOpacity>
                 </View>
                 <View style={styles.inputRow}>
                    <View style={styles.cleanInputContainer}><Text style={[styles.cleanLabel, {color: colors.subText}]}>Mesafe</Text><TextInput style={[styles.cleanInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} placeholder="500" placeholderTextColor={colors.subText} keyboardType="numeric" value={mesafe} onChangeText={setMesafe}/></View>
                    <View style={styles.cleanInputContainer}><Text style={[styles.cleanLabel, {color: colors.subText}]}>Tüketim</Text><TextInput style={[styles.cleanInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} placeholder="6.0" placeholderTextColor={colors.subText} keyboardType="numeric" value={tuketim} onChangeText={setTuketim}/></View>
                    <View style={styles.cleanInputContainer}><Text style={[styles.cleanLabel, {color: colors.subText}]}>Fiyat</Text><TextInput style={[styles.cleanInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} value={yakitFiyati} keyboardType="numeric" onChangeText={setYakitFiyati}/></View>
                 </View>
                 {sonucTutar && (<View style={[styles.resultBar, { borderTopColor: colors.border }]}><Text style={{color: colors.primary, fontWeight:'600'}}>Tahmini Tutar</Text><Text style={{color: colors.primary, fontWeight:'800', fontSize:18}}>{sonucTutar} ₺</Text></View>)}
             </View>

             <Text style={[styles.sectionTitle, { color: colors.text }]}>Güncel Durum</Text>
             {duyurular.map((duyuru, index) => (
                <TouchableOpacity key={index} style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setSeciliHaber(duyuru)}>
                    <View style={[styles.listIconBox, {backgroundColor: duyuru.tip === 'zam' ? (isDarkMode ? '#450a0a' : '#FEF2F2') : (isDarkMode ? '#064e3b' : '#F0FDF4')}]}><Feather name={duyuru.tip === 'zam' ? "trending-up" : "trending-down"} size={22} color={duyuru.tip === 'zam' ? "#DC2626" : "#16A34A"} /></View>
                    <View style={{flex:1, marginLeft:15}}><Text style={[styles.listTitle, { color: colors.text }]}>{duyuru.baslik}</Text><Text style={[styles.listSubTitle, { color: colors.subText }]}>{duyuru.tarih}</Text></View>
                    <Feather name="chevron-right" size={20} color={colors.icon} />
                </TouchableOpacity>
             ))}
           </>
        )}

        {(aktifEkran === 'sehir_secimi' || aktifEkran === 'ilce_secimi') && (
            <View style={{marginTop:10}}>
                <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Feather name="search" size={20} color={colors.subText} /><TextInput style={{flex:1, marginLeft:10, color: colors.text}} placeholder="Ara..." placeholderTextColor={colors.subText} value={aramaMetni} onChangeText={setAramaMetni} />
                </View>
                {aktifEkran === 'sehir_secimi' && Object.keys(sehirVerileri).filter(s=>s.toLowerCase().includes(aramaMetni.toLowerCase())).map(sehir => (
                    <TouchableOpacity key={sehir} style={[styles.simpleListItem, { borderBottomColor: colors.border }]} onPress={() => { setSeciliSehir(sehir); setAktifEkran('ilce_secimi'); setAramaMetni(''); }}>
                        <Text style={[styles.simpleListText, { color: colors.text }]}>{baslikDuzenle(sehir)}</Text><Feather name="chevron-right" size={18} color={colors.icon} />
                    </TouchableOpacity>
                ))}
                {aktifEkran === 'ilce_secimi' && !seciliIlce && seciliSehir && (
                    <>
                        <TouchableOpacity onPress={() => setAktifEkran('sehir_secimi')} style={{marginBottom:10, flexDirection:'row', alignItems:'center'}}><Feather name="arrow-left" size={20} color={colors.text}/><Text style={{fontSize:18, fontWeight:'bold', marginLeft:10, color: colors.text}}>{baslikDuzenle(seciliSehir)}</Text></TouchableOpacity>
                        {Object.keys(sehirVerileri[seciliSehir]).map(ilce => (
                            <TouchableOpacity key={ilce} style={[styles.simpleListItem, { borderBottomColor: colors.border }]} onPress={() => setSeciliIlce(ilce)}>
                                <Text style={[styles.simpleListText, { color: colors.text }]}>{baslikDuzenle(ilce)}</Text><Feather name="chevron-right" size={18} color={colors.icon} />
                            </TouchableOpacity>
                        ))}
                    </>
                )}
                {aktifEkran === 'ilce_secimi' && seciliIlce && (
                    <>
                        <TouchableOpacity onPress={() => setSeciliIlce(null)} style={{marginBottom:15, flexDirection:'row', alignItems:'center'}}><Feather name="arrow-left" size={20} color={colors.text}/><Text style={{fontSize:18, fontWeight:'bold', marginLeft:10, color: colors.text}}>{baslikDuzenle(seciliIlce)} Fiyatları</Text></TouchableOpacity>
                        {getIstasyonlar(seciliSehir, seciliIlce).map((ist, i) => {
                             let logo = null; Object.keys(LOGO_DOSYALARI).forEach(k => { if(ist.marka.toLowerCase().includes(k)) logo = LOGO_DOSYALARI[k]; });
                             return (
                                <View key={i} style={[styles.newStationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                   <View style={styles.newStationHeader}>
                                      <View style={[styles.newLogoBox, { backgroundColor: '#fff', borderColor: colors.border }]}>{logo ? <Image source={logo} style={{width:'100%', height:'100%'}} resizeMode='contain'/> : <Text>⛽</Text>}</View>
                                      <Text style={[styles.newStationName, {flex:1, marginLeft:10, color: colors.text}]}>{ist.marka}</Text>
                                      <TouchableOpacity onPress={() => navigasyonuBaslat(ist.marka)} style={[styles.navPill, { backgroundColor: colors.primary }]}><Text style={{color:'#fff', fontWeight:'bold'}}>Git</Text></TouchableOpacity>
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
        <View style={{height:100}} />
      </ScrollView>

      <View style={[styles.tabBarContainer, { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(30, 41, 59, 0.90)' }]}>
         <TouchableOpacity style={styles.tabItem} onPress={() => setAktifEkran('anasayfa')}><View style={[styles.tabIconWrapper, aktifEkran==='anasayfa' && styles.activeTab]}><Feather name="home" size={24} color={aktifEkran==='anasayfa'?'#fff':'#94a3b8'}/></View><Text style={styles.tabText}>Ana Sayfa</Text></TouchableOpacity>
         <TouchableOpacity style={styles.tabItem} onPress={() => { setAktifEkran('sehir_secimi'); setSeciliSehir(null); setSeciliIlce(null); }}><View style={[styles.tabIconWrapper, (aktifEkran==='sehir_secimi'||aktifEkran==='ilce_secimi') && styles.activeTab]}><Feather name="search" size={24} color={(aktifEkran==='sehir_secimi'||aktifEkran==='ilce_secimi')?'#fff':'#94a3b8'}/></View><Text style={styles.tabText}>Tüm İller</Text></TouchableOpacity>
      </View>

      <Modal visible={ilkAcilisModali} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                  {modalGorunumu === 'form' ? (
                    <>
                        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
                            <Text style={[styles.modalTitleCenter, {color: colors.text, marginBottom:0}]}>⚙️ Ayarlar</Text>
                            <View style={{flexDirection:'row', alignItems:'center'}}><Feather name={isDarkMode ? "moon" : "sun"} size={20} color={colors.text} style={{marginRight:8}} /><Switch value={isDarkMode} onValueChange={toggleTheme} /></View>
                        </View>
                        <TextInput style={[styles.textInputBox, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Adınız" placeholderTextColor={colors.subText} value={tempIsim} onChangeText={setTempIsim} />
                        
                        <TouchableOpacity style={[styles.gpsButton, { backgroundColor: konumBasarili ? colors.success : '#10B981' }]} onPress={konumumuBul} disabled={konumBulunuyor}>
                            {konumBulunuyor ? <ActivityIndicator color="#fff" /> : 
                            <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center'}}>
                                <MaterialCommunityIcons name={konumBasarili?"check-circle":"crosshairs-gps"} size={22} color="#fff" style={{marginRight:8}}/>
                                <Text style={{color:'#fff', fontWeight:'bold', fontSize:16}}>{konumBasarili ? "Konum Alındı" : "Konumumu Bul"}</Text>
                            </View>}
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.selectorBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => setModalGorunumu('sehir')}><Text style={{color: colors.text}}>{tempSehir ? baslikDuzenle(tempSehir) : "Şehir Seç"}</Text><Feather name="chevron-down" size={16} color={colors.text} /></TouchableOpacity>
                        <TouchableOpacity style={[styles.selectorBox, { backgroundColor: colors.inputBg, borderColor: colors.border }, !tempSehir && {opacity:0.5}]} onPress={() => tempSehir && setModalGorunumu('ilce')} disabled={!tempSehir}><Text style={{color: colors.text}}>{tempIlce ? baslikDuzenle(tempIlce) : "İlçe Seç"}</Text><Feather name="chevron-down" size={16} color={colors.text} /></TouchableOpacity>
                        
                        <TouchableOpacity style={[styles.notifyBtn, bildirimGonderiliyor && {opacity:0.7}]} onPress={schedulePushNotification} disabled={bildirimGonderiliyor}>
                            {bildirimGonderiliyor ? <ActivityIndicator color="#fff"/> : <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center'}}><MaterialCommunityIcons name="bell-ring" size={18} color="#fff" style={{marginRight:8}}/><Text style={{color:'#fff', fontWeight:'600'}}>Bildirim Test Et</Text></View>}
                        </TouchableOpacity>

                        <View style={{marginTop:20}}>
                            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={kurulumuTamamla}><Text style={styles.saveButtonText}>Kaydet ve Başla</Text></TouchableOpacity>
                            {kayitliKonum && <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.inputBg }]} onPress={() => setIlkAcilisModali(false)}><Text style={{color: colors.subText}}>Vazgeç</Text></TouchableOpacity>}
                        </View>
                    </>
                  ) : (
                    <View style={{flex:1}}>
                        <View style={[styles.selectorHeader, { borderBottomColor: colors.border }]}><Text style={[styles.selectorTitle, { color: colors.text }]}>{modalGorunumu === 'sehir' ? 'Şehir Seç' : 'İlçe Seç'}</Text><TouchableOpacity onPress={() => setModalGorunumu('form')}><Text style={{color:'#FF3B30'}}>Geri</Text></TouchableOpacity></View>
                        <FlatList data={modalGorunumu === 'sehir' ? Object.keys(sehirVerileri).sort() : Object.keys(sehirVerileri[tempSehir] || {}).sort()}
                            renderItem={({item}) => (
                                <TouchableOpacity style={[styles.modalItem, { borderBottomColor: colors.border }]} onPress={() => { if(modalGorunumu==='sehir'){ setTempSehir(item); setTempIlce(null); setKonumBasarili(false); } else { setTempIlce(item); } setModalGorunumu('form'); }}>
                                    <Text style={[styles.modalItemText, { color: colors.text }]}>{baslikDuzenle(item)}</Text>{((modalGorunumu==='sehir' && tempSehir===item) || (modalGorunumu==='ilce' && tempIlce===item)) && <Feather name="check" size={18} color={colors.primary}/>}
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
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
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
  locationPill: { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, alignSelf: 'flex-start' },
  locationText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  marketBarContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginHorizontal: 20, marginTop: 10, marginBottom: 10, paddingVertical: 12, borderRadius: 16, shadowOpacity: 0.03, shadowRadius: 8, elevation: 3 },
  marketItem: { alignItems: 'center' },
  marketLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  marketValue: { fontSize: 15, fontWeight: '800' },
  verticalDividerSmall: { width: 1, height: 25 },
  scrollContent: { paddingHorizontal: 20 },
  sectionContainer: { marginBottom: 20, marginTop: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  miniStationCard: { flexDirection:'row', alignItems:'center', padding:12, borderRadius:16, marginBottom:10, borderWidth:1, shadowOpacity:0.02, shadowRadius:5 },
  miniLogoBox: { width: 40, height: 40, borderRadius:12, justifyContent:'center', alignItems:'center', borderWidth:1, padding:2 },
  navPill: { flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:6, borderRadius:20 },
  largeCard: { borderRadius: 28, padding: 22, marginBottom: 25, shadowOpacity:0.04, shadowRadius:15, elevation:3 },
  cardHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:15 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cleanInputContainer: { width: '31%' },
  cleanLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  cleanInput: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, fontSize: 14, fontWeight: '600', borderWidth:1 },
  resultBar: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 24, marginBottom: 12, shadowOpacity:0.02, shadowRadius:8, borderWidth:1 },
  listIconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  listTitle: { fontSize: 16, fontWeight: '700' },
  listSubTitle: { fontSize: 12, marginTop: 3, fontWeight:'500' },
  newStationCard: { borderRadius:26, padding:18, marginBottom:16, shadowOpacity:0.04, shadowRadius:10, borderWidth:1 },
  newStationHeader: { flexDirection:'row', alignItems:'center', marginBottom:18 },
  newLogoBox: { width: 50, height: 50, borderRadius:16, justifyContent:'center', alignItems:'center', borderWidth:1, padding:5 },
  newStationName: { fontSize:17, fontWeight:'700' },
  newPriceRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  newPriceItem: { flex:1, alignItems:'center' },
  newPriceLabel: { fontSize:11, fontWeight:'600', marginBottom:4, textTransform:'uppercase' },
  newPriceVal: { fontSize:18, fontWeight:'800' },
  verticalDivider: { width:1, height:30 },
  tabBarContainer: { position: 'absolute', bottom: 30, left: 50, right: 50, borderRadius: 40, height: 70, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 25, elevation: 10 },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  tabIconWrapper: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  activeTab: { backgroundColor: 'rgba(255,255,255,0.15)' },
  tabText: { fontSize: 10, fontWeight:'600', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { borderRadius: 24, padding: 24, width: '100%', height: '75%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  modalDate: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  modalBody: { fontSize: 16, lineHeight: 24 },
  modalTitleCenter: { fontSize: 20, fontWeight: '800', textAlign:'center' },
  textInputBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, marginBottom:15 },
  selectorBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, marginBottom:10 },
  saveButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', shadowOpacity:0.3, shadowRadius:5, elevation:4 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center', borderRadius:12 },
  cancelButtonText: { fontWeight:'600' },
  gpsButton: { flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:14, borderRadius:12, marginBottom:15, shadowOpacity:0.2, shadowRadius:4, elevation:2 },
  notifyBtn: { padding:14, borderRadius:12, alignItems:'center', marginBottom:10, backgroundColor:'#6366F1' },
  selectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1 },
  selectorTitle: { fontSize: 18, fontWeight: 'bold' },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  modalItemText: { fontSize: 16 },
  searchBar: { flexDirection:'row', alignItems:'center', padding:14, borderRadius:20, marginBottom:20, borderWidth:1, shadowOpacity:0.02, shadowRadius:5 },
  simpleListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  simpleListText: { fontSize: 16, fontWeight: '600', marginLeft: 12 },
});