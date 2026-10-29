import { expect, test } from 'claude-code/testing'

test('onay penceresi açılınca panelde sarı uyarı çıkar', async ($, on) => {
  on('command.register', () => ({ value: { command: 'canli-rapor' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.notify', () => ({ value: { isSent: true, channel: 'test' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: 1_700_000_000_000 }))
  on('classic.PermissionRequest', () => ({}))

  let ui: Awaited<ReturnType<typeof $.ui.mount>> | undefined
  let uyari: string | undefined
  on('tool.call', async () => {
    await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: {} })
    ui = await $.ui.mount({
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
    uyari = (await ui.find({ type: 'Text', text: /Onayını bekliyorum/ }))?.text
    return { result: {} }
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'rm x', description: 'Dosyayı sil' })

  expect(uyari).toContain('Onayını bekliyorum')
  await ui?.unmount()
})
