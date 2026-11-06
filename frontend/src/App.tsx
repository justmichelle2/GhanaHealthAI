import { useEffect, useRef, useState, type FormEvent } from 'react'
import { loadInterfaceLanguage, translate, type InterfaceLanguage, type TranslationKey } from './i18n/resources'
import { Icon, type IconName } from './components/ui/Icon'
import { Alert } from './components/ui/Alert'
import { Button } from './components/ui/Button'

type User = { id: string; email: string; role: 'patient' | 'doctor' | 'admin'; is_active: boolean; created_at: string }
type Profile = { full_name: string | null; preferred_language: string | null; messages_consent_given_at: string | null }
type Conversation = { id: string; title: string; preferred_language: string; status: string; created_at: string; updated_at: string }
type ChatMessage = { id: string; sender_role: string; body: string; created_at: string }
type ConversationDetail = Conversation & { messages: ChatMessage[] }
type Review = Conversation & { message: string; reviewed_at: string | null; review_note: string | null }
type AdminUser = { id: string; email: string; role: string; is_active: boolean; created_at: string; display_name: string | null; is_verified: boolean | null; professional_details: string | null }
type AuditEntry = { id: string; action: string; resource_type: string; resource_id: string | null; created_at: string }
type Page = 'loading' | 'landing' | 'login' | 'register' | 'dashboard' | 'assistant' | 'history' | 'profile' | 'doctor' | 'admin' | 'unavailable'
  | 'forgot' | 'reset' | 'shared'
type Overview = { users: number; patients: number; doctors_pending_verification: number; submissions_pending_review: number }
type ThemeMode = 'system' | 'light' | 'dark'
type ShareLink = { id: string; created_at: string; expires_at: string; revoked_at: string | null; active: boolean }
type PublicConversation = { preferred_language: string; created_at: string; messages: { sender_role: string; body: string; created_at: string }[] }
type ApiErrorCode = 'network' | 'invalid' | 'duplicate' | 'unavailable' | 'quota' | 'providerAuth' | 'credentials' | 'generic'

const API = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'tw', label: 'Twi' }, { value: 'ee', label: 'Ewe' }, { value: 'gaa', label: 'Ga' }, { value: 'ha', label: 'Hausa' }]
const errorKeys: Record<ApiErrorCode, TranslationKey> = {
  network: 'networkUnavailable', invalid: 'invalidForm', duplicate: 'duplicateAccount',
  unavailable: 'serviceTemporarilyUnavailable', quota: 'aiProviderNeedsBalance', providerAuth: 'aiProviderAuthFailed', credentials: 'errorCredentials', generic: 'errorGeneric',
}

class ApiError extends Error {
  status: number
  code: ApiErrorCode
  constructor(status: number, code: ApiErrorCode) { super(code); this.status = status; this.code = code }
}

function conversationDateGroup(value: string): 'today' | 'yesterday' | 'previous' {
  const today = new Date()
  const date = new Date(value)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  if (startOfDate === startOfToday) return 'today'
  if (startOfDate === startOfToday - 86400000) return 'yesterday'
  return 'previous'
}

function csrfCookie() {
  const token = document.cookie.split('; ').find((cookie) => cookie.startsWith('gha_csrf='))
  return token ? decodeURIComponent(token.slice('gha_csrf='.length)) : ''
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  const csrf = csrfCookie()
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrf) headers.set('X-CSRF-Token', csrf)
  let response: Response
  try { response = await fetch(API + path, { ...options, method, headers, credentials: 'include' }) }
  catch { throw new ApiError(0, 'network') }
  const body = response.status === 204 ? null : await response.json().catch(() => null) as { detail?: string | { msg?: string }[] } | null
  if (!response.ok) {
    const detail = body?.detail
    const detailText = typeof detail === 'string' ? detail : ''
    let code: ApiErrorCode = 'generic'
    if (response.status === 422) code = 'invalid'
    else if (response.status === 409 && /already exists/i.test(detailText)) code = 'duplicate'
    else if (response.status === 503 && /AI provider has no available balance/i.test(detailText)) code = 'quota'
    else if (response.status === 503 && /AI provider authentication failed/i.test(detailText)) code = 'providerAuth'
    else if (response.status === 503 || response.status >= 500) code = 'unavailable'
    else if (response.status === 401) code = 'credentials'
    throw new ApiError(response.status, code)
  }
  return body as T
}

