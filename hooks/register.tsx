// Canlı Rapor: Claude'un o an ne yaptığını Türkçe, sade bir dille anlatan panel.
//
// turn.start: yeni bir cevap başladı; süre sayacı çalışmaya başlar.
// tool.call: her araç çağrısını "dosya okuyor", "komut çalıştırıyor" gibi bir
// satıra çevirir, bitince ✓ ya da ✗ ile işaretler.
// classic.PermissionRequest: bir araç onayını beklerken paneli sarıya çevirir
// ve bildirim gönderir.
// turn.complete: cevabın altına süre, token ve maliyet özetini yazar; uzun
// süren bir cevap bitince "sıra sende" bildirimi gönderir.
// ui.render (Pane): canlı akış, değişen dosyalar ve son cevapların özeti.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, TurnUsage } from 'claude-code'

import type { Aktif, Dosya, Olay, Tur } from '../types'

const PANEL = 'canli-rapor'
const BASLIK = 'Canlı Rapor'
const EN_FAZLA_OLAY = 300
// Bundan uzun süren bir adım vurgulanır.
const YAVAS_ADIM_MS = 10_000
// Bundan uzun süren bir cevap bitince bildirim gelir.
const BILDIRIM_MS = 30_000

const olaylar = atom({ plugin: 'canli-rapor', key: 'olaylar' } as const, [] as Olay[])
const turlar = atom({ plugin: 'canli-rapor', key: 'turlar' } as const, [] as Tur[])
const aktif = atom({ plugin: 'canli-rapor', key: 'aktif' } as const, null as Aktif)
const simdi = atom({ plugin: 'canli-rapor', key: 'simdi' } as const, 0)
const oturumUsd = atom({ plugin: 'canli-rapor', key: 'oturumUsd' } as const, null as number | null)
const dosyalar = atom({ plugin: 'canli-rapor', key: 'dosyalar' } as const, [] as Dosya[])
const yardimciGizli = atom({ plugin: 'canli-rapor', key: 'yardimciGizli' } as const, false)
const dosyalarAcik = atom({ plugin: 'canli-rapor', key: 'dosyalarAcik' } as const, false)

// Üstteki bölümlerde kaç satır gösterilir.
const SON_CEVAP = 5
const SON_DOSYA = 5

// Anthropic'in açıkladığı birim fiyatlar, 1 milyon token başına dolar.
// Önbelleğe yazma 5 dakikalık önbellek fiyatıdır (girişin 1,25 katı).
type Fiyat = { giris: number; cikis: number; yazma: number; okuma: number }
const FIYATLAR: [string, Fiyat][] = [
  ['fable-5-1', { giris: 10, cikis: 50, yazma: 12.5, okuma: 0.25 }],
  ['mythos-5-1', { giris: 10, cikis: 50, yazma: 12.5, okuma: 0.25 }],
  ['fable-5', { giris: 10, cikis: 50, yazma: 12.5, okuma: 1 }],
  ['mythos-5', { giris: 10, cikis: 50, yazma: 12.5, okuma: 1 }],
  ['opus-5-5', { giris: 4, cikis: 20, yazma: 5, okuma: 0.2 }],
  ['opus-5', { giris: 5, cikis: 25, yazma: 6.25, okuma: 0.5 }],
  ['opus-4', { giris: 5, cikis: 25, yazma: 6.25, okuma: 0.5 }],
  ['sonnet-5-5', { giris: 2, cikis: 10, yazma: 2.5, okuma: 0.2 }],
  ['sonnet-5', { giris: 2, cikis: 10, yazma: 2.5, okuma: 0.2 }],
  ['sonnet-4-6', { giris: 3, cikis: 15, yazma: 3.75, okuma: 0.3 }],
  ['haiku-5-5', { giris: 0.1, cikis: 0.5, yazma: 0.125, okuma: 0.01 }],
  ['haiku-4-5', { giris: 1, cikis: 5, yazma: 1.25, okuma: 0.1 }],
]

