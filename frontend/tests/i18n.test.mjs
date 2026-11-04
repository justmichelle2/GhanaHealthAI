import test from 'node:test'
import assert from 'node:assert/strict'
import { languages, loadInterfaceLanguage, resources, translate } from '../src/i18n/resources.ts'

test('all five locale resources load with a complete English source catalog', () => {
  assert.deepEqual(languages, ['en', 'tw', 'ee', 'gaa', 'ha'])
  const englishKeys = Object.keys(resources.en).sort()
  assert.ok(englishKeys.length >= 150)
  for (const key of englishKeys) {
    assert.equal(typeof resources.en[key], 'string', key)
    assert.ok(resources.en[key].trim().length > 0, key)
  }
})

test('catalog covers the clinical and consent-critical interface keys', () => {
  for (const key of ['consentToStoreMessage', 'consentRequired', 'replyToPatient', 'internalOnly', 'errorCredentials', 'shareWarning']) {
    assert.ok(key in resources.en, key)
  }
  assert.match(resources.en.pendingCount, /\{count\}/)
  assert.match(resources.en.dashboardWelcome, /\{name\}/)
  assert.match(resources.en.deleteWarning, /\{title\}/)
})

test('sparse locale resources and unknown locales safely fall back to English', () => {
  for (const language of ['tw', 'ee', 'gaa', 'ha']) assert.deepEqual(Object.keys(resources[language]), [])
  assert.equal(translate('tw', 'shareWarning'), resources.en.shareWarning)
  assert.equal(translate('not-a-locale', 'signIn'), resources.en.signIn)
  assert.equal(translate('en', 'signIn'), 'Sign in')
})

test('interface language preference persists independently through its dedicated storage key', () => {
  const values = new Map([['gha-interface-language', 'gaa']])
  const storage = { getItem: (key) => values.get(key) ?? null }
  assert.equal(loadInterfaceLanguage(storage), 'gaa')
  values.set('gha-interface-language', 'invalid')
  assert.equal(loadInterfaceLanguage(storage), 'en')
})
