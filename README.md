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
- Eski kayıtlar silinmez. Gelecek tarihli fakat artık bulunamayan kayıtlar kontrol bekler; geçmiş tarihli kayıtlar arşivde kalır.
- Otomatik aktarım yalnızca başlık/takvimdir; uygunluk, sektör, bütçe ve Türkiye’den katılım doğrulaması değildir. Sınıflandırılmamış kayıtlar açıkça ayrılır.
- Diğer kurumların kayıtları `app/calls-data.ts` içinde editoryal güncellenir; bu kaynaklar için otomatik tarayıcı henüz yoktur.
- `verifiedAt` editoryal koşul kontrolü, `dateCheckedAt` ayrı takvim kontrolü, `sourceCheckedAt` API kaydının görülme zamanıdır.
- 48 saatten eski AB aktarımı ve 14 günden eski editoryal kontrol uyarılır. Başarısız aktarımda son başarılı zaman değiştirilmez; eski veri ve hata göstergesi yayımlanır.
- Genel program rehberleri açık çağrı sayısına katılmaz. Tarih bulunmaması sürekli başvuru anlamına gelmez.
- Tema/sektör etiketleri keşif amaçlıdır. Genel sektörlü desteklerin dahil edilmesi seçilebilir; uygunluk resmî koşullardan teyit edilmelidir.

## Doğrulama

`npm test`, `npm run lint` ve `GITHUB_REPOSITORY=cemalyildiz/fon-radari npm run build` çalıştırın. Testler tarih geçişlerini, Türkçe aramayı, genel sektör kapsamını, sayfalamayı, mükerrerleri ve arşiv korumasını denetler.
