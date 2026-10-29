export type Durum = 'calisiyor' | 'onay' | 'bitti' | 'hata'

// Paneldeki bir satır: Claude'un yaptığı tek bir iş.
export type Olay = {
  id: string
  saat: string
  simge: string
  metin: string
  durum: Durum
  yardimci: boolean
  // Araç çağrıları için: aracın adı, başlangıç anı ve süresi.
  arac?: string
  basladi?: number
  sureMs?: number
}

// Bu oturumda oluşturulan ya da düzenlenen bir dosya.
export type Dosya = {
  yol: string
  islem: 'olusturdu' | 'duzenledi'
  sayi: number
  saat: string
}

// Bitmiş bir cevabın özeti.
export type Tur = {
  saat: string
  sureMs: number
  giris: number
  cikis: number
  onbellek: number
  islem: number
  // Anthropic'in birim fiyatlarıyla bu cevabın dolar karşılığı (yardımcılar dahil).
  usd?: number
  model?: string
}

// Şu an süren cevap.
export type Aktif = {
  turId: string
  basladi: number
  islem: number
} | null

declare module 'claude-code' {
  interface PluginState {
    'canli-rapor': {
      olaylar: Olay[]
      turlar: Tur[]
      aktif: Aktif
      simdi: number
      oturumUsd: number | null
      dosyalar: Dosya[]
      yardimciGizli: boolean
      dosyalarAcik: boolean
    }
  }
}
