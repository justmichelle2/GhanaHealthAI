import test from 'node:test'
import assert from 'node:assert/strict'
import { languages, loadInterfaceLanguage, resources, translate } from '../src/i18n/resources.ts'

test('all five locale resources load and have the same key set', () => {
  assert.deepEqual(languages, ['en', 'tw', 'ee', 'gaa', 'ha'])
  const englishKeys = Object.keys(resources.en).sort()
  for (const language of languages) assert.deepEqual(Object.keys(resources[language]).sort(), englishKeys)
})

test('language selection safely falls back to English for missing translations and unknown locales', () => {
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