// Yardımcı ajanların maliyeti, ana cevap bitince ona eklenir.
let yardimciUsd = 0

// Sayaç her saniye paneli yeniler; cevap bitince durdurulur.
let sayac: { cancel: () => void } | undefined

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const sonuc = await next(e)
    await $.command.register({
      name: 'canli-rapor',
      description: 'Canlı Rapor panelini aç',
    })
    void $.ui.open({ id: PANEL, title: BASLIK })

    return sonuc
  })

  on('command.run', { command: 'canli-rapor' }, async $ => {
    await $.ui.open({ id: PANEL, title: BASLIK })

    return { text: 'Canlı Rapor paneli açıldı.' }
  })

  on('turn.start', async ($, e, next) => {
    const sonuc = await next(e)
    if (e.agentId !== undefined) {
      return sonuc
    }
    const an = await $.clock.now()
    await update($, aktif, () => ({ turId: e.turnId, basladi: an, islem: 0 }))
    await update($, simdi, () => an)
    await olayEkle($, {
      id: `tur-${e.turnId}`,
      simge: '💬',
      metin: mesajiAnlat(e.text),
      durum: 'bitti',
      yardimci: false,
    })
    sayac?.cancel()
    sayac = $.clock.every(1000, () => void saniyeGecti($))
    yardimciUsd = 0

    return sonuc
  })

  on('tool.call', async ($, e, next) => {
    const yardimci = e.agentId !== undefined
    const girdi = e as unknown as Record<string, unknown>
    const { simge, metin } = anlat(e.tool, girdi)
    const basladi = await $.clock.now()
    await olayEkle($, {
      id: e.tool_use_id,
      simge,
      metin,
      durum: 'calisiyor',
      yardimci,
      arac: e.tool,
      basladi,
    })
    if (!yardimci) {
      await update($, aktif, a => (a ? { ...a, islem: a.islem + 1 } : a))
    }
    const sonuc = await next(e)
    const hata = 'deny' in sonuc && typeof sonuc.deny === 'string' ? true : sonuc.isError === true
    const sureMs = (await $.clock.now()) - basladi
    await update($, olaylar, liste =>
      liste.map(o =>
        o.id === e.tool_use_id ? { ...o, durum: hata ? 'hata' : 'bitti', sureMs } : o,
      ),
    )
    if (!hata) {
      await dosyaKaydet($, e.tool, girdi)
    }

    return sonuc
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    // Onay penceresi açılıyor: bu aracın en son çalışan satırını işaretle.
    const liste = await read($, olaylar)
    const sira = [...liste]
      .reverse()
      .find(o => o.durum === 'calisiyor' && o.arac === e.tool_name)
    if (sira) {
      await update($, olaylar, l => l.map(o => (o.id === sira.id ? { ...o, durum: 'onay' } : o)))
    }
    void $.ui
      .notify(sira ? sira.metin : `${e.tool_name} için onayın gerekiyor`, {
        title: '⏸ Onayını bekliyorum',
      })
      .catch(() => undefined)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const sonuc = await next(e)
    if (e.agentId !== undefined) {
      yardimciUsd += maliyet(e.usage) ?? 0
      return sonuc
    }
    sayac?.cancel()
    sayac = undefined
    const onceki = await read($, aktif)
    await update($, aktif, () => null)

    const kullanim = e.usage
    const giris = kullanim ? kullanim.input_tokens : 0
    const cikis = kullanim ? kullanim.output_tokens : 0
    const onbellek = kullanim
      ? kullanim.cache_read_input_tokens + kullanim.cache_creation_input_tokens
      : 0
    const tur: Tur = {
      saat: saatYaz(await $.clock.now()),
      sureMs: e.durationMs,
      giris,
      cikis,
      onbellek,
      islem: onceki?.islem ?? 0,
    }
    const anaUsd = maliyet(kullanim)
    if (anaUsd !== null) {
      tur.usd = anaUsd + yardimciUsd
    }
    if (kullanim) {
      tur.model = kullanim.model
    }
    yardimciUsd = 0
    await update($, turlar, liste => [...liste, tur].slice(-50))
    await oturumMaliyetiniOku($)
    if (e.durationMs >= BILDIRIM_MS) {
      const ozet = e.reason === 'answer' ? 'Cevabım hazır' : 'Çalışmam yarıda kaldı'
      void $.ui
        .notify(`${ozet} · ${sureYaz(e.durationMs)} sürdü`, { title: '✅ Sıra sende' })
        .catch(() => undefined)
    }

    const bitis =
      e.reason === 'aborted' ? 'Durduruldu' : e.reason === 'error' ? 'Hatayla bitti' : 'Cevap hazır'
    await olayEkle($, {
      id: `son-${e.turnId}`,
      simge: e.reason === 'answer' ? '✅' : '⚠️',
      metin: `${bitis} · ${sureYaz(e.durationMs)} · ${tokenYaz(giris, cikis, onbellek)}${tur.usd !== undefined ? ` · ${dolarYaz(tur.usd)}` : ''}`,
      durum: e.reason === 'answer' ? 'bitti' : 'hata',
      yardimci: false,
    })

    if (e.reason !== 'answer') {
      return sonuc
    }
    const fiyat = tur.usd !== undefined ? ` · 💵 ${dolarYaz(tur.usd)} (API fiyatıyla)` : ''
    const satir = kullanim
      ? `⏱ ${sureYaz(e.durationMs)} · 🔢 ${sayiYaz(giris + cikis)} yeni token (giriş ${sayiYaz(giris)}, çıkış ${sayiYaz(cikis)}) + ${sayiYaz(onbellek)} önbellekten${fiyat} · 🛠 ${tur.islem} işlem`
      : `⏱ ${sureYaz(e.durationMs)} · 🛠 ${tur.islem} işlem`

    return { ...sonuc, text: satir }
  })

  on('ui.render', { component: 'Pane', requestId: PANEL }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const gizli = await read($, yardimciGizli)
    const hepsi = await read($, olaylar)
    const liste = gizli ? hepsi.filter(o => !o.yardimci) : hepsi
    const degisen = await read($, dosyalar)
    const onayda = hepsi.filter(o => o.durum === 'onay')
    const gecmis = await read($, turlar)
    const su = await read($, aktif)
    const an = await read($, simdi)
    const dosyaAcik = await read($, dosyalarAcik)
    // Akış en altta: üstteki bölümler kadar yer ayrılır, kalanı akışın.
    const yer = Math.max(10, (e.viewport?.rows ?? 40) - 20)
    const calisan = [...hepsi].reverse().find(o => o.durum === 'calisiyor')

    const toplamYeni = gecmis.reduce((t, x) => t + x.giris + x.cikis, 0)
    const toplamOnbellek = gecmis.reduce((t, x) => t + x.onbellek, 0)
    const toplamSure = gecmis.reduce((t, x) => t + x.sureMs, 0)
    const toplamUsd = gecmis.reduce((t, x) => t + (x.usd ?? 0), 0)
    const ccUsd = await read($, oturumUsd)

    return (
      <Box flexDirection="column" gap={1}>
        {onayda.length > 0 && (
          <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
            <Text bold color="yellow">
              ⏸ Onayını bekliyorum
            </Text>
            {onayda.map(o => (
              <Text color="yellow">
                {o.simge} {o.metin}
              </Text>
            ))}
          </Box>
        )}

        <Box flexDirection="column">
          {su ? (
            <Text bold color="cyan">
              ● Çalışıyorum · {sureYaz(Math.max(0, an - su.basladi))} · {su.islem} işlem
            </Text>
          ) : (
            <Text bold color="green">
              ○ Bekliyorum · sıra sende
            </Text>
          )}
          {su && (
            <Text>
              {calisan ? `${calisan.simge} ${calisan.metin}` : '🧠 Düşünüyorum / cevabı yazıyorum'}
            </Text>
          )}
        </Box>

        <Box flexDirection="column">
          <Text bold>Son cevaplar</Text>
          {gecmis.length === 0 && <Text dimColor>Henüz tamamlanan cevap yok.</Text>}
          {gecmis.slice(-SON_CEVAP).reverse().map(t => (
            <Text dimColor>
              {t.saat} · {sureYaz(t.sureMs)} · {tokenYaz(t.giris, t.cikis, t.onbellek)} ·{' '}
              {t.usd !== undefined ? `${dolarYaz(t.usd)} · ` : ''}
              {t.islem} işlem
            </Text>
          ))}
          {gecmis.length > 0 && (
            <Text bold>
              Bu oturumda: {gecmis.length} cevap · {sureYaz(toplamSure)} ·{' '}
              {tokenYaz(toplamYeni, 0, toplamOnbellek)} · {dolarYaz(toplamUsd)}
            </Text>
          )}
          {ccUsd !== null && (
            <Text dimColor>Claude Code'un kendi hesabı (tüm oturum): {dolarYaz(ccUsd)}</Text>
          )}
          <Text dimColor>API fiyatıyla; abonelikle kullanıyorsan faturana yansımaz.</Text>
        </Box>

        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text bold>Değişen dosyalar{degisen.length > 0 ? ` (${degisen.length})` : ''}</Text>
            {degisen.length > SON_DOSYA && (
              <Button
                key="dosyalar"
                label={dosyaAcik ? 'Daralt' : `Tümünü göster (+${degisen.length - SON_DOSYA})`}
                variant="secondary"
                onPress={() => update($, dosyalarAcik, a => !a)}
              />
            )}
          </Box>
          {degisen.length === 0 && <Text dimColor>Bu oturumda hiçbir dosyaya dokunmadım.</Text>}
          {(dosyaAcik ? [...degisen] : degisen.slice(-SON_DOSYA)).reverse().map(d => (
            <Text>
              {d.islem === 'olusturdu' ? '🆕' : '✏️'} {dosyaAdi(d.yol)}
              <Text dimColor>
                {' '}
                · {d.islem === 'olusturdu' ? 'oluşturuldu' : 'düzenlendi'}
                {d.sayi > 1 ? ` (${d.sayi} kez)` : ''} · {d.saat} · {klasor(d.yol)}
              </Text>
            </Text>
          ))}
        </Box>

        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text bold>Akış</Text>
            <Button
              key="temizle"
              label="Akışı temizle"
              variant="secondary"
              onPress={() =>
                update($, olaylar, l => l.filter(o => o.durum === 'calisiyor' || o.durum === 'onay'))
              }
            />
            <Button
              key="yardimci"
              label={gizli ? 'Yardımcıları göster' : 'Yardımcıları gizle'}
              variant="secondary"
              onPress={() => update($, yardimciGizli, g => !g)}
            />
          </Box>
          {liste.length === 0 && <Text dimColor>Akış boş.</Text>}
          {liste.slice(-yer).reverse().map(o => {
            const yavas = (o.sureMs ?? 0) >= YAVAS_ADIM_MS
            return (
              <Text
                dimColor={o.durum === 'bitti' && !yavas}
                color={
                  o.durum === 'hata' ? 'red' : o.durum === 'onay' || yavas ? 'yellow' : undefined
                }
              >
                {o.saat} {isaret(o.durum)} {o.yardimci ? '↳ ' : ''}
                {o.simge} {o.metin}
                {o.sureMs !== undefined ? ` · ${adimSuresi(o.sureMs)}${yavas ? ' 🐢' : ''}` : ''}
              </Text>
            )
          })}
        </Box>
      </Box>
    )
  })
}

