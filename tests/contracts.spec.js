import { expect, test } from '@playwright/test'
import {
  attachConsoleTracking,
  buildTestEventTitle,
  cleanupOwnedTestData,
  ensureAuthenticated,
  expectNoConsoleErrors,
  getAuthedClient,
  runId,
  createEventRecord
} from './helpers/workflow'

const CONTRACT_PREFIX = `PW_CONTRACT_${runId}`

async function getAuthedUser(client) {
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Testnutzer konnte nicht geladen werden.')
  return data.user
}

async function cleanupContracts(credentials, titles = [], options = {}) {
  const client = await getAuthedClient(credentials)
  const user = await getAuthedUser(client)
  const { data, error } = await client.from('contracts').select('id,title').eq('owner_id', user.id)
  if (error) throw error

  const matchingIds = (data || [])
    .filter(contract =>
      options.allOwned
        ? true
        : contract.title?.startsWith(CONTRACT_PREFIX) || titles.includes(contract.title)
    )
    .map(contract => contract.id)

  if (!matchingIds.length) return

  const { error: deleteError } = await client.from('contracts').delete().in('id', matchingIds)
  if (deleteError) throw deleteError
}

async function createContractRecord(credentials, payload) {
  const client = await getAuthedClient(credentials)
  const user = await getAuthedUser(client)

  const { data, error } = await client
    .from('contracts')
    .insert({
      owner_id: user.id,
      title: payload.title,
      event_id: payload.event_id || null,
      file_path: payload.file_path || null,
      status: payload.status || 'uploaded'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

test.describe.serial('MarketOS Contracts', () => {
  test('CONTRACTS: Ansicht lädt und zeigt Toolbar oder Empty State stabil', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Contracts-Smoke wird bewusst auf Desktop geprüft.')

    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)

    await page.goto('/app/contracts')

    await expect(page.getByRole('heading', { name: 'Dokumente' })).toBeVisible()
    await expect(page.getByTestId('contracts-search')).toBeVisible()
    await expect(page.getByTestId('contracts-event-filter')).toBeVisible()
    await expect(page.getByTestId('contracts-status-filter')).toBeVisible()
    await expect(page.getByTestId('contracts-sort-order')).toBeVisible()
    await expect(page.getByTestId('contracts-result-count')).toBeVisible()
    await expect(page.getByLabel('Referenz / Ablageort')).toBeVisible()
    await expect(
      page.getByText('Optional: interner Ablagehinweis oder sicherer HTTPS-Link. Kein Datei-Upload.')
    ).toBeVisible()

    await expectNoConsoleErrors(errors)
    await cleanupContracts(credentials)
  })

  test('CONTRACTS: Empty State, Suche, Filter und Reset funktionieren mit Testdaten', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Contracts-Flow wird bewusst auf Desktop geprüft.')

    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)
    const eventTitle = buildTestEventTitle('ContractsEvent')
    const uploadedTitle = `${CONTRACT_PREFIX}_Alpha`
    const signedTitle = `${CONTRACT_PREFIX}_Beta`
    let eventRecord = null

    try {
      await cleanupContracts(credentials, [uploadedTitle, signedTitle], { allOwned: true })
      await page.goto('/app/contracts')

      await expect(page.getByTestId('contracts-empty-state')).toBeVisible()
      await expect(page.getByText('Noch keine Dokumente angelegt.')).toBeVisible()

      const contractForm = page.locator('form').first()
      await contractForm.getByPlaceholder('Titel').fill(`${CONTRACT_PREFIX}_Unsicher`)
      await page.getByTestId('contract-reference-input').fill('javascript:alert(1)')
      await page.getByRole('button', { name: 'Ablegen' }).click()
      await expect(page.getByTestId('toast-message')).toContainText(
        /vollständigen http- oder https-link oder eine normale textreferenz/i
      )
      await expect(page.getByTestId('contracts-empty-state')).toBeVisible()
      await contractForm.getByPlaceholder('Titel').fill('')
      await page.getByTestId('contract-reference-input').fill('')

      eventRecord = await createEventRecord(credentials, {
        title: eventTitle
      })

      await createContractRecord(credentials, {
        title: uploadedTitle,
        event_id: eventRecord.id,
        file_path: 'Ablage Schrank A / Fach 2',
        status: 'uploaded'
      })

      await createContractRecord(credentials, {
        title: signedTitle,
        event_id: eventRecord.id,
        file_path: 'https://example.com/vertrag-beta.pdf',
        status: 'signed'
      })

      await page.reload()

      await expect(page.getByTestId('contract-item')).toHaveCount(2)
      await expect(page.getByTestId('contracts-result-count')).toContainText('2 Dokumente')
      await expect(page.getByTestId('contract-item').filter({ hasText: eventTitle })).toHaveCount(2)

      await page.getByTestId('contracts-search').fill(uploadedTitle)
      await expect(page.getByTestId('contract-item')).toHaveCount(1)
      const uploadedContractItem = page.getByTestId('contract-item').first()
      await expect(uploadedContractItem).toContainText(uploadedTitle)
      await expect(uploadedContractItem).toContainText('Ablage Schrank A / Fach 2')
      await expect(uploadedContractItem.getByRole('link', { name: 'Ablage Schrank A / Fach 2' })).toHaveCount(0)
      await expect(page.getByTestId('contracts-reset-filters')).toBeVisible()

      await page.getByTestId('contracts-event-filter').selectOption(eventRecord.id)
      await expect(page.getByTestId('contract-item')).toHaveCount(1)

      await page.getByTestId('contracts-status-filter').selectOption('signed')
      await expect(page.getByTestId('contracts-no-results')).toBeVisible()
      await expect(page.getByText('Keine Dokumente für dieses Event gefunden.')).toBeVisible()

      await page.getByTestId('contracts-empty-reset').click()
      await expect(page.getByTestId('contract-item')).toHaveCount(2)

      await page.getByTestId('contracts-event-filter').selectOption('without-event')
      await expect(page.getByTestId('contracts-no-results')).toBeVisible()

      await page.getByTestId('contracts-status-filter').selectOption('signed')
      await page.getByTestId('contracts-event-filter').selectOption(eventRecord.id)
      await page.getByTestId('contracts-search').fill('')
      await expect(page.getByTestId('contract-item')).toHaveCount(1)
      const signedContractItem = page.getByTestId('contract-item').first()
      await expect(signedContractItem).toContainText(signedTitle)
      await expect(
        signedContractItem.getByRole('link', { name: 'https://example.com/vertrag-beta.pdf' })
      ).toBeVisible()
      await expect(signedContractItem).toContainText('Unterzeichnet')

      await page.getByTestId('contracts-reset-filters').click()
      await expect(page.getByTestId('contract-item')).toHaveCount(2)
      await expect(page.getByTestId('contracts-event-filter')).toHaveValue('all')
      await expect(page.getByTestId('contracts-status-filter')).toHaveValue('all')
      await expect(page.getByTestId('contracts-search')).toHaveValue('')
      await expect(page.getByTestId('contracts-sort-order')).toHaveValue('newest')

      await page.getByTestId('contracts-event-filter').selectOption(eventRecord.id)
      await expect(page.getByTestId('contract-item').first().getByTestId('contract-open-event')).toBeVisible()
      await page.getByTestId('contract-item').first().getByTestId('contract-open-event').click()
      await expect(page.getByTestId('event-detail-view')).toBeVisible()
      await expect(page.getByTestId('event-detail-title')).toContainText(eventTitle)
    } finally {
      await cleanupContracts(credentials, [uploadedTitle, signedTitle])
      if (eventRecord) {
        await cleanupOwnedTestData(credentials, { eventTitles: [eventTitle] })
      }
    }

    await expectNoConsoleErrors(errors)
  })
})
