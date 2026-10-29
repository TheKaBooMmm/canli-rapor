import { expect, test } from 'claude-code/testing'

const PANEL = {
  plugin: 'canli-rapor',
  component: 'Pane',
  requestId: 'canli-rapor',
  props: {
    title: 'Canlı Rapor',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('değişen dosyalar listelenir, yardımcılar gizlenir', async ($, on) => {
  on('command.register', () => ({ value: { command: 'canli-rapor' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('clock.now', () => ({ value: 1_700_000_000_000 }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Write', file_path: 'D:/AI/notlar.md', content: 'a' })
  await $.tool.call({
    tool: 'Edit',
    file_path: 'D:/AI/notlar.md',
    old_string: 'a',
    new_string: 'b',
  })
  await $.tool.call({ tool: 'Edit', file_path: 'D:/AI/kod/app.ts', old_string: 'x', new_string: 'y' })

  const ui = await $.ui.mount({ ...PANEL, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /🆕 notlar\.md/ }))?.text).toContain('2 kez')
  expect(await ui.find({ type: 'Text', text: /✏️ app\.ts/ })).toBeDefined()
  expect(await ui.find({ key: 'yardimci' })).toBeDefined()

  await ui.press({ key: 'temizle' })
  expect(await ui.find({ type: 'Text', text: /Akış boş/ })).toBeDefined()
  // Temizlemek dosya listesini silmez.
  expect(await ui.find({ type: 'Text', text: /✏️ app\.ts/ })).toBeDefined()

  await ui.press({ key: 'yardimci' })
  expect((await ui.find({ key: 'yardimci' }))?.text).toContain('göster')
  await ui.unmount()
})