// Bir cevabın kullanımını Anthropic'in birim fiyatlarıyla dolara çevirir.
function maliyet(kullanim: TurnUsage | undefined): number | null {
  if (!kullanim) return null
  const fiyat = FIYATLAR.find(([ad]) => kullanim.model.includes(ad))?.[1]
  if (!fiyat) return null
  const milyon = 1_000_000
  return (
    (kullanim.input_tokens * fiyat.giris +
      kullanim.output_tokens * fiyat.cikis +
      kullanim.cache_creation_input_tokens * fiyat.yazma +
      kullanim.cache_read_input_tokens * fiyat.okuma) /
    milyon
  )
}

async function oturumMaliyetiniOku($: EngineInterface) {
  try {
    const { cost } = await $.session.usage()
    if (cost) {
      await update($, oturumUsd, () => cost.usd)
    }
  } catch {
    // Maliyet okunamadıysa panel kendi hesabını gösterir.
  }
}

async function olayEkle($: EngineInterface, olay: Omit<Olay, 'saat'>) {
  const saat = saatYaz(await $.clock.now())
  await update($, olaylar, liste => [...liste, { ...olay, saat }].slice(-EN_FAZLA_OLAY))
}

async function saniyeGecti($: EngineInterface) {
  const an = await $.clock.now()
  await update($, simdi, () => an)
}

