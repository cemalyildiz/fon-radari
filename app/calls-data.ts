export type CallScope = "national" | "international";
export type CallStatus = "open" | "upcoming" | "archived";

export type FundingCall = {
  id: string;
  scope: CallScope;
  code: string;
  title: string;
  institution: string;
  institutionShort: string;
  status: CallStatus;
  openDate: string;
  deadline: string;
  preDeadline?: string;
  applicants: string;
  companyScale: string[];
  fundingAmount: string;
  fundingType: string;
  supportRate?: string;
  duration?: string;
  summary: string;
  objectives: string[];
  eligibleCosts: string[];
  application: string;
  sourceUrl: string;
  sourceLabel: string;
  verifiedAt: string;
  tags: string[];
  featured?: boolean;
  notice?: string;
};

export const calls: FundingCall[] = [
  {
    id: "tubitak-1501-2026-2",
    scope: "national",
    code: "1501 · 2026/2",
    title: "Sanayi Ar-Ge Projeleri Destekleme Programı",
    institution: "Türkiye Bilimsel ve Teknolojik Araştırma Kurumu",
    institutionShort: "TÜBİTAK",
    status: "open",
    openDate: "2026-07-20T00:00:00+03:00",
    deadline: "2026-10-26T23:59:00+03:00",
    preDeadline: "2026-10-22T17:30:00+03:00",
    applicants: "Türkiye’de yerleşik KOBİ ölçeğindeki sermaye şirketleri",
    companyScale: ["KOBİ"],
    fundingAmount: "Proje başına en fazla 20 milyon TL TÜBİTAK katkısı",
    fundingType: "Geri ödemesiz hibe",
    supportRate: "İlk 5 proje için %75; 6. ve sonraki projeler için %60",
    duration: "En fazla 36 ay",
    summary:
      "KOBİ’lerin araştırma, teknoloji geliştirme ve yenilik faaliyetlerini proje esaslı olarak destekler. Konu sınırlaması bulunmayan çağrıda yenilikçi ürün ve süreç geliştirme çalışmaları hedeflenir.",
    objectives: [
      "Ar-Ge kapasitesini ve teknoloji geliştirme yetkinliğini artırmak",
      "Yeni veya iyileştirilmiş ürün ve süreçlerin ortaya çıkmasını sağlamak",
      "Ticarileşme potansiyeli yüksek projeleri desteklemek",
    ],
    eligibleCosts: [
      "Personel ve seyahat giderleri",
      "Alet, teçhizat, yazılım ve yayın giderleri",
      "Malzeme, danışmanlık ve Ar-Ge hizmet alımları",
    ],
    application: "Başvurular PRODİS üzerinden elektronik olarak yapılır.",
    sourceUrl:
      "https://tubitak.gov.tr/tr/destekler/destek/sanayi/ulusal-destek-programlari/cagri-1501-sanayi-ar-ge-destek-programi-2026-yili-2-cagrisi-acildi",
    sourceLabel: "Resmî TÜBİTAK çağrı sayfası",
    verifiedAt: "2026-07-24T12:00:00+03:00",
    tags: ["Ar-Ge", "Teknoloji", "Yenilik", "KOBİ"],
    featured: true,
    notice: "Kuruluş bazlı ön kayıt için son tarih 22 Ekim 2026’dır.",
  },
  {
    id: "tubitak-1507-2026-2",
    scope: "national",
    code: "1507 · 2026/2",
    title: "KOBİ Ar-Ge Başlangıç Destek Programı",
    institution: "Türkiye Bilimsel ve Teknolojik Araştırma Kurumu",
    institutionShort: "TÜBİTAK",
    status: "open",
    openDate: "2026-07-20T00:00:00+03:00",
    deadline: "2026-11-11T23:59:00+03:00",
    preDeadline: "2026-11-09T17:30:00+03:00",
    applicants: "Ar-Ge projesi sunan Türkiye’de yerleşik KOBİ’ler",
    companyScale: ["KOBİ"],
    fundingAmount: "Çağrı dokümanındaki proje bütçesi ve üst limitler geçerlidir",
    fundingType: "Geri ödemesiz hibe",
    supportRate: "Çağrı dokümanına göre belirlenir",
    duration: "Çağrı dokümanına göre belirlenir",
    summary:
      "Ar-Ge faaliyetine yeni başlayan KOBİ’lerin proje hazırlama ve yürütme yetkinliğini geliştirmeyi, yenilikçi ürün ve süreç fikirlerini sistematik Ar-Ge projelerine dönüştürmeyi amaçlar.",
    objectives: [
      "KOBİ’lerde Ar-Ge kültürünü yaygınlaştırmak",
      "İlk Ar-Ge projelerinin kurgulanmasını ve yürütülmesini kolaylaştırmak",
      "Teknolojik yeniliklerin pazara taşınmasını hızlandırmak",
    ],
    eligibleCosts: [
      "Personel ve proje seyahatleri",
      "Alet, teçhizat, yazılım ve malzeme",
      "Danışmanlık ve hizmet alımları",
    ],
    application: "Başvurular PRODİS üzerinden elektronik olarak yapılır.",
    sourceUrl:
      "https://tubitak.gov.tr/tr/destekler/destek/sanayi/ulusal-destek-programlari/cagri-1507-kobi-ar-ge-baslangic-destek-programi-2026-yili-2-cagrisi-acildi",
    sourceLabel: "Resmî TÜBİTAK çağrı sayfası",
    verifiedAt: "2026-07-24T12:00:00+03:00",
    tags: ["Ar-Ge", "Başlangıç", "KOBİ", "Yenilik"],
    featured: true,
    notice: "Kuruluş bazlı ön kayıt için son tarih 9 Kasım 2026’dır.",
  },
  {
    id: "tubitak-1711-2026",
    scope: "national",
    code: "1711 · YZE · 2026",
    title: "Yapay Zekâ Ekosistem Çağrısı",
    institution: "Türkiye Bilimsel ve Teknolojik Araştırma Kurumu",
    institutionShort: "TÜBİTAK",
    status: "open",
    openDate: "2026-06-15T00:00:00+03:00",
    deadline: "2026-09-18T23:59:00+03:00",
    preDeadline: "2026-09-14T17:30:00+03:00",
    applicants:
      "Müşteri kuruluş, en az bir KOBİ teknoloji sağlayıcı ve üniversite/kamu araştırma birimi içeren konsorsiyumlar",
    companyScale: ["KOBİ", "Büyük Ölçek", "Üniversite / Araştırma"],
    fundingAmount: "Kuruluş türü ve çağrı dokümanındaki bütçe kurallarına göre",
    fundingType: "Hibe ve eş finansman",
    supportRate: "Kamu ve vakıf üniversitesi araştırma birimleri için %100; diğerleri çağrı koşullarına göre",
    duration: "Çağrı dokümanına göre belirlenir",
    summary:
      "Şirket ihtiyaçlarına yönelik yapay zekâ çözümlerinin, teknoloji sağlayıcı firmalar ve araştırma kurumlarıyla birlikte geliştirilmesini hedefleyen konsorsiyum çağrısıdır.",
    objectives: [
      "Yapay zekâ çözümlerini müşteri ihtiyaçlarına dönüştürmek",
      "Sanayi–üniversite iş birliğini güçlendirmek",
      "İklim, üretim, tarım, finans ve eğitim alanlarında uygulanabilir çözümler geliştirmek",
    ],
    eligibleCosts: [
      "Ar-Ge personeli ve proje faaliyetleri",
      "Yazılım, donanım, veri ve hizmet alımları",
      "Konsorsiyum kapsamında uygun görülen araştırma giderleri",
    ],
    application: "Konsorsiyum hazırlığı sonrasında başvuru PRODİS üzerinden yapılır.",
    sourceUrl:
      "https://tubitak.gov.tr/tr/destekler/destek/sanayi/ulusal-destek-programlari/cagri-1711-yapay-zeka-ekosistem-2026-yili-cagrisi-acildi",
    sourceLabel: "Resmî TÜBİTAK çağrı sayfası",
    verifiedAt: "2026-07-24T12:00:00+03:00",
    tags: ["Yapay Zekâ", "Sürdürülebilirlik", "Konsorsiyum"],
    featured: true,
    notice: "Konsorsiyum kurulmadan yapılan başvurular değerlendirmeye alınmaz.",
  },
  {
    id: "horizon-hop-on-2026",
    scope: "international",
    code: "HORIZON-WIDERA-2026-03",
    title: "Hop-on Facility",
    institution: "European Research Executive Agency",
    institutionShort: "Horizon Europe",
    status: "open",
    openDate: "2026-01-13T09:00:00+01:00",
    deadline: "2026-09-24T17:00:00+02:00",
    applicants:
      "Widening ülkelerindeki araştırma kuruluşları; devam eden uygun Horizon Europe projelerine katılım için",
    companyScale: ["Üniversite / Araştırma", "KOBİ", "Büyük Ölçek"],
    fundingAmount: "Çağrı toplam bütçesi 30 milyon avro",
    fundingType: "Hibe",
    supportRate: "Horizon Europe uygun maliyet ve fonlama kurallarına göre",
    duration: "Katılım sağlanan projenin kalan süresine göre",
    summary:
      "Widening ülkelerindeki araştırma kuruluşlarının, uygun bir ortak içermeyen devam eden Horizon Europe Pillar 2 veya EIC Pathfinder projelerine katılmasını sağlar.",
    objectives: [
      "Araştırma ve yenilik kapasitesi düşük bölgelerin katılımını artırmak",
      "Devam eden Avrupa konsorsiyumlarını yeni yetkinliklerle güçlendirmek",
      "Avrupa Araştırma Alanı içindeki iş birliklerini genişletmek",
    ],
    eligibleCosts: [
      "Yeni ortağın proje faaliyetleri",
      "Personel, seyahat ve uygun araştırma giderleri",
      "Horizon Europe model hibe sözleşmesine uygun maliyetler",
    ],
    application: "Başvurular EU Funding & Tenders Portal üzerinden yapılır.",
    sourceUrl:
      "https://rea.ec.europa.eu/funding-and-grants/horizon-europe-widening-participation-and-spreading-excellence/hop-facility_en",
    sourceLabel: "Resmî Avrupa Komisyonu çağrı sayfası",
    verifiedAt: "2026-07-24T12:00:00+03:00",
    tags: ["Horizon Europe", "Widening", "Ortaklık"],
  },
  {
    id: "life-circular-2026",
    scope: "international",
    code: "LIFE-2026-SAP-ENV",
    title: "Döngüsel Ekonomi ve Sıfır Kirlilik – Standart Eylem Projeleri",
    institution: "European Climate, Infrastructure and Environment Executive Agency",
    institutionShort: "LIFE / CINEA",
    status: "open",
    openDate: "2026-04-21T09:00:00+02:00",
    deadline: "2026-09-22T17:00:00+02:00",
    applicants:
      "AB ve LIFE’a katılan ülkelerdeki kamu veya özel tüzel kişiler; tek başına ya da konsorsiyum olarak",
    companyScale: ["KOBİ", "Büyük Ölçek", "Kamu", "STK", "Üniversite / Araştırma"],
    fundingAmount: "Konu bazlı çağrı bütçesi ve proje katkısı Funding & Tenders Portal’da belirtilir",
    fundingType: "Eş finansmanlı hibe",
    supportRate: "Çağrı ve LIFE uygunluk kurallarına göre",
    duration: "Proje tasarımına ve çağrı koşullarına göre",
    summary:
      "Döngüsel ekonomi, kaynak verimliliği, sıfır kirlilik ve çevresel kalite alanlarında AB politika hedeflerine ölçülebilir katkı sağlayan uygulama projelerini destekler.",
    objectives: [
      "Döngüsel iş modellerini ve kaynak verimliliğini yaygınlaştırmak",
      "Atık, hava, su ve toprak kirliliğini azaltmak",
      "Çevre politikalarının uygulanmasını ve ölçeklenmesini desteklemek",
    ],
    eligibleCosts: [
      "Proje personeli ve uygulama faaliyetleri",
      "Ekipman amortismanı ve hizmet alımları",
      "Pilot uygulamalar, iletişim ve yaygınlaştırma giderleri",
    ],
    application: "Başvurular EU Funding & Tenders Portal üzerinden yapılır.",
    sourceUrl: "https://cinea.ec.europa.eu/life-calls-proposals-2026_en",
    sourceLabel: "Resmî CINEA LIFE 2026 sayfası",
    verifiedAt: "2026-07-24T12:00:00+03:00",
    tags: ["Döngüsel Ekonomi", "Sıfır Kirlilik", "Yeşil Dönüşüm"],
    featured: true,
  },
  {
    id: "eic-accelerator-2026",
    scope: "international",
    code: "EIC Accelerator 2026",
    title: "EIC Accelerator Open",
    institution: "European Innovation Council",
    institutionShort: "EIC / Horizon",
    status: "open",
    openDate: "2026-01-01T09:00:00+01:00",
    deadline: "2026-09-02T17:00:00+02:00",
    applicants: "Yüksek büyüme potansiyeline sahip start-up ve KOBİ’ler; belirli koşullarda small mid-cap’ler",
    companyScale: ["Start-up", "KOBİ", "Small Mid-cap"],
    fundingAmount: "2,5 milyon avronun altında hibe ve 1–10 milyon avro yatırım bileşeni",
    fundingType: "Hibe, öz sermaye veya karma finansman",
    supportRate: "Program ve değerlendirme sonucuna göre",
    duration: "Hibe bileşeni faaliyetleri genellikle 24 aya kadar",
    summary:
      "TRL 6–8 seviyesindeki pazar yaratma veya mevcut pazarı dönüştürme potansiyeline sahip yüksek riskli yeniliklerin geliştirilmesini ve ölçeklenmesini destekler.",
    objectives: [
      "Çığır açıcı yenilikleri pazara taşımak",
      "Yüksek riskli ölçeklenme yatırımlarındaki finansman açığını kapatmak",
      "Avrupa’da küresel ölçekte rekabetçi teknoloji şirketleri oluşturmak",
    ],
    eligibleCosts: [
      "TRL 6–8 yenilik faaliyetleri",
      "Ürün doğrulama, demonstrasyon ve ölçekleme",
      "Hibe sözleşmesine uygun personel ve uygulama maliyetleri",
    ],
    application: "Kısa başvuru, tam başvuru ve jüri görüşmesi aşamaları Funding & Tenders Portal üzerinden yürütülür.",
    sourceUrl: "https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en",
    sourceLabel: "Resmî EIC Accelerator sayfası",
    verifiedAt: "2026-07-24T12:00:00+03:00",
    tags: ["Deep Tech", "Ölçeklenme", "Yatırım", "Hibe"],
    notice: "2026 tam başvuru değerlendirme tarihleri içinde sıradaki kesim tarihi 2 Eylül 2026’dır.",
  },
  {
    id: "eic-step-scaleup-2026",
    scope: "international",
    code: "EIC STEP Scale Up 2026",
    title: "EIC STEP Scale Up",
    institution: "European Innovation Council",
    institutionShort: "EIC / STEP",
    status: "open",
    openDate: "2026-01-01T09:00:00+01:00",
    deadline: "2026-09-09T17:00:00+02:00",
    applicants: "Stratejik teknoloji alanlarında ölçeklenen start-up, KOBİ, spin-off ve small mid-cap’ler",
    companyScale: ["Start-up", "KOBİ", "Small Mid-cap"],
    fundingAmount: "10–30 milyon avro öz sermaye yatırımı",
    fundingType: "Doğrudan öz sermaye yatırımı",
    supportRate: "Yatırım değerlendirmesi ve ortak yatırım yapısına göre",
    duration: "Yatırım ve ölçeklenme planına göre",
    summary:
      "Kritik dijital, temiz ve biyoteknoloji alanlarındaki şirketlerin büyük özel yatırım turlarını katalize etmek üzere EIC Fund yatırımı sağlar.",
    objectives: [
      "Avrupa’nın stratejik teknoloji kapasitesini büyütmek",
      "Büyük ölçekli özel yatırımları harekete geçirmek",
      "Yüksek potansiyelli teknoloji şirketlerinin Avrupa’da ölçeklenmesini sağlamak",
    ],
    eligibleCosts: [
      "Ölçeklenme yatırımları",
      "Üretim ve pazara erişim kapasitesinin büyütülmesi",
      "Yatırım sözleşmesinde tanımlanan kullanım alanları",
    ],
    application: "Başvurular Funding & Tenders Portal üzerinden, EIC yatırım değerlendirme süreciyle yürütülür.",
    sourceUrl: "https://eic.ec.europa.eu/eic-funding-opportunities_en",
    sourceLabel: "Resmî EIC fonlama fırsatları sayfası",
    verifiedAt: "2026-07-24T12:00:00+03:00",
    tags: ["STEP", "Öz Sermaye", "Stratejik Teknoloji"],
  },
  {
    id: "tubitak-1707-2026-2",
    scope: "national",
    code: "1707 · 2026/2",
    title: "Siparişe Dayalı Ar-Ge Projeleri için KOBİ Destekleme",
    institution: "Türkiye Bilimsel ve Teknolojik Araştırma Kurumu",
    institutionShort: "TÜBİTAK",
    status: "archived",
    openDate: "2026-05-04T00:00:00+03:00",
    deadline: "2026-07-17T23:59:00+03:00",
    applicants: "Müşteri kuruluş ile Türkiye’de yerleşik KOBİ tedarikçi kuruluşun ortak başvurusu",
    companyScale: ["KOBİ", "Büyük Ölçek"],
    fundingAmount: "Çağrı dokümanındaki üst limitlere göre",
    fundingType: "TÜBİTAK ve müşteri kuruluş eş finansmanı",
    supportRate: "Çağrı dokümanına göre",
    duration: "Çağrı dokümanına göre",
    summary:
      "Müşteri kuruluşun ihtiyacını karşılayan ticarileşebilir bir ürün veya sürecin KOBİ tedarikçi tarafından Ar-Ge yoluyla geliştirilmesini destekler.",
    objectives: ["Sipariş odaklı Ar-Ge iş birlikleri kurmak", "Ticarileşme riskini paylaşmak", "KOBİ’lerin müşterisi hazır ürün geliştirmesini sağlamak"],
    eligibleCosts: ["Personel", "Alet ve teçhizat", "Malzeme ve hizmet alımları"],
    application: "Başvurular kapanmıştır. Yeni dönem takvimi resmî sayfadan izlenmelidir.",
    sourceUrl:
      "https://tubitak.gov.tr/tr/destekler/destek/sanayi/ulusal-destek-programlari/cagri-1707-siparise-dayali-ar-ge-projeleri-icin-kobi-destekleme-2026-2-cagrisi-acildi",
    sourceLabel: "Resmî TÜBİTAK çağrı sayfası",
    verifiedAt: "2026-07-24T12:00:00+03:00",
    tags: ["Sipariş Ar-Ge", "KOBİ", "İş Birliği"],
  },
  {
    id: "tubitak-1832-2026-1",
    scope: "national",
    code: "1832 · 2026/1",
    title: "Sanayide Yeşil Dönüşüm Çağrısı",
    institution: "Türkiye Bilimsel ve Teknolojik Araştırma Kurumu",
    institutionShort: "TÜBİTAK",
    status: "archived",
    openDate: "2026-04-01T00:00:00+03:00",
    deadline: "2026-06-09T23:59:00+03:00",
    applicants: "Yeşil teknoloji, ürün veya süreç geliştiren Türkiye’de yerleşik sermaye şirketleri",
    companyScale: ["KOBİ", "Büyük Ölçek"],
    fundingAmount: "Kuruluş ölçeğine ve program limitlerine göre",
    fundingType: "Geri ödemeli destek",
    supportRate: "Çağrı dokümanına göre",
    duration: "Çağrı dokümanına göre",
    summary:
      "Düşük karbonlu üretim, döngüsel ekonomi, temiz enerji, sürdürülebilir tarım ve ulaşım alanlarında THS 3–9 aralığındaki yeşil dönüşüm projelerini destekler.",
    objectives: ["Sanayinin yeşil dönüşümünü hızlandırmak", "Kaynak ve enerji verimliliğini artırmak", "Düşük karbonlu teknolojileri ölçeklemek"],
    eligibleCosts: ["Ar-Ge personeli", "Makine ve ekipman", "Pilot uygulama, malzeme ve hizmet alımları"],
    application: "Başvurular kapanmıştır. Yeni dönem çağrıları TÜBİTAK sayfasından izlenmelidir.",
    sourceUrl: "https://tubitak.gov.tr/tr/duyuru/1832-sanayide-yesil-donusum-2026-1-cagrisi-basvuruya-acildi",
    sourceLabel: "Resmî TÜBİTAK duyurusu",
    verifiedAt: "2026-07-24T12:00:00+03:00",
    tags: ["Yeşil Dönüşüm", "Döngüsel Ekonomi", "Sanayi"],
  },
];

