# Fon Radarı

Ulusal ve uluslararası sanayi çağrılarını tarih, destek türü, başvuru koşulları, tema ve sektör bilgileriyle sunan web sitesi. Kapsamda Sanayi ve Teknoloji Bakanlığı, Ticaret Bakanlığı, SSB, TÜBİTAK, KOSGEB, EUREKA, Eurostars, Horizon Europe, LIFE ve EIC fırsatları bulunur.

## Yerel geliştirme

```bash
npm install
npm run dev
```

## Yayınlama

`main` gönderimleri, elle başlatma ve saatlik zamanlama aynı `pages.yml` akışını çalıştırır: test → kaynak aktarımı → veri/arşiv kaydı → statik derleme → Pages yayını. Bot gönderiminin başka bir iş akışını tetiklemesine ihtiyaç yoktur. GitHub zamanlamaları gecikebilir.

## Veri kapsamı ve sınırlar

- AB araması 2021–2027 program dönemindeki, gelecekte son tarihi bulunan 1/2/8 türlerini tüm sonuç sayfalarında tarar. Kaynağın 10.000 sonuç sınırı için tarih aralıkları bölünür. Bütün fonların veya Türkiye’ye uygun sanayi çağrılarının eksiksiz envanteri olduğu iddia edilmez.
- AB hibe konusu, EuropeAid dış eylem çağrısı ve proje alt çağrısı farklı kayıt türleridir. Alt çağrının başlığı ve portal kimliği kendi kaydından alınır; ana proje koduyla birleştirilmez. Bağlantısı yeniden eşleştirilemeyen eski aktarım satırları denetim için korunur ancak çağrı kartı olarak gösterilmez. API’de çelişen kapanış alanları açık başvuru kabul edilmez.
- Horizon konu bütçeleri, yalnız Komisyonun bütçe tablosunda konu kodu ve eylem satırı tam eşleşirse otomatik aktarılır. Paylaşımlı bütçeler tek konuya yazılmaz; çelişkili tutarlar gösterilmez. Beklenen AB katkısı gösterge niteliğindedir. Koşul bölümünden alınan resmî PDF bağlantıları, başvuru uygunluğunun doğrulandığı anlamına gelmez.
- Eski kayıtlar silinmez. Gelecek tarihli fakat artık bulunamayan kayıtlar kontrol bekler; geçmiş tarihli kayıtlar arşivde kalır.
- Otomatik aktarım yalnızca başlık/takvimdir; uygunluk, sektör, bütçe ve Türkiye’den katılım doğrulaması değildir. Sınıflandırılmamış kayıtlar açıkça ayrılır.
- Ulusal kaynakların duyuru bağlantıları da saatlik taranır; keşfedilen duyuru, açık çağrı veya doğrulanmış koşul kabul edilmez. Kaynak erişim hataları ayrıca gösterilir.
- Varsayılan “Kimler için?” filtresi özel sektördür. Üniversite/araştırma, bireysel akademisyen, kamu, TTO/arayüz ve STK ayrı seçilebilir. Tüm gruplar birlikte gösterildiğinde firma fırsatları önceliklidir. Sekme değişiminde başvuru grubu korunur; filtre sıfırlama özel sektör görünümüne döner.
- `applicantGroups` yalnız başvuru koşulları incelendikten sonra `public/verified-conditions.json` içinde atanır. Kurum adı, başlık, ARDEB kodu veya anahtar kelime üzerinden otomatik uygunluk kararı verilmez. Sınıflandırılmamış kayıtlar özel sektör filtresine girmez. Grup etiketi, doğrudan başvuru ile konsorsiyum katılımını veya ülke uygunluğunu birbirine eşitlemez; ayrıntılardaki kısıtlar geçerlidir.
- Resmî kaynaklar arasında çözümlenmemiş çelişkiler `verificationIssues` ile yayımlanır ve o alan doğrulanmış sayılmaz. Otomatik metin parçaları kesin koşul olarak gösterilmez.
- Duyuru yeniden okunup koşullar karşılaştırıldığında `reviewedEvidence` altında incelenen metin ve bağlantı özetleri kaydedilebilir. TÜBİTAK duyurularında bu yöntem yalnız başlık ve çağrı makalesini izler; sayfanın “Son duyurular” bölümü hesaba katılmaz. İş akışı yeni özeti kendiliğinden onaylamaz; metin veya bağlantılar daha sonra değişirse uyarı kalır.
- `verifiedAt` editoryal koşul kontrolü, `dateCheckedAt` ayrı takvim kontrolü, `sourceCheckedAt` API kaydının görülme zamanıdır.
- 48 saatten eski AB aktarımı ve 14 günden eski editoryal kontrol uyarılır. Başarısız aktarımda son başarılı zaman değiştirilmez; eski veri ve hata göstergesi yayımlanır.
- Genel program rehberleri açık çağrı sayısına katılmaz. Tarih bulunmaması sürekli başvuru anlamına gelmez.
- Tema/sektör etiketleri keşif amaçlıdır. Genel sektörlü desteklerin dahil edilmesi seçilebilir; uygunluk resmî koşullardan teyit edilmelidir.

## Doğrulama

`npm test`, `npm run lint` ve `GITHUB_REPOSITORY=cemalyildiz/fon-radari npm run build` çalıştırın. Testler tarih geçişlerini, Türkçe aramayı, genel sektör kapsamını, sayfalamayı, mükerrerleri ve arşiv korumasını denetler.