// Araç çağrısını herkesin anlayacağı bir cümleye çevirir.
function anlat(arac: string, g: Record<string, unknown>): { simge: string; metin: string } {
  const yazi = (k: string) => (typeof g[k] === 'string' ? (g[k] as string) : '')
  const dosya = (k: string) => dosyaAdi(yazi(k))

  switch (arac) {
    case 'Read':
      return { simge: '📖', metin: `Dosya okuyorum: ${dosya('file_path')}` }
    case 'Write':
      return { simge: '📝', metin: `Dosya yazıyorum: ${dosya('file_path')}` }
    case 'Edit':
      return { simge: '✏️', metin: `Dosyada değişiklik yapıyorum: ${dosya('file_path')}` }
    case 'NotebookEdit':
      return { simge: '✏️', metin: `Not defterini düzenliyorum: ${dosya('notebook_path')}` }
    case 'Bash':
    case 'PowerShell':
      return {
        simge: '⚙️',
        metin: yazi('description')
          ? `Komut çalıştırıyorum: ${yazi('description')}`
          : `Komut çalıştırıyorum: ${kisalt(yazi('command'), 60)}`,
      }
    case 'Grep':
      return { simge: '🔍', metin: `Dosyaların içinde arıyorum: "${kisalt(yazi('pattern'), 40)}"` }
    case 'Glob':
      return { simge: '🗂️', metin: `Dosya arıyorum: ${kisalt(yazi('pattern'), 40)}` }
    case 'WebSearch':
      return { simge: '🌐', metin: `İnternette arıyorum: "${kisalt(yazi('query'), 50)}"` }
    case 'WebFetch':
      return { simge: '🌐', metin: `Web sayfası okuyorum: ${kisalt(yazi('url'), 50)}` }
    case 'Agent':
    case 'Task':
      return { simge: '🤖', metin: `Yardımcı başlatıyorum: ${kisalt(yazi('description'), 50)}` }
    case 'Skill':
      return { simge: '📚', metin: `Rehber yüklüyorum: ${yazi('skill')}` }
    case 'ToolSearch':
      return { simge: '🧰', metin: 'Yeni bir araç hazırlıyorum' }
    case 'SendMessage':
      return { simge: '✉️', metin: 'Bir karaktere/yardımcıya mesaj gönderiyorum' }
    case 'AskUserQuestion':
      return { simge: '❓', metin: 'Sana bir soru soruyorum' }
    case 'Artifact':
      return { simge: '🖼️', metin: 'Sayfa (artifact) hazırlıyorum' }
  }

  if (arac.endsWith('update_plan')) {
    return { simge: '📋', metin: 'Görev listesini güncelliyorum' }
  }
  if (arac.endsWith('wrap_up')) {
    return { simge: '🧾', metin: 'Yaptıklarımın özetini hazırlıyorum' }
  }
  if (arac.includes('Browser') || arac.includes('chrome')) {
    return { simge: '🧭', metin: `Tarayıcıda çalışıyorum (${arac.split('__').pop()})` }
  }
  if (arac.startsWith('mcp__')) {
    return { simge: '🔌', metin: `Bağlı bir araç kullanıyorum: ${arac.split('__').pop()}` }
  }

  return { simge: '🔧', metin: `${arac} aracını kullanıyorum` }
}