function App() {
  const [page, setPage] = useState<Page>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile>({ full_name: null, preferred_language: 'en', messages_consent_given_at: null })
  const [submissions, setSubmissions] = useState<Conversation[]>([])
  const [chatResults, setChatResults] = useState<Conversation[]>([])
  const [pending, setPending] = useState<Review[]>([])
  const [completed, setCompleted] = useState<Review[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [registrationAcknowledged, setRegistrationAcknowledged] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [language, setLanguage] = useState('en')
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>(() => loadInterfaceLanguage(localStorage))
  const [resetEmail, setResetEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [conversationDialog, setConversationDialog] = useState<{ kind: 'rename' | 'delete'; conversation: Conversation; title: string } | null>(null)
  const [shareExpiry, setShareExpiry] = useState<1 | 24 | 168>(24)
  const [shareConfirmed, setShareConfirmed] = useState(false)
  const [shareToken, setShareToken] = useState('')
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [publicConversation, setPublicConversation] = useState<PublicConversation | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [reviewing, setReviewing] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [replies, setReplies] = useState<Record<string, string>>({})
  const [messageDraft, setMessageDraft] = useState('')
  const [aiConsentChecked, setAiConsentChecked] = useState(false)
  const [storeConsent, setStoreConsent] = useState(false)
  const [consentModalOpen, setConsentModalOpen] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [chatSearchExpanded, setChatSearchExpanded] = useState(false)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [selectedChat, setSelectedChat] = useState<ConversationDetail | null>(null)
  const [chatSearch, setChatSearch] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('gha-sidebar-collapsed') === 'true')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('gha-theme')
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })
  const chatBodyRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const aiConsentRef = useRef<HTMLInputElement>(null)
  const conversationDialogOpener = useRef<HTMLButtonElement | null>(null)
  const conversationDialogRef = useRef<HTMLElement>(null)
  const shareDialogOpener = useRef<HTMLElement | null>(null)
  const shareDialogRef = useRef<HTMLElement>(null)
  const consentDialogOpener = useRef<HTMLElement | null>(null)
  const consentDialogRef = useRef<HTMLElement>(null)
  const consentFocusGuard = useRef(false)
  const bootHashRef = useRef(window.location.hash)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)

  useEffect(() => {
    if (selectedChat && chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
  }, [selectedChat])

  useEffect(() => {
    const input = composerRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 184)}px`
    input.style.overflowY = input.scrollHeight > 184 ? 'auto' : 'hidden'
  }, [messageDraft])

  useEffect(() => {
    if (!conversationDialog) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConversationDialog(null)
        conversationDialogOpener.current?.focus()
      }
      if (event.key === 'Tab' && conversationDialogRef.current) {
        const controls = [...conversationDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')]
        if (controls.length < 2) return
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [conversationDialog])

  useEffect(() => {
    if (!shareDialogOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShareDialogOpen(false); setShareToken(''); setShareConfirmed(false)
        window.setTimeout(() => shareDialogOpener.current?.focus(), 0)
      }
      if (event.key === 'Tab' && shareDialogRef.current) {
        const controls = [...shareDialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')]
        if (controls.length < 2) return
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shareDialogOpen])

  useEffect(() => {
    if (!consentModalOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeConsentModal(); return }
      if (event.key === 'Tab' && consentDialogRef.current) {
        const controls = [...consentDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')]
        if (controls.length < 2) return
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    const container = consentDialogRef.current
    if (container) {
      const firstFocusable = container.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled])')
      firstFocusable?.focus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [consentModalOpen])

  useEffect(() => {
    localStorage.setItem('gha-theme', themeMode)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const resolved = themeMode === 'system' ? (media.matches ? 'dark' : 'light') : themeMode
      document.documentElement.dataset.theme = resolved
      document.documentElement.dataset.themeMode = themeMode
    }
    applyTheme()
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [themeMode])

  useEffect(() => { localStorage.setItem('gha-sidebar-collapsed', String(sidebarCollapsed)) }, [sidebarCollapsed])

  useEffect(() => {
    if (!chatDrawerOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setChatDrawerOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [chatDrawerOpen])

  useEffect(() => {
    localStorage.setItem('gha-interface-language', interfaceLanguage)
    document.documentElement.lang = interfaceLanguage
  }, [interfaceLanguage])

  useEffect(() => {
    if (page !== 'shared') return
    document.title = 'Shared conversation · Ghana Health Assistant'
    let robots = document.querySelector('meta[name="robots"]')
    if (!robots) { robots = document.createElement('meta'); robots.setAttribute('name', 'robots'); document.head.appendChild(robots) }
    robots.setAttribute('content', 'noindex,nofollow,noarchive')
    return () => { document.title = 'Ghana Health Assistant' }
  }, [page])

  const t = (key: TranslationKey) => translate(interfaceLanguage, key)

  function describeError(reason: unknown, fallback: TranslationKey) {
    if (reason instanceof ApiError) return t(errorKeys[reason.code])
    if (reason instanceof Error && reason.message) return reason.message
    return t(fallback)
  }

  function closeShareDialog() {
    setShareDialogOpen(false); setShareToken(''); setShareConfirmed(false)
    window.setTimeout(() => shareDialogOpener.current?.focus(), 0)
  }

  async function loadWorkspace(account: User) {
    setUser(account); setError('')
    if (account.role === 'doctor') {
      const [queue, done] = await Promise.all([
        request<Review[]>('/doctor/conversations?status=pending_review'),
        request<Review[]>('/doctor/conversations?status=reviewed'),
      ])
      setPending(queue); setCompleted(done); setPage('doctor'); return
    }
    if (account.role === 'admin') {
      const [stats, users, logs] = await Promise.all([
        request<Overview>('/admin/overview'), request<AdminUser[]>('/admin/users'), request<AuditEntry[]>('/admin/audit-logs'),
      ])
      setOverview(stats); setAdminUsers(users); setAudit(logs); setPage('admin'); return
    }
    setSelectedChat(null); setChatSearch('')
    const [saved, history] = await Promise.all([
      request<Profile>('/patient/profile'), request<Conversation[]>('/patient/conversations'),
    ])
    setProfile(saved); setFullName(saved.full_name || ''); setLanguage(saved.preferred_language || 'en'); setStoreConsent(!!saved.messages_consent_given_at); setSubmissions(history); setChatResults(history); setPage('dashboard')
  }

  useEffect(() => {
    let active = true
    async function restore() {
      const fragment = bootHashRef.current
      if (fragment.startsWith('#reset/')) {
        const token = fragment.slice('#reset/'.length)
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        if (active && token) { setResetToken(token); setPage('reset') }
        return
      }
      if (fragment.startsWith('#share/')) {
        const token = fragment.slice('#share/'.length)
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        setPage('shared')
        try {
          const conversation = await request<PublicConversation>('/patient/public/shares/resolve', { method: 'POST', body: JSON.stringify({ token }) })
          if (active) setPublicConversation(conversation)
        } catch {
          if (active) setError(t('unavailable'))
        }
        return
      }
      try {
        await request<void>('/auth/csrf')
        const account = await request<User>('/auth/me')
        if (active) await loadWorkspace(account)
      } catch (reason) {
        if (!active) return
        if (reason instanceof ApiError && reason.status === 401) setPage('landing')
        else { setError(describeError(reason, 'accountUnavailability')); setPage('unavailable') }
      }
    }
    void restore()
    return () => { active = false }
    // The boot restore intentionally runs once; language changes must not re-run session restoration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function beginAuth(mode: 'login' | 'register') {
    setAuthMode(mode); setRegistrationAcknowledged(false); setError(''); setSuccess(''); setPage(mode)
  }
  function navigate(next: Page) { setPage(next); setError(''); setSuccess(''); setChatDrawerOpen(false) }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess(''); setBusy(true)
    try {
      await request<void>('/auth/csrf')
      await request<{ message: string }>('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email: resetEmail.trim() }) })
      setSuccess(t('resetEmailSent'))
    } catch (reason) { setError(describeError(reason, 'unableRequestReset')) }
    finally { setBusy(false) }
  }

  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess('')
    if (resetPassword !== resetConfirmPassword) { setError(t('passwordMismatch')); return }
    setBusy(true)
    try {
      await request<{ message: string }>('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token: resetToken, password: resetPassword }) })
      setSuccess(t('passwordChanged')); setResetToken(''); setResetPassword(''); setResetConfirmPassword('')
    } catch (reason) { setError(describeError(reason, 'resetUnavailable')) }
    finally { setBusy(false) }
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess('')
    if (authMode === 'register' && !registrationAcknowledged) { setError(t('invalidForm')); return }
    if (authMode === 'register' && password !== confirmPassword) { setError(t('passwordMismatch')); return }
    setBusy(true)
    try {
      const route = authMode === 'register' ? '/auth/register' : '/auth/login'
      const body = authMode === 'register'
        ? { full_name: fullName.trim(), email: email.trim(), password, preferred_language: language }
        : { email: email.trim(), password }
      const account = await request<User>(route, { method: 'POST', body: JSON.stringify(body) })
      setPassword(''); setConfirmPassword(''); await loadWorkspace(account)
    } catch (reason) { setError(describeError(reason, 'unableSignIn')) }
    finally { setBusy(false) }
  }

  async function logout() {
    setBusy(true); setError('')
    try {
      await request<void>('/auth/logout', { method: 'POST' })
      setUser(null); setPassword(''); setConfirmPassword(''); setSuccess(''); setSelectedChat(null)
      await request<void>('/auth/csrf'); setPage('landing')
    } catch (reason) { setError(describeError(reason, 'unableSignOut')) }
    finally { setBusy(false) }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess(''); setBusy(true)
    try {
      const saved = await request<Profile>('/patient/profile', {
        method: 'PATCH', body: JSON.stringify({ full_name: fullName.trim(), preferred_language: language }),
      })
      setProfile(saved); setSuccess(t('profileUpdated'))
    } catch (reason) { setError(describeError(reason, 'unableSaveProfile')) }
    finally { setBusy(false) }
  }

  async function openChat(id: string) {
    setError(''); setSuccess(''); setChatBusy(true)
    try {
      setSelectedChat(await request<ConversationDetail>('/patient/conversations/' + id))
      setPage('assistant'); setChatDrawerOpen(false)
    } catch (reason) { setError(describeError(reason, 'unableOpenConversation')) }
    finally { setChatBusy(false) }
  }

  function newChat() { setSelectedChat(null); setMessageDraft(''); setPage('assistant'); setChatDrawerOpen(false); setError(''); setSuccess('') }

  async function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess('')
    if (!storeConsent) { openConsentModal(composerRef.current); return }
    if (!aiConsentChecked) {
      setError(t('aiConsentRequired'))
      aiConsentRef.current?.focus()
      return
    }
    const message = messageDraft.trim()
    if (!message) { setError(t('invalidForm')); return }
    setSendingRequest(true)
    try {
      const saved = selectedChat
        ? await request<ConversationDetail>('/patient/conversations/' + selectedChat.id + '/messages', { method: 'POST', body: JSON.stringify({ message, consent_to_store: true, consent_to_ai: true }) })
        : await request<ConversationDetail>('/patient/conversations', { method: 'POST', body: JSON.stringify({ message, preferred_language: language, consent_to_store: true, consent_to_ai: true }) }).then((item) => request<ConversationDetail>('/patient/conversations/' + item.id))
      setSelectedChat(saved)
      setSubmissions((items) => [saved, ...items.filter((item) => item.id !== saved.id)])
      setChatResults((items) => [saved, ...items.filter((item) => item.id !== saved.id)])
      setMessageDraft('')
      setAiConsentChecked(false)
      setSuccess(t('aiReplyReady'))
    } catch (reason) { setError(describeError(reason, 'unableSaveMessage')) }
    finally { setSendingRequest(false) }
  }

  function openConsentModal(opener: HTMLElement | null) {
    consentDialogOpener.current = (opener || document.activeElement) as HTMLElement | null
    setConsentChecked(false)
    setConsentModalOpen(true)
  }

  function closeConsentModal() {
    consentFocusGuard.current = true
    setConsentModalOpen(false)
    window.setTimeout(() => { consentDialogOpener.current?.focus(); consentFocusGuard.current = false }, 0)
  }

  async function acceptConsent() {
    if (!consentChecked) return
    if (!await updateMessageConsent(true)) return
    setConsentModalOpen(false)
    window.setTimeout(() => consentDialogOpener.current?.focus(), 0)
  }

  async function updateMessageConsent(consent: boolean): Promise<boolean> {
    setError(''); setSuccess(''); setBusy(true)
    try {
      const saved = await request<Profile>('/patient/profile/consent', { method: 'PATCH', body: JSON.stringify({ consent }) })
      setProfile(saved)
      setStoreConsent(!!saved.messages_consent_given_at)
      setSuccess(consent ? t('consentUpdated') : t('consentWithdrawn'))
      return true
    } catch (reason) { setError(describeError(reason, 'unableSaveConsent')); return false }
    finally { setBusy(false) }
  }

  async function searchChats(value: string) {
    setChatSearch(value)
    try { setChatResults(await request<Conversation[]>('/patient/conversations' + (value.trim() ? '?search=' + encodeURIComponent(value.trim()) : ''))) }
    catch (reason) { setError(describeError(reason, 'unableSearchConversations')) }
  }

  async function renameChat(item: Conversation, title: string) {
    if (!title.trim()) return
    try {
      const updated = await request<Conversation>('/patient/conversations/' + item.id, { method: 'PATCH', body: JSON.stringify({ title }) })
      setSubmissions((items) => items.map((entry) => entry.id === item.id ? updated : entry))
      setChatResults((items) => items.map((entry) => entry.id === item.id ? updated : entry))
      setSelectedChat((chat) => chat?.id === item.id ? { ...chat, title: updated.title } : chat)
      setConversationDialog(null)
    } catch (reason) { setError(describeError(reason, 'unableRenameConversation')) }
  }

  async function deleteChat(item: Conversation) {
    try {
      await request<void>('/patient/conversations/' + item.id, { method: 'DELETE' })
      setSubmissions((items) => items.filter((entry) => entry.id !== item.id))
      setChatResults((items) => items.filter((entry) => entry.id !== item.id))
      if (selectedChat?.id === item.id) setSelectedChat(null)
      setConversationDialog(null)
    } catch (reason) { setError(describeError(reason, 'unableDeleteConversation')) }
  }

  async function openShareDialog(chat: ConversationDetail | null) {
    if (!chat) { setError(t('openBeforeSharing')); return }
    shareDialogOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedChat(chat); setShareToken(''); setShareConfirmed(false); setShareDialogOpen(true)
    try { setShareLinks(await request<ShareLink[]>('/patient/conversations/' + chat.id + '/shares')) }
    catch (reason) { setError(describeError(reason, 'unableLoadShares')) }
  }

  async function shareChat(chat: ConversationDetail | null) {
    await openShareDialog(chat)
  }

  async function createShareLink() {
    if (!selectedChat || !shareConfirmed) return
    setBusy(true); setError('')
    try {
      const created = await request<{ id: string; token: string; expires_at: string }>('/patient/conversations/' + selectedChat.id + '/shares', {
        method: 'POST', body: JSON.stringify({ confirmed: true, expires_in_hours: shareExpiry }),
      })
      setShareToken(window.location.origin + window.location.pathname + '#share/' + created.token)
      setShareLinks(await request<ShareLink[]>('/patient/conversations/' + selectedChat.id + '/shares'))
    } catch (reason) { setError(describeError(reason, 'unableCreateShare')) }
    finally { setBusy(false) }
  }

  async function copyShareLink() {
    if (!shareToken) return
    try { await navigator.clipboard.writeText(shareToken); setSuccess(t('shareCopied')) }
    catch { setError(t('clipboardUnavailable')) }
  }

  async function revokeShareLink(shareId: string) {
    if (!selectedChat) return
    setBusy(true)
    try {
      await request<void>('/patient/conversations/' + selectedChat.id + '/shares/' + shareId, { method: 'DELETE' })
      setShareLinks(await request<ShareLink[]>('/patient/conversations/' + selectedChat.id + '/shares'))
      setSuccess(t('shareRevoked'))
    } catch (reason) { setError(describeError(reason, 'unableRevokeShare')) }
    finally { setBusy(false) }
  }

  async function shareSavedChat(item: Conversation) {
    try { await openShareDialog(await request<ConversationDetail>('/patient/conversations/' + item.id)) }
    catch (reason) { setError(describeError(reason, 'unableLoadShare')) }
  }

  async function reviewRequest(item: Review) {
    setError(''); setReviewing(item.id)
    const patientResponse = (replies[item.id] || '').trim()
    try {
      await request('/doctor/conversations/' + item.id + '/review', {
        method: 'PATCH', body: JSON.stringify({ review_note: notes[item.id] || '', patient_response: patientResponse }),
      })
      const [queue, done] = await Promise.all([
        request<Review[]>('/doctor/conversations?status=pending_review'),
        request<Review[]>('/doctor/conversations?status=reviewed'),
      ])
      setPending(queue); setCompleted(done)
      setNotes((previous) => ({ ...previous, [item.id]: '' }))
      setReplies((previous) => ({ ...previous, [item.id]: '' }))
      setSuccess(patientResponse ? t('reviewRecordedWithReply') : t('reviewRecordedNoReply'))
    } catch (reason) { setError(describeError(reason, 'unableSaveReview')) }
    finally { setReviewing('') }
  }

  async function reloadAdmin() {
    const [stats, users, logs] = await Promise.all([
      request<Overview>('/admin/overview'), request<AdminUser[]>('/admin/users'), request<AuditEntry[]>('/admin/audit-logs'),
    ])
    setOverview(stats); setAdminUsers(users); setAudit(logs)
  }
  async function verifyDoctor(id: string) {
    setError(''); setBusy(true)
    try { await request('/admin/doctors/' + id + '/verify', { method: 'POST' }); await reloadAdmin(); setSuccess(t('verifyClinician')) }
    catch (reason) { setError(describeError(reason, 'unableVerifyAccount')) }
    finally { setBusy(false) }
  }
  async function toggleUser(account: AdminUser) {
    setError(''); setBusy(true)
    try {
      await request('/admin/users/' + account.id + '/status', { method: 'PATCH', body: JSON.stringify({ is_active: !account.is_active }) })
      await reloadAdmin()
    } catch (reason) { setError(describeError(reason, 'unableUpdateAccount')) }
    finally { setBusy(false) }
  }
  async function retry() {
    setPage('loading'); setError('')
    try { await request<void>('/auth/csrf'); await loadWorkspace(await request<User>('/auth/me')) }
    catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) setPage('landing')
      else { setError(describeError(reason, 'accountUnavailability')); setPage('unavailable') }
    }
  }

  const languageName = (value: string) => LANGUAGES.find((item) => item.value === value)?.label || value.toUpperCase()
  const displayName = profile.full_name || user?.email.split('@')[0] || 'there'
  const userInitial = (displayName[0] || '?').toUpperCase()
  const roleName = user ? (user.role === 'patient' ? t('patient') : user.role === 'doctor' ? t('clinician') : t('adminRole')) : ''
  const patientNav: { key: 'dashboard' | 'assistant' | 'profile'; label: string; icon: IconName }[] = [
    { key: 'dashboard', label: t('overviewNav'), icon: 'home' },
    { key: 'assistant', label: t('healthAssistant'), icon: 'sparkle' },
    { key: 'profile', label: t('profileAndSettings'), icon: 'user' },
  ]
  const conversationGroups: { key: 'today' | 'yesterday' | 'previous'; label: string }[] = [
    { key: 'today', label: t('today') },
    { key: 'yesterday', label: t('yesterday') },
    { key: 'previous', label: t('previousDays') },
  ]

  return (
    <div className={user ? 'app-root authenticated' : 'app-root'}>
      <header className="topbar">
        {user && <button className="icon-button app-menu-button mobile-only" aria-expanded={chatDrawerOpen} onClick={() => setChatDrawerOpen(true)} aria-label={t('openNavigation')}><Icon name="menu" /></button>}
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); if (user) navigate(user.role === 'patient' ? 'dashboard' : user.role); else navigate('landing') }} aria-label={t('brandHome')}>
          <span className="brand-mark">+</span>
          <span className="brand-copy">
            <strong>Ghana Health</strong>
            <small className="brand-copy-sub">ASSISTANT</small>
          </span>
        </a>
        <div className="topbar-right">{!user && page === 'landing' && <nav className="public-nav" aria-label={t('mainNavigation')}>
          <a href="#about">{t('publicAbout')}</a>
          <a href="#how-it-works">{t('publicHow')}</a>
          <a href="#languages">{t('publicLanguages')}</a>
        </nav>}<label className="theme-control">
          <span className="sr-only">{t('colorTheme')}</span>
          <select aria-label={t('colorTheme')} value={themeMode} onChange={(event) => setThemeMode(event.target.value as ThemeMode)}>
            <option value="system">{t('systemTheme')}</option>
            <option value="light">{t('lightTheme')}</option>
            <option value="dark">{t('darkTheme')}</option>
          </select>
        </label>
        <label className="theme-control">
          <span className="sr-only">{t('languageLabel')}</span>
          <select aria-label={t('languageLabel')} value={interfaceLanguage} onChange={(event) => setInterfaceLanguage(event.target.value as InterfaceLanguage)}>{LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        </label>        {user ? <>
          <span className="session-badge"><i /> {t('secureSession')}</span>
          <button className="topbar-avatar-button" type="button" onClick={() => setAvatarMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={avatarMenuOpen} aria-label={`${displayName}, ${roleName}, ${t('openProfile')}`} title={`${displayName}, ${roleName}`}><span className="topbar-avatar">{userInitial}</span></button>
          <button className="button button-outline button-small sign-out-button" type="button" onClick={() => void logout()} disabled={busy}>{t('signOut')}</button>
          {avatarMenuOpen && <div className="avatar-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setAvatarMenuOpen(false); navigate('profile'); }}>{t('profileAndSettings')}</button>
            <button type="button" role="menuitem" onClick={() => setThemeMode((mode) => mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system')}>{t('colorTheme')}: {t(themeMode === 'system' ? 'systemTheme' : themeMode === 'light' ? 'lightTheme' : 'darkTheme')}</button>
            <button type="button" role="menuitem" onClick={() => setInterfaceLanguage((current) => {
              const index = LANGUAGES.findIndex((item) => item.value === current)
              return LANGUAGES[(index + 1) % LANGUAGES.length].value as InterfaceLanguage
            })}>{t('languageLabel')}: {LANGUAGES.find((item) => item.value === interfaceLanguage)?.label || interfaceLanguage}</button>
            <button type="button" role="menuitem" onClick={() => { setAvatarMenuOpen(false); void logout(); }}>{t('signOut')}</button>
          </div>}
        </> : !['login', 'register', 'forgot', 'reset', 'shared'].includes(page) && <>
          <button className="button button-quiet" type="button" onClick={() => beginAuth('login')}>{t('signIn')}</button>
          <button className="button button-primary button-small" type="button" onClick={() => beginAuth('register')}>{t('createAccount')}</button>
        </>}
        </div>
      </header>

      {page === 'loading' && <main className="center-state">
        <span className="spinner" />
        <p>{t('checkingSession')}</p>
      </main>}
      {page === 'unavailable' && <main className="center-state">
        <span className="state-icon">!</span>
        <p className="eyebrow">{t('serviceUnavailable')}</p>
        <h1>{t('unableLoadAccount')}</h1>
        <p>{error || t('serviceUnavailableBody')}</p>
        <button className="button button-primary" onClick={() => void retry()}>{t('tryAgain')}</button>
      </main>}

      {interfaceLanguage !== 'en' && <p className="translation-coverage" role="status">{t('translationCoverageNotice')}</p>}
      {page === 'landing' && !user && <main className="landing">
        <section className="landing-copy">
          <span className="eyebrow"><span className="eyebrow-mark" /> {t('heroEyebrow')}</span>
          <h1>{t('heroHeadline')}</h1>
          <p className="landing-lead">{t('heroLead')}</p>
          <div className="landing-actions">
            <button className="button button-primary button-large" onClick={() => beginAuth('register')}>{t('createPatientAccount')} <Icon name="chevron-right" size={18} /></button>
            <a className="button button-outline button-large" href="#how-it-works">{t('howItWorks')}</a>
          </div>
          <div className="language-strip" id="languages"><span>{t('languageStripLabel')}</span>{LANGUAGES.map((item) => <b key={item.value}>{item.label}</b>)}</div>
        </section>
        <aside className="landing-summary" id="about">
          <h2>{t('aboutHeading')}</h2>
          <ul>
            <li><span className="summary-icon"><Icon name="clock" size={18} /></span><div><strong>{t('languageChoiceTitle')}</strong><p>{t('languageChoiceBody')}</p></div></li>
            <li><span className="summary-icon"><Icon name="user" size={18} /></span><div><strong>{t('clinicianReviewTitle')}</strong><p>{t('clinicianReviewBody')}</p></div></li>
            <li><span className="summary-icon"><Icon name="info" size={18} /></span><div><strong>{t('healthInfoTitle')}</strong><p>{t('healthInfoBody')}</p></div></li>
          </ul>
        </aside>
        <section className="public-content-section" id="how-it-works">
          <h2>{t('howHeading')}</h2>
          <div className="how-grid">
            <article><h3>{t('howStepAccount')}</h3><p>{t('howStepAccountBody')}</p></article>
            <article><h3>{t('howStepMessage')}</h3><p>{t('howStepMessageBody')}</p></article>
            <article><h3>{t('howStepReview')}</h3><p>{t('howStepReviewBody')}</p></article>
          </div>
        </section>
        <section className="public-content-section public-privacy"><h2>{t('privacyHeading')}</h2><p>{t('privacyBody')}</p><p>{t('privacyCaution')}</p></section>
        <section className="public-content-section public-faq"><h2>{t('faqHeading')}</h2>
          <details><summary>{t('faqQuestionAnswers')}</summary><p>{t('faqAnswerAnswers')}</p></details>
          <details><summary>{t('faqQuestionEmergency')}</summary><p>{t('faqAnswerEmergency')}</p></details>
        </section>
        <section className="public-cta"><div><h2>{t('finalCtaHeading')}</h2><p>{t('finalCtaBody')}</p></div><button className="button button-primary button-large" onClick={() => beginAuth('register')}>{t('createPatientAccount')}</button></section>
        <div className="medical-notice"><span>i</span><p><strong>{t('healthInfoTitle')}.</strong> {t('healthServiceNotice')}</p></div>
      </main>}

      {(page === 'login' || page === 'register') && !user && <main className="auth-layout">
        <section className="auth-aside">
          <span className="eyebrow">GHANA HEALTH ASSISTANT</span>
          <h1>{authMode === 'login' ? t('welcomeBack') : t('authRegisterHeading')}</h1>
          <p>{authMode === 'login' ? t('authWelcomeBody') : t('authRegisterBody')}</p>
          <div className="auth-aside-note"><span>+</span><p>{t('patientOnlyNotice')}</p></div>
        </section>
        <section className="auth-panel">
          <button className="back-link" onClick={() => { setPage('landing'); setError('') }}><Icon name="chevron-left" size={16} /> {t('backHome')}</button>
          <span className="eyebrow">{authMode === 'login' ? t('patientSignIn') : t('patientRegistration')}</span>
          <h2>{authMode === 'login' ? t('signInHeading') : t('createAccountHeading')}</h2>
          <p className="panel-lead">{authMode === 'login' ? t('loginIntro') : t('registrationIntro')}</p>
          <form onSubmit={(event) => void handleAuth(event)} className="form-stack">
            {authMode === 'register' && <>
              <label htmlFor="full-name">{t('fullName')}</label>
              <input id="full-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={160} required placeholder={t('yourName')} />
              <label htmlFor="register-language">{t('preferredConversationLanguage')}</label>
              <select id="register-language" value={language} onChange={(event) => setLanguage(event.target.value)}>{LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <p className="field-hint">{t('conversationLanguageHint')}</p>
            </>}
            <label htmlFor="email">{t('emailAddress')}</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required placeholder={t('emailPlaceholder')} />
            <label htmlFor="password">{t('password')}</label>
            <div className="password-wrap">
              <input id="password" type={showPassword ? 'text' : 'password'} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={authMode === 'register' ? 12 : 1} maxLength={128} required placeholder={authMode === 'register' ? t('newPasswordPlaceholder') : t('passwordPlaceholder')} aria-describedby={authMode === 'register' ? 'password-guidance' : undefined} />
              <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? t('hidePassword') : t('showPassword')}>{showPassword ? t('hidePassword') : t('showPassword')}</button>
            </div>
            {authMode === 'register' && <>
              <label htmlFor="confirm-password">{t('confirmPassword')}</label>
              <div className="password-wrap">
                <input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} maxLength={128} required placeholder={t('confirmPasswordPlaceholder')} />
                <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? t('hidePassword') : t('showPassword')}>{showPassword ? t('hidePassword') : t('showPassword')}</button>
              </div>
              <p className="field-hint" id="password-guidance">{t('passwordStrengthGuidance')}</p>
              <details className="data-handling"><summary>{t('dataHandlingLink')}</summary><p>{t('accountDataNotice')}</p><p>{t('separateMessageConsent')}</p></details>
              <label className="consent-control registration-acknowledgement">
                <input type="checkbox" checked={registrationAcknowledged} onChange={(event) => setRegistrationAcknowledged(event.target.checked)} required />
                <span>{t('registrationReadAcknowledgement')}</span>
              </label>
            </>}
            {error && <Alert tone="error">{error}</Alert>}
            <button className="button button-primary button-full button-large" type="submit" disabled={busy || (authMode === 'register' && !registrationAcknowledged)}>{busy ? t('loading') : authMode === 'login' ? t('signInSecurely') : t('createPatientAccountSubmit')} {!busy && <Icon name="chevron-right" size={18} />}</button>
          </form>
          {authMode === 'login' && <button className="back-link" onClick={() => { setResetEmail(email); setError(''); setSuccess(''); setPage('forgot') }}>{t('forgotPassword')}</button>}
          <p className="auth-switch">{authMode === 'login' ? t('newToProject') : t('alreadyHaveAccount')} <button onClick={() => beginAuth(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? t('createAccount') : t('signIn')}</button></p>
          <div className="medical-notice compact"><span>i</span><p>{t('registrationPrivacyNote')}</p></div>
        </section>
      </main>}

      {page === 'forgot' && !user && <main className="auth-layout">
        <section className="auth-aside">
          <span className="eyebrow">GHANA HEALTH ASSISTANT</span>
          <h1>{t('recoverHeading')}</h1>
          <p>{t('recoverBody')}</p>
        </section>
        <section className="auth-panel">
          <button className="back-link" onClick={() => { setPage('login'); setError(''); setSuccess('') }}><Icon name="chevron-left" size={16} /> {t('backToSignIn')}</button>
          <h2>{t('forgotPassword')}</h2>
          <p className="panel-lead">{t('resetLinkIfAccount')}</p>
          <form className="form-stack" onSubmit={(event) => void requestPasswordReset(event)}>
            <label htmlFor="reset-email">{t('emailAddress')}</label>
            <input id="reset-email" type="email" autoComplete="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} required maxLength={320} />
            {error && <Alert tone="error">{error}</Alert>}{success && <Alert tone="success">{success}</Alert>}
            <button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? t('loading') : t('sendResetLink')}</button>
          </form>
        </section>
      </main>}

      {page === 'reset' && !user && <main className="auth-layout">
        <section className="auth-aside">
          <span className="eyebrow">GHANA HEALTH ASSISTANT</span>
          <h1>{t('chooseNewPassword')}</h1>
          <p>{t('passwordGuidance')}</p>
        </section>
        <section className="auth-panel">
          <h2>{t('resetPassword')}</h2>{success ? <>
            <Alert tone="success">{success}</Alert>
            <button className="button button-primary" onClick={() => { setPage('login'); setSuccess(''); setError('') }}>{t('signIn')}</button>
          </> : <form className="form-stack" onSubmit={(event) => void submitPasswordReset(event)}>
            <label htmlFor="new-password">{t('newPassword')}</label>
            <input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} required value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
            <label htmlFor="confirm-reset-password">{t('confirmPassword')}</label>
            <input id="confirm-reset-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} required value={resetConfirmPassword} onChange={(event) => setResetConfirmPassword(event.target.value)} />
            <button type="button" className="back-link" onClick={() => setShowPassword((value) => !value)}>{showPassword ? t('hidePasswords') : t('showPasswords')}</button>
            {error && <Alert tone="error">{error}</Alert>}
            <button className="button button-primary button-full" disabled={busy}>{busy ? t('loading') : t('resetPassword')}</button>
          </form>}</section>
      </main>}

      {page === 'shared' && <main className="shared-page">
        <section className="shared-card">
          <span className="eyebrow">{t('sharedViewEyebrow')}</span>
          <h1>{t('sharedConversation')}</h1>
          <p className="medical-notice compact">{t('sharedReadOnly')}</p>{error && <Alert tone="error">{error}</Alert>}{!publicConversation && !error && <p role="status">{t('loading')}</p>}{publicConversation && <>
            <p>{t('conversationLanguageLabel')}: {languageName(publicConversation.preferred_language)} · {new Date(publicConversation.created_at).toLocaleDateString()}</p>
            <div className="chat-messages">{publicConversation.messages.map((message, index) => <article key={`${message.created_at}-${index}`} className={message.sender_role === 'patient' ? 'chat-message patient-message' : message.sender_role === 'doctor' ? 'chat-message clinician-message' : 'chat-message assistant-message'}>
              <span>{message.sender_role === 'patient' ? t('patient') : message.sender_role === 'doctor' ? t('clinician') : t('healthAssistantRole')} · {new Date(message.created_at).toLocaleString()}</span>
              <p>{message.body}</p>
            </article>)}</div>
          </>}</section>
      </main>}

      {user && <div className={`workspace ${user.role === 'patient' ? 'chat-workspace' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${chatDrawerOpen ? 'sidebar-open' : ''}`}>
        {chatDrawerOpen && <button className="app-drawer-backdrop mobile-only" aria-label={t('closeNavigation')} onClick={() => setChatDrawerOpen(false)} />}
        <aside className="sidebar">
          <div className="sidebar-inner">
            {user.role === 'patient' && (
              <button className="button button-primary button-full chat-new-button" aria-label={t('newChat')} title={t('newChat')} onClick={newChat}><Icon name="plus" size={18} /> {t('newChat')}</button>
            )}
            {user.role === 'patient' && <nav className="side-nav" aria-label={t('patientNavigation')}>{patientNav.map((item) => <button key={item.key} className={page === item.key ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.key)} aria-current={page === item.key ? 'page' : undefined} aria-label={item.label}>
              <Icon name={item.icon} size={20} /><span className="nav-label">{item.label}</span>
            </button>)}</nav>}
            {user.role === 'doctor' && <nav className="side-nav" aria-label={t('clinicianNavigation')}>
              <button className="nav-item active" aria-current="page"><Icon name="clock" size={20} /><span className="nav-label">{t('reviewWorkspace')}</span></button>
            </nav>}
            {user.role === 'admin' && <nav className="side-nav" aria-label={t('administratorNavigation')}>
              <button className="nav-item active" aria-current="page"><Icon name="grid" size={20} /><span className="nav-label">{t('administration')}</span></button>
            </nav>}
            {user.role === 'patient' && page === 'assistant' && (
              <div className="chat-history-section">
                <div className="chat-history-list">{chatResults.length === 0 ? <div className="chat-empty">
                  <strong>{chatSearch ? t('noMatchingConversations') : t('noConversations')}</strong>
                  <p>{chatSearch ? t('tryDifferentTitle') : t('savedMessagesAppear')}</p>
                </div> : conversationGroups.map((group) => {
                  const groupItems = chatResults.filter((item) => conversationDateGroup(item.updated_at || item.created_at) === group.key)
                  return groupItems.length ? <div className="chat-history-group" key={group.key}>
                    <strong>{group.label}</strong>{groupItems.map((item) => <article className={selectedChat?.id === item.id ? 'chat-history-item selected' : 'chat-history-item'} key={item.id}>
                      <button onClick={() => void openChat(item.id)}>
                        <strong>{item.title || t('healthConversation')}</strong>
                        <small>{item.status === 'pending_review' ? t('pending') : t('reviewed')}</small>
                      </button>
                      <div>
                        <button className="icon-button" aria-label={`${t('rename')} ${item.title}`} onClick={(event) => { conversationDialogOpener.current = event.currentTarget; setConversationDialog({ kind: 'rename', conversation: item, title: item.title }) }}><Icon name="edit" size={16} /></button>
                        <button className="icon-button" aria-label={`${t('shareConversation')} ${item.title}`} onClick={() => void shareSavedChat(item)}><Icon name="share" size={16} /></button>
                        <button className="icon-button danger-icon" aria-label={`${t('delete')} ${item.title}`} onClick={(event) => { conversationDialogOpener.current = event.currentTarget; setConversationDialog({ kind: 'delete', conversation: item, title: item.title }) }}><Icon name="trash" size={16} /></button>
                      </div>
                    </article>)}</div> : null
                  })}</div>
                </div>
            )}
            <div className="sidebar-footer">
              <div className="privacy-mark">◇</div>
              <strong>{t('privacyMatters')}</strong>
              <p>{t('privacyMattersBody')}</p>
            </div>
            <button className="sidebar-collapse desktop-only" type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')} title={sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}>
              <Icon name={sidebarCollapsed ? 'chevron-right' : 'chevron-left'} size={18} /><span className="nav-label">{sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}</span>
            </button>
          </div>
        </aside>
        <main className="main-content">
          <div className="content-topline">
            <span>GHANA HEALTH ASSISTANT <b>/</b> {roleName.toUpperCase()}</span>
            <span className="connected-label"><i /> {t('connected')}</span>
          </div>
          {error && <Alert tone="error">{error}</Alert>}{success && <Alert tone="success">{success}</Alert>}
          {user.role === 'patient' && page === 'dashboard' && <section>
            <div className="page-heading">
              <div>
                <span className="eyebrow">{t('dashboardEyebrow')}</span>
                <h1>{t('dashboardWelcome').replace('{name}', displayName.split(' ')[0])}</h1>
                <p>{t('healthInformationWorkspace')}</p>
              </div>
              <button className="button button-primary" onClick={() => navigate('assistant')}>{t('openAssistant')} <Icon name="chevron-right" size={18} /></button>
            </div>
            <div className="status-banner">
              <div className="status-banner-icon"><Icon name="sparkle" size={20} /></div>
              <div><strong>{t('messagesAvailableReview')}</strong><p>{t('automatedUnavailableLong')}</p></div>
              <span className="status-tag">{t('humanReview')}</span>
            </div>
            <div className="stat-grid">
              <article className="stat-card"><span>{t('yourRequests')}</span><strong>{submissions.length}</strong><small>{t('savedToAccount')}</small></article>
              <article className="stat-card"><span>{t('pendingReview')}</span><strong>{submissions.filter((item) => item.status === 'pending_review').length}</strong><small>{t('awaitingClinician')}</small></article>
              <article className="stat-card"><span>{t('languagePreference')}</span><strong className="stat-language">{languageName(language)}</strong><small>{t('currentPreference')}</small></article>
            </div>
            <div className="section-heading"><div><span className="eyebrow">{t('yourSpace')}</span><h2>{t('getStarted')}</h2></div></div>
            <div className="action-grid">
              <button className="action-card" onClick={() => navigate('assistant')}><span className="action-icon"><Icon name="sparkle" size={20} /></span><strong>{t('healthAssistant')}</strong><p>{t('automatedUnavailableLong')}</p><span className="action-arrow"><Icon name="chevron-right" size={18} /></span></button>
              <button className="action-card" onClick={() => navigate('assistant')}><span className="action-icon"><Icon name="clock" size={20} /></span><strong>{t('chatHistory')}</strong><p>{t('chatHistoryDescription')}</p><span className="action-arrow"><Icon name="chevron-right" size={18} /></span></button>
              <button className="action-card" onClick={() => navigate('profile')}><span className="action-icon"><Icon name="user" size={20} /></span><strong>{t('profileAndSettings')}</strong><p>{t('profileDescription')}</p><span className="action-arrow"><Icon name="chevron-right" size={18} /></span></button>
            </div>
            <div className="medical-notice"><span>i</span><p><strong>{t('healthInfoTitle')}.</strong> {t('healthServiceNotice')}</p></div>
          </section>}

          {user.role === 'patient' && page === 'assistant' && <section className="chat-page">
            <div className="chat-layout" aria-busy={chatBusy}>
              <div className={`chat-card${chatSearchExpanded ? ' search-expanded' : ''}`}>
                <div className="chat-header">
                  <button className="icon-button mobile-only" onClick={() => setChatDrawerOpen(true)} aria-label={t('openHistory')}><Icon name="menu" size={18} /></button>
                  <div className="chat-header-text">
                    <strong>{selectedChat?.title || t('newConversation')}</strong>
                    <small><i /> {selectedChat ? (selectedChat.status === 'pending_review' ? t('awaitingReview') : t('reviewedByClinician')) : t('privateConversation')}</small>
                  </div>
                  <div className="chat-header-actions">
                    <label className="chat-language">
                      <span className="sr-only">{t('conversationLanguageLabel')}</span>
                      <select aria-label={t('conversationLanguageLabel')} value={language} onChange={(event) => setLanguage(event.target.value)}>{LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                    </label>
                    <div className="chat-header-search">
                      <button className="icon-button chat-search-toggle" type="button" onClick={() => setChatSearchExpanded((v) => !v)} aria-label={chatSearchExpanded ? t('hideSearch') : t('searchConversations')} aria-expanded={chatSearchExpanded} title={chatSearchExpanded ? t('hideSearch') : t('searchConversations')}>
                        {chatSearchExpanded ? <Icon name="close" size={18} /> : <Icon name="search" size={18} />}
                      </button>
                      <div className={`chat-header-search-field${chatSearchExpanded ? ' expanded' : ''}`}>
                        <Icon name="search" size={16} className="search-icon" />
                        <input type="search" aria-label={t('searchTitles')} value={chatSearch} onChange={(event) => void searchChats(event.target.value)} placeholder={t('searchTitles')} />
                        {chatSearch && <button className="icon-button chat-search-clear" type="button" onClick={() => void setChatSearch('')} aria-label={t('clearSearch')}>×</button>}
                      </div>
                    </div>
                    <button className="icon-button" onClick={() => void shareChat(selectedChat)} disabled={!selectedChat} aria-label={t('shareConversation')}><Icon name="share" size={18} /></button>
                  </div>
                </div>
                <div className="chat-mobile-toolbar-row">
                  <label className="chat-language chat-language-mobile">
                    <span className="sr-only">{t('conversationLanguageLabel')}</span>
                    <select aria-label={t('conversationLanguageLabel')} value={language} onChange={(event) => setLanguage(event.target.value)}>{LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                  </label>
                </div>
                {chatSearchExpanded && <div className="chat-mobile-search-row">
                  <div className="chat-header-search-field">
                    <Icon name="search" size={16} className="search-icon" />
                    <input type="search" aria-label={t('searchTitles')} value={chatSearch} onChange={(event) => void searchChats(event.target.value)} placeholder={t('searchTitles')} />
                    {chatSearch && <button className="icon-button chat-search-clear" type="button" onClick={() => void setChatSearch('')} aria-label={t('clearSearch')}>×</button>}
                  </div>
                </div>}
                <div className="chat-body" ref={chatBodyRef} aria-live="polite">{selectedChat?.messages.length ? <div className="chat-messages">{selectedChat.messages.map((message) => <article className={message.sender_role === 'patient' ? 'chat-message patient-message' : message.sender_role === 'doctor' ? 'chat-message clinician-message' : 'chat-message assistant-message'} key={message.id}>
                  <span>{message.sender_role === 'patient' ? t('you') : message.sender_role === 'doctor' ? t('clinician') : t('healthAssistantRole')} · {new Date(message.created_at).toLocaleString()}</span>
                  <p>{message.body}</p>
                </article>)}
                  <p className="chat-notice">{t('chatNotice')}</p>
                </div> : <div className="chat-empty-state">
                  <span className="chat-empty-icon"><Icon name="sparkle" size={24} /></span>
                  <h2>{t('askHealthQuestion')}</h2>
                  <p>{t('chatEmptyBody')}</p>
                </div>}</div>
                <form className="chat-composer" onSubmit={(event) => void sendChatMessage(event)}>
                  <label className="consent-control ai-consent-control"><input ref={aiConsentRef} type="checkbox" checked={aiConsentChecked} onChange={(event) => setAiConsentChecked(event.target.checked)} /><span>{t('consentToSendToAI')}</span></label>
                  <textarea ref={composerRef} rows={2} value={messageDraft} onChange={(event) => { setMessageDraft(event.target.value); setAiConsentChecked(false) }} onFocus={() => { if (!storeConsent && !consentFocusGuard.current) openConsentModal(composerRef.current) }} maxLength={4000} minLength={1} required aria-label={t('messagePlaceholder')} placeholder={t('messagePlaceholder')} />
                  <Button type="submit" disabled={sendingRequest || messageDraft.trim().length === 0} icon={<Icon name="send" size={18} />}><span className="send-text">{sendingRequest ? t('saving') : t('send')}</span></Button>
                </form>
              </div>
            </div>
          </section>}

          {user.role === 'patient' && page === 'profile' && <section>
            <div className="page-heading">
              <div><span className="eyebrow">{t('accountSettings')}</span><h1>{t('profileHeading')}</h1><p>{t('profileSubheading')}</p></div>
            </div>
            <div className="settings-grid">
              <form className="settings-card form-stack" onSubmit={(event) => void saveProfile(event)}>
                <h2>{t('personalPreferences')}</h2>
                <p className="panel-lead">{t('accountIsPatient')}</p>
                <label htmlFor="profile-name">{t('displayName')}</label>
                <input id="profile-name" value={fullName || profile.full_name || ''} onChange={(event) => setFullName(event.target.value)} maxLength={160} minLength={2} required />
                <label htmlFor="profile-language">{t('preferredLanguage')}</label>
                <select id="profile-language" value={language} onChange={(event) => setLanguage(event.target.value)}>{LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                <label>{t('emailAddress')}</label>
                <input value={user.email} disabled />
                <button className="button button-primary" disabled={busy}>{busy ? t('savingProfile') : t('saveChanges')}</button>
              </form>
              <aside className="settings-card privacy-card">
                <span className="privacy-mark">◇</span>
                <h2>{t('privacySafety')}</h2>
                <p>{t('privacySafetyBody')}</p>
                <p>{t('sessionPrivacy')}</p>
                <span className="pill pill-waiting">{t('clinicianOnly')}</span>
                <div className="message-consent-row">
                  <div><strong>Store my messages for clinician review</strong><p>Choose whether your messages may be stored for review by an authorized clinician.</p></div>
                  <button className="consent-switch" type="button" role="switch" aria-label="Store my messages for clinician review" aria-checked={!!profile.messages_consent_given_at} disabled={busy} onClick={() => { const next = !profile.messages_consent_given_at; if (next || window.confirm('You will be asked to consent again before your next message.')) void updateMessageConsent(next) }}><span /></button>
                </div>
                <label className="theme-setting" htmlFor="theme-setting">{t('colorTheme')}<select id="theme-setting" value={themeMode} onChange={(event) => setThemeMode(event.target.value as ThemeMode)}>
                  <option value="system">{t('system')}</option>
                  <option value="light">{t('light')}</option>
                  <option value="dark">{t('dark')}</option>
                </select></label>
              </aside>
            </div>
          </section>}

          {user.role === 'doctor' && page === 'doctor' && <section>
            <div className="page-heading">
              <div><span className="eyebrow">{t('verifiedClinician')}</span><h1>{t('doctorHeading')}</h1><p>{t('doctorSubheading')}</p></div>
              <span className="pill pill-waiting">{t('pendingCount').replace('{count}', String(pending.length))}</span>
            </div>
            <div className="section-heading"><div><span className="eyebrow">{t('needsReview')}</span><h2>{t('pendingRequests')}</h2></div></div>
            {pending.length === 0 ? <div className="table-card empty-state"><Icon name="check" size={24} /><strong>{t('queueClear')}</strong><p>{t('queueClearBody')}</p></div> :
              <div className="review-list">{pending.map((item) => <article className="review-card" key={item.id}>
                <div className="review-meta"><span className="pill pill-waiting">{t('pending')}</span><span>{languageName(item.preferred_language)} · {new Date(item.created_at).toLocaleString()}</span></div>
                <p className="review-message">{item.message}</p>
                <label htmlFor={'reply-' + item.id}>{t('replyToPatient')}</label>
                <textarea id={'reply-' + item.id} maxLength={4000} rows={3} value={replies[item.id] || ''} onChange={(event) => setReplies((previous) => ({ ...previous, [item.id]: event.target.value }))} placeholder={t('replyToPatientHint')} />
                <p className="field-hint">{t('replyToPatientHint')}</p>
                <label htmlFor={'note-' + item.id}>{t('clinicianNote')} <span>{t('internalOnly')}</span></label>
                <textarea id={'note-' + item.id} maxLength={2000} rows={3} value={notes[item.id] || ''} onChange={(event) => setNotes((previous) => ({ ...previous, [item.id]: event.target.value }))} placeholder={t('optionalInternalNote')} />
                <button className="button button-primary" onClick={() => void reviewRequest(item)} disabled={reviewing === item.id}>{reviewing === item.id ? t('savingReview') : t('markReviewed')}</button>
              </article>)}</div>}
            <div className="section-heading"><div><span className="eyebrow">{t('completed')}</span><h2>{t('completedReviews')}</h2></div></div>
            <div className="table-card">{completed.length === 0 ? <div className="empty-state"><strong>{t('noCompletedReviews')}</strong><p>{t('completedAppear')}</p></div> : completed.map((item) => <article className="request-row" key={item.id}>
              <span className="request-symbol"><Icon name="check" size={18} /></span>
              <div><strong>{item.message}</strong><small>{t('reviewedAt')} {item.reviewed_at ? new Date(item.reviewed_at).toLocaleString() : ''}</small>{item.review_note && <small>{t('internalNote')}: {item.review_note}</small>}</div>
              <span className="pill pill-done">{t('reviewed')}</span>
            </article>)}</div>
          </section>}

          {user.role === 'admin' && page === 'admin' && <section>
            <div className="page-heading">
              <div><span className="eyebrow">{t('administration')}</span><h1>{t('systemOverview')}</h1><p>{t('adminSubheading')}</p></div>
            </div>
            <div className="stat-grid">{[{ label: t('totalUsers'), value: overview?.users ?? 0 }, { label: t('patients'), value: overview?.patients ?? 0 }, { label: t('cliniciansToVerify'), value: overview?.doctors_pending_verification ?? 0 }, { label: t('requestsPendingReview'), value: overview?.submissions_pending_review ?? 0 }].map((stat) => <article className="stat-card" key={stat.label}>
              <span>{stat.label.toUpperCase()}</span><strong>{stat.value}</strong>
            </article>)}</div>
            <div className="section-heading"><div><span className="eyebrow">{t('accessControl')}</span><h2>{t('userManagement')}</h2></div></div>
            <div className="table-card">
              <div className="table-header"><div><strong>{t('accounts')}</strong><small>{t('publicRegistrationPatientOnly')}</small><small>{t('verifyCredentialsFirst')}</small></div></div>
              {adminUsers.length === 0 ? <div className="empty-state"><strong>{t('noAccountsFound')}</strong></div> : <div className="admin-user-list">{adminUsers.map((account) => <article className="admin-user-row" key={account.id}>
                <div><strong>{account.display_name || account.email}</strong><small>{account.email} · {account.role} · {new Date(account.created_at).toLocaleDateString()}</small>{account.professional_details && <small>{t('credentialDetails')}: {account.professional_details}</small>}</div>
                <div className="admin-user-actions">{account.role === 'doctor' && <span className={account.is_verified ? 'pill pill-done' : 'pill pill-waiting'}>{account.is_verified ? t('verified') : t('needsVerification')}</span>}{account.role === 'doctor' && !account.is_verified && <button className="button button-outline button-small" disabled={busy} onClick={() => void verifyDoctor(account.id)}>{t('verifyClinician')}</button>}<button className="button button-quiet button-small" disabled={busy} onClick={() => void toggleUser(account)}>{account.is_active ? t('deactivate') : t('activate')}</button></div>
              </article>)}</div>}
            </div>
            <div className="section-heading"><div><span className="eyebrow">{t('accountability')}</span><h2>{t('recentAudit')}</h2></div></div>
            <div className="table-card">{audit.length === 0 ? <div className="empty-state"><p>{t('noAuditEvents')}</p></div> : audit.map((entry) => <article className="request-row audit-row" key={entry.id}>
              <span className="request-symbol"><Icon name="clipboard" size={18} /></span>
              <div><strong>{entry.action.replace(/_/g, ' ')}</strong><small>{entry.resource_type}{entry.resource_id ? ' · ' + entry.resource_id : ''} · {new Date(entry.created_at).toLocaleString()}</small></div>
            </article>)}</div>
          </section>}
        </main>
      </div>}

      {conversationDialog && <div className="modal-backdrop" role="presentation">
        <section className="modal-card" ref={conversationDialogRef} role="dialog" aria-modal="true" aria-labelledby="conversation-dialog-title">
          <h2 id="conversation-dialog-title">{conversationDialog.kind === 'rename' ? t('renameDialogTitle') : t('deleteDialogTitle')}</h2>{conversationDialog.kind === 'rename' ? <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void renameChat(conversationDialog.conversation, conversationDialog.title) }}>
            <label htmlFor="conversation-title">{t('renamePrompt')}</label>
            <input id="conversation-title" autoFocus maxLength={160} required value={conversationDialog.title} onChange={(event) => setConversationDialog({ ...conversationDialog, title: event.target.value })} />
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => { setConversationDialog(null); conversationDialogOpener.current?.focus() }}>{t('cancel')}</Button>
              <Button type="submit" disabled={busy}>{busy ? t('loading') : t('rename')}</Button>
            </div>
          </form> : <>
            <p>{t('deleteWarning').replace('{title}', conversationDialog.title)}</p>
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => { setConversationDialog(null); conversationDialogOpener.current?.focus() }}>{t('cancel')}</Button>
              <Button variant="danger" onClick={() => void deleteChat(conversationDialog.conversation)} disabled={busy}>{busy ? t('loading') : t('delete')}</Button>
            </div>
          </>}</section>
      </div>}

      {shareDialogOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeShareDialog() }}>
        <section className="modal-card share-dialog" ref={shareDialogRef} role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" aria-describedby="share-dialog-description">
          <button className="modal-close" type="button" autoFocus aria-label={t('closeShareDialog')} onClick={closeShareDialog}><Icon name="close" size={18} /></button>
          <span className="eyebrow">{t('privateUntilShared')}</span>
          <h2 id="share-dialog-title">{t('shareConversation')}</h2>
          <p id="share-dialog-description">{t('shareWarning')}</p>
          <p className="share-permission">{t('readOnlyAccess')}</p>
          <label className="form-stack">{t('linkExpires')}<select value={shareExpiry} onChange={(event) => setShareExpiry(Number(event.target.value) as 1 | 24 | 168)}>
            <option value={1}>{t('oneHour')}</option>
            <option value={24}>{t('oneDay')}</option>
            <option value={168}>{t('sevenDays')}</option>
          </select></label>
          <label className="consent-control share-confirm">
            <input type="checkbox" checked={shareConfirmed} onChange={(event) => setShareConfirmed(event.target.checked)} />
            <span>{t('confirmSharing')}</span>
          </label>{shareToken && <div className="share-link-result">
            <label htmlFor="share-link-output">{t('shareLinkShownOnce')}</label>
            <input id="share-link-output" readOnly value={shareToken} onFocus={(event) => event.currentTarget.select()} />
            <button className="button button-outline" type="button" onClick={() => void copyShareLink()}>{t('copyLink')}</button>
          </div>}<button className="button button-primary" type="button" onClick={() => void createShareLink()} disabled={busy || !shareConfirmed}>{busy ? t('loading') : t('createShareLink')}</button>
          <div className="share-active-links">
            <h3>{t('existingLinks')}</h3>{shareLinks.length === 0 ? <p>{t('noLinksCreated')}</p> : shareLinks.map((item) => <article key={item.id} className="share-link-row">
              <div><strong>{item.active ? t('active') : item.revoked_at ? t('revoked') : t('expired')}</strong><small>{t('expires')} {new Date(item.expires_at).toLocaleString()}</small></div>{item.active && <button className="button button-quiet button-small" type="button" disabled={busy} onClick={() => void revokeShareLink(item.id)}>{t('revokeLink')}</button>}</article>)}</div>
        </section>
      </div>}

      {consentModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeConsentModal() }}>
        <section className="modal-card consent-dialog" ref={consentDialogRef} role="dialog" aria-modal="true" aria-labelledby="consent-dialog-title" aria-describedby="consent-dialog-description">
          <button className="modal-close" type="button" autoFocus aria-label={t('closeConsentDialog')} onClick={closeConsentModal}><Icon name="close" size={18} /></button>
          <h2 id="consent-dialog-title">{t('consentDialogTitle')}</h2>
          <p id="consent-dialog-description">{t('consentDialogBody')}</p>
          <label className="consent-control">
            <input type="checkbox" checked={consentChecked} onChange={(event) => setConsentChecked(event.target.checked)} required />
            <span>{t('consentDialogCheckbox')}</span>
          </label>
          <p className="field-hint">{t('consentDialogHint')}</p>
          <div className="dialog-actions">
            <Button variant="outline" onClick={closeConsentModal}>{t('cancel')}</Button>
            <Button disabled={!consentChecked || busy} onClick={acceptConsent}>{busy ? t('saving') : t('acceptAndContinue')}</Button>
          </div>
        </section>
      </div>}

      <footer className={user ? 'footer workspace-footer' : 'footer'}>
        <span>Ghana Health Assistant</span>
        <span>{t('footerService')}</span>
      </footer>
    </div>
  )
}

export default App
