# Fon Radarı

Ulusal ve uluslararası sanayi çağrılarını tarih, destek türü, başvuru koşulları, tema ve sektör bilgileriyle sunan web sitesi. Kapsamda Sanayi ve Teknoloji Bakanlığı, Ticaret Bakanlığı, SSB, TÜBİTAK, KOSGEB, EUREKA, Eurostars, Horizon Europe, LIFE ve EIC fırsatları bulunur.

## Yerel geliştirme

```bash
npm install
npm run dev
```

## Yayınlama

`main` dalına yapılan her gönderim GitHub Actions ile statik siteyi oluşturur ve GitHub Pages’e yayımlar. Çağrılar tema/konsept, sektör, firma ölçeği ve durum alanlarıyla filtrelenebilir. Avrupa Komisyonu çağrı verileri saatlik yenilenir; süreli çağrılar tarihleri geçtiğinde otomatik arşivlenir, sürekli başvurular ayrı olarak gösterilir.