// Gelen mesajın ne olduğunu söyler; sistem bildirimlerini ayırır.
function mesajiAnlat(metin: string): string {
  const tek = metin.trim()
  if (!tek) return 'Çalışmaya devam ediyorum'
  if (tek.startsWith('<task-notification>') || tek.startsWith('<system-reminder>')) {
    return '🔔 Uygulamadan bir bildirim geldi'
  }
  if (tek.startsWith('<side-sessions-event>')) return '🔔 Başka bir oturumdan haber geldi'
  return `Yeni mesajını aldım: "${kisalt(tek, 60)}"`
}

// Yeni işlenen tokenları ve önbellekten tekrar okunanları ayrı gösterir.
function tokenYaz(giris: number, cikis: number, onbellek: number): string {
  return `${sayiYaz(giris + cikis)} yeni + ${sayiYaz(onbellek)} önbellek token`
}

function isaret(durum: Olay['durum']): string {
  if (durum === 'calisiyor') return '…'
  if (durum === 'onay') return '⏸'
  return durum === 'hata' ? '✗' : '✓'
}

// Write/Edit gibi dosya değiştiren araçları "Değişen dosyalar" listesine işler.
async function dosyaKaydet($: EngineInterface, arac: string, g: Record<string, unknown>) {
  const yol =
    arac === 'Write' || arac === 'Edit'
      ? g.file_path
      : arac === 'NotebookEdit'
        ? g.notebook_path
        : undefined
  if (typeof yol !== 'string' || !yol) return
  const saat = saatYaz(await $.clock.now())
  const anahtar = yolAnahtari(yol)
  await update($, dosyalar, liste => {
    const eski = liste.find(d => yolAnahtari(d.yol) === anahtar)
    if (eski) {
      return [...liste.filter(d => d !== eski), { ...eski, sayi: eski.sayi + 1, saat }]
    }
    const islem: Dosya['islem'] = arac === 'Write' ? 'olusturdu' : 'duzenledi'
    return [...liste, { yol, islem, sayi: 1, saat }].slice(-100)
  })
}

