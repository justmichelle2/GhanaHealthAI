import en from './locales/en.ts'
import tw from './locales/tw.ts'
import ee from './locales/ee.ts'
import gaa from './locales/gaa.ts'
import ha from './locales/ha.ts'

export const languages = ['en', 'tw', 'ee', 'gaa', 'ha'] as const
export type InterfaceLanguage = typeof languages[number]
export type TranslationKey = keyof typeof en
export type Translations = Partial<Record<TranslationKey, string>>
export const resources: Record<InterfaceLanguage, Translations> = { en, tw, ee, gaa, ha }

export function loadInterfaceLanguage(storage: Pick<Storage, 'getItem'>): InterfaceLanguage {
  const saved = storage.getItem('gha-interface-language')
  return languages.includes(saved as InterfaceLanguage) ? saved as InterfaceLanguage : 'en'
}

export function translate(language: string, key: TranslationKey): string {
  const selected = languages.includes(language as InterfaceLanguage) ? language as InterfaceLanguage : 'en'
  return resources[selected][key] || en[key]
}
