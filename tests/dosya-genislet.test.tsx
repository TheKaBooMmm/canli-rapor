import { expect, test } from 'claude-code/testing'

test('değişen dosyalar son 5 ile başlar, genişletilince hepsi görünür', async ($, on) => {
  on('command.register', () => ({ value: { command: 'canli-rapor' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('clock.now', () => ({ value: 1_700_000_000_000 }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (let i = 1; i <= 7; i++) {
    await $.tool.call({ tool: 'Write', file_path: `D:/AI/dosya${i}.md`, content: 'a' })
  }

  const ui = await $.ui.mount({
    plugin: 'canli-rapor',
    component: 'Pane',
    requestId: 'canli-rapor',
    surface: 'desktop',
    props: {
      title: 'Canlı Rapor',
      isFocused: false,
      bodyColumns: 80,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  })
  expect(await ui.find({ type: 'Text', text: /🆕 dosya7\.md/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🆕 dosya1\.md/ })).toBeUndefined()
  expect((await ui.find({ key: 'dosyalar' }))?.text).toContain('+2')

  await ui.press({ key: 'dosyalar' })
  expect(await ui.find({ type: 'Text', text: /🆕 dosya1\.md/ })).toBeDefined()
  expect((await ui.find({ key: 'dosyalar' }))?.text).toContain('Daralt')
  await ui.unmount()
})