function yolAnahtari(yol: string): string {
  return yol.replace(/\\/g, '/').toLowerCase()
}

function klasor(yol: string): string {
  const parcalar = yol.split(/[\\/]/).filter(Boolean)
  return parcalar.slice(-3, -1).join('/') || yol
}

function adimSuresi(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} sn`
  return sureYaz(ms)
}

function dosyaAdi(yol: string): string {
  return yol.split(/[\\/]/).filter(Boolean).pop() ?? yol
}

function kisalt(metin: string, uzunluk: number): string {
  const tek = metin.replace(/\s+/g, ' ').trim()
  return tek.length > uzunluk ? `${tek.slice(0, uzunluk - 1)}…` : tek
}

function saatYaz(ms: number): string {
  const d = new Date(ms)
  const iki = (n: number) => String(n).padStart(2, '0')
  return `${iki(d.getHours())}:${iki(d.getMinutes())}:${iki(d.getSeconds())}`
}

function sureYaz(ms: number): string {
  const sn = Math.round(ms / 1000)
  if (sn < 60) return `${sn} sn`
  const dk = Math.floor(sn / 60)
  if (dk < 60) return `${dk} dk ${sn % 60} sn`
  return `${Math.floor(dk / 60)} sa ${dk % 60} dk`
}

function dolarYaz(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(usd < 1 ? 3 : 2)}`
}

function sayiYaz(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
