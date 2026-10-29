import { expect, test } from 'claude-code/testing'

const PANEL = {
  plugin: 'canli-rapor',
  component: 'Pane',
  requestId: 'canli-rapor',
  props: {
    title: 'Canlı Rapor',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('araç çağrısı panelde Türkçe anlatılır', async ($, on) => {
  on('command.register', () => ({ value: { command: 'canli-rapor' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('clock.now', () => ({ value: 1_700_000_000_000 }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Read', file_path: 'C:/oyun/kayit/durum.md' })
  await $.tool.call({ tool: 'Bash', command: 'ls -la', description: 'Dosyaları listele' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANEL, surface })
    expect((await ui.find({ type: 'Text', text: /Dosya okuyorum: durum\.md/ }))?.text).toContain('✓')
    expect(await ui.find({ type: 'Text', text: /Komut çalıştırıyorum: Dosyaları listele/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Bekliyorum/ })).toBeDefined()
    await ui.unmount()
  }
})
