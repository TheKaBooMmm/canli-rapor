# Canlı Rapor

Claude Code için bir mod: Claude'un o an ne yaptığını **Türkçe, sade bir dille ve canlı olarak** bir panelde anlatır. Her cevabın altına da süreyi, token kullanımını ve bunun Anthropic API fiyatıyla karşılığını yazar.

*A Claude Code mod that narrates, live and in plain Turkish, what Claude is doing, and adds time, token and API-price cost to every reply.*

## Neler sunuyor

**Panel (yukarıdan aşağıya)**

- **⏸ Onay uyarısı:** Bir işlem senin iznini beklerken panelin en üstünde sarı bir kutu çıkar ve bir masaüstü bildirimi gelir. Başka bir pencereye bakarken işin takıldığını hemen fark edersin.
- **Durum satırı:** `● Çalışıyorum · 42 sn · 5 işlem` ya da `○ Bekliyorum · sıra sende`. Sayaç her saniye ilerler; altında o an yapılan iş yazar (örneğin `📖 Dosya okuyorum: durum.md`).
- **Son cevaplar:** Son 5 cevabın süresi, token sayısı ve maliyeti, en yenisi üstte. Altında oturumun toplamı: kaç cevap, ne kadar süre, kaç token, kaç dolar.
- **Değişen dosyalar:** Oturumda oluşturulan (🆕) ve düzenlenen (✏️) dosyaların son 5'i: kaç kez değiştiği, saati ve klasörü. "Tümünü göster" ile geçmişin tamamı açılır.
- **Akış:** Her adım saatiyle, herkesin anlayacağı bir cümle olarak: dosya okuyorum, komut çalıştırıyorum, internette arıyorum, yardımcı başlatıyorum… En yeni olay en üstte. Biten adım ✓, hata veren ✗ alır; her adımın ne kadar sürdüğü yazar, 10 saniyeyi geçenler sarı ve 🐢 ile işaretlenir. Yardımcı ajanların işleri ↳ ile gösterilir.
  - **Akışı temizle** biten adımları siler.
  - **Yardımcıları gizle / göster** yardımcı ajan satırlarını gizler ya da geri getirir.

**Cevap altı özeti**

Her cevabın altına şöyle bir satır eklenir:

```
⏱ 23 sn · 🔢 4.1k yeni token (giriş 1.0k, çıkış 3.1k) + 528k önbellekten · 💵 $0.198 (API fiyatıyla) · 🛠 6 işlem
```

**"Sıra sende" bildirimi**

30 saniyeden uzun süren bir cevap bitince masaüstü bildirimi gelir.

## Maliyet nasıl hesaplanıyor

Maliyet, Anthropic'in açıkladığı birim fiyatlarla (1 milyon token başına) hesaplanır: giriş, çıkış, önbelleğe yazma ve önbellekten okuma ayrı ayrı fiyatlanır. Kullanılan model (Opus, Sonnet, Haiku, Fable) otomatik tanınır; yardımcı ajanların harcaması da o cevaba eklenir. Panelde karşılaştırma için Claude Code'un kendi oturum maliyeti de gösterilir.

- Claude'u abonelikle kullanıyorsan gösterilen tutar faturana yansımaz; aynı işin API'de ne tutacağını gösterir.
- Önbelleğe yazma 5 dakikalık önbellek fiyatıyla hesaplanır.
- Fiyatlar `hooks/register.tsx` içindeki `FIYATLAR` tablosundadır; Anthropic fiyatları değiştirirse orası güncellenmelidir.

Mod tamamen senin bilgisayarında çalışır ve modele hiçbir şey göndermez; kendisi token harcamaz.

## Kurulum

Bir terminal oturumunda, Claude Code isteminde:

```
/plugin install canli-rapor --marketplace TheKaBooMmm/canli-rapor
```

Kabuktan:

```bash
claude plugin install canli-rapor --marketplace TheKaBooMmm/canli-rapor
```

Masaüstü uygulamasında (`/plugin` orada çalışmaz): istem kutusunun yanındaki **+** düğmesine bas, **Plugins**'i seç, **Add marketplace** ile `TheKaBooMmm/canli-rapor` ekle, sonra **Add plugin**.

Kurulumdan sonra panel kendiliğinden açılır. Kapattıysan `/canli-rapor` yazarak yeniden açabilirsin.

## Geliştirme

```bash
claude plugin validate .
claude plugin test .
```

## Lisans

MIT
