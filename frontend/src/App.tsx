import { useEffect, useRef, useState, type FormEvent } from 'react'
import { loadInterfaceLanguage, translate, type InterfaceLanguage, type TranslationKey } from './i18n/resources'

type User = { id: string; email: string; role: 'patient' | 'doctor' | 'admin'; is_active: boolean; created_at: string }
type Profile = { full_name: string | null; preferred_language: string | null }
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

const API = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'tw', label: 'Twi' }, { value: 'ee', label: 'Ewe' }, { value: 'gaa', label: 'Ga' }, { value: 'ha', label: 'Hausa' }]

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

function conversationDateGroup(value: string) {
  const today = new Date()
  const date = new Date(value)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  if (startOfDate === startOfToday) return 'Today'
  if (startOfDate === startOfToday - 86400000) return 'Yesterday'
  return 'Previous days'
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
  catch { throw new ApiError('The API cannot be reached. Check that the backend is running.', 0) }
  const body = response.status === 204 ? null : await response.json().catch(() => null) as { detail?: string | { msg?: string }[] } | null
  if (!response.ok) {
    const detail = body?.detail
    let message = typeof detail === 'string' ? detail : 'The request could not be completed.'
    if (Array.isArray(detail)) message = detail.map((item) => item.msg || 'Invalid value').join(' ')
    if (response.status === 503 && /database|service temporarily unavailable/i.test(message)) message = "We can't sign you in right now. Please try again shortly."
    if (response.status === 422 && !Array.isArray(detail)) message = 'Check the information you entered.'
    if (response.status === 409 && /already exists/i.test(message)) message = 'An account with this email already exists. Sign in instead.'
    throw new ApiError(message, response.status)
  }
  return body as T
}

function App() {
  const [page, setPage] = useState<Page>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile>({ full_name: null, preferred_language: 'en' })
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
  const [showPassword, setShowPassword] = useState(false)
  const [language, setLanguage] = useState('en')
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>(() => loadInterfaceLanguage(localStorage))
  const [resetEmail, setResetEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
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
  const [messageDraft, setMessageDraft] = useState('')
  const [storeConsent, setStoreConsent] = useState(false)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [selectedChat, setSelectedChat] = useState<ConversationDetail | null>(null)
  const [chatSearch, setChatSearch] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('gha-theme')
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })
  const chatBodyRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const bootHashRef = useRef(window.location.hash)

  useEffect(() => {
    if (selectedChat && chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
  }, [selectedChat])

  useEffect(() => {
    const input = composerRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 150)}px`
    input.style.overflowY = input.scrollHeight > 150 ? 'auto' : 'hidden'
  }, [messageDraft])

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
    setProfile(saved); setFullName(saved.full_name || ''); setLanguage(saved.preferred_language || 'en'); setSubmissions(history); setChatResults(history); setPage('dashboard')
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
          if (active) setError('This link is unavailable or has expired.')
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
        else { setError(reason instanceof Error ? reason.message : 'Unable to connect.'); setPage('unavailable') }
      }
    }
    void restore()
    return () => { active = false }
  }, [])

  function beginAuth(mode: 'login' | 'register') {
    setAuthMode(mode); setError(''); setSuccess(''); setPage(mode)
  }
  function navigate(next: Page) { setPage(next); setError(''); setSuccess(''); setChatDrawerOpen(false) }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess(''); setBusy(true)
    try {
      await request<void>('/auth/csrf')
      const result = await request<{ message: string }>('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email: resetEmail.trim() }) })
      setSuccess(result.message)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to request a reset link.') }
    finally { setBusy(false) }
  }

  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess('')
    if (resetPassword !== resetConfirmPassword) { setError('Your passwords do not match.'); return }
    setBusy(true)
    try {
      const result = await request<{ message: string }>('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token: resetToken, password: resetPassword }) })
      setSuccess(result.message); setResetToken(''); setResetPassword(''); setResetConfirmPassword('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('resetUnavailable')) }
    finally { setBusy(false) }
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess('')
    if (authMode === 'register' && password !== confirmPassword) { setError('Your passwords do not match.'); return }
    setBusy(true)
    try {
      const route = authMode === 'register' ? '/auth/register' : '/auth/login'
      const body = authMode === 'register'
        ? { full_name: fullName.trim(), email: email.trim(), password, preferred_language: language }
        : { email: email.trim(), password }
      const account = await request<User>(route, { method: 'POST', body: JSON.stringify(body) })
      setPassword(''); setConfirmPassword(''); await loadWorkspace(account)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in.') }
    finally { setBusy(false) }
  }

  async function logout() {
    setBusy(true); setError('')
    try {
      await request<void>('/auth/logout', { method: 'POST' })
      setUser(null); setPassword(''); setConfirmPassword(''); setSuccess(''); setSelectedChat(null)
      await request<void>('/auth/csrf'); setPage('landing')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign out.') }
    finally { setBusy(false) }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess(''); setBusy(true)
    try {
      const saved = await request<Profile>('/patient/profile', {
        method: 'PATCH', body: JSON.stringify({ full_name: fullName.trim(), preferred_language: language }),
      })
      setProfile(saved); setSuccess('Your profile has been updated.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save profile.') }
    finally { setBusy(false) }
  }

  async function openChat(id: string) {
    setError(''); setSuccess(''); setChatBusy(true)
    try {
      setSelectedChat(await request<ConversationDetail>('/patient/conversations/' + id))
      setPage('assistant'); setChatDrawerOpen(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to open conversation.') }
    finally { setChatBusy(false) }
  }

  function newChat() { setSelectedChat(null); setMessageDraft(''); setStoreConsent(false); setPage('assistant'); setChatDrawerOpen(false); setError(''); setSuccess('') }

  async function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess(''); setSendingRequest(true)
    try {
      const payload = { message: messageDraft.trim(), preferred_language: language, consent_to_store: true }
      const saved = selectedChat
        ? await request<ConversationDetail>('/patient/conversations/' + selectedChat.id + '/messages', { method: 'POST', body: JSON.stringify({ message: payload.message, consent_to_store: true }) })
        : await request<ConversationDetail>('/patient/conversations', { method: 'POST', body: JSON.stringify(payload) }).then((item) => request<ConversationDetail>('/patient/conversations/' + item.id))
      setSelectedChat(saved)
      setSubmissions((items) => [saved, ...items.filter((item) => item.id !== saved.id)])
      setChatResults((items) => [saved, ...items.filter((item) => item.id !== saved.id)])
      setMessageDraft(''); setStoreConsent(false)
      setSuccess('Saved for clinician review. No automated health answer is available yet.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save this message.') }
    finally { setSendingRequest(false) }
  }

  async function searchChats(value: string) {
    setChatSearch(value)
    try { setChatResults(await request<Conversation[]>('/patient/conversations' + (value.trim() ? '?search=' + encodeURIComponent(value.trim()) : ''))) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to search conversations.') }
  }

  async function renameChat(item: Conversation) {
    const title = window.prompt('Conversation title', item.title)
    if (title === null || !title.trim()) return
    try {
      const updated = await request<Conversation>('/patient/conversations/' + item.id, { method: 'PATCH', body: JSON.stringify({ title }) })
      setSubmissions((items) => items.map((entry) => entry.id === item.id ? updated : entry))
      setChatResults((items) => items.map((entry) => entry.id === item.id ? updated : entry))
      setSelectedChat((chat) => chat?.id === item.id ? { ...chat, title: updated.title } : chat)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to rename conversation.') }
  }

  async function deleteChat(item: Conversation) {
    if (!window.confirm('Delete this conversation and its stored messages? This cannot be undone.')) return
    try {
      await request<void>('/patient/conversations/' + item.id, { method: 'DELETE' })
      setSubmissions((items) => items.filter((entry) => entry.id !== item.id))
      setChatResults((items) => items.filter((entry) => entry.id !== item.id))
      if (selectedChat?.id === item.id) setSelectedChat(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete conversation.') }
  }

  async function openShareDialog(chat: ConversationDetail | null) {
    if (!chat) { setError('Open a saved conversation before sharing it.'); return }
    setSelectedChat(chat); setShareToken(''); setShareConfirmed(false); setShareDialogOpen(true)
    try { setShareLinks(await request<ShareLink[]>('/patient/conversations/' + chat.id + '/shares')) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load share links.') }
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
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create a share link.') }
    finally { setBusy(false) }
  }

  async function copyShareLink() {
    if (!shareToken) return
    try { await navigator.clipboard.writeText(shareToken); setSuccess('Share link copied. Anyone who receives it can view this conversation until it expires or is revoked.') }
    catch { setError('Clipboard access is unavailable. You can select and copy the link.') }
  }

  async function revokeShareLink(shareId: string) {
    if (!selectedChat) return
    setBusy(true)
    try {
      await request<void>('/patient/conversations/' + selectedChat.id + '/shares/' + shareId, { method: 'DELETE' })
      setShareLinks(await request<ShareLink[]>('/patient/conversations/' + selectedChat.id + '/shares'))
      setSuccess('Share link revoked.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to revoke this link.') }
    finally { setBusy(false) }
  }

  async function shareSavedChat(item: Conversation) {
    try { await openShareDialog(await request<ConversationDetail>('/patient/conversations/' + item.id)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load conversation for sharing.') }
  }

  async function reviewRequest(item: Review) {
    setError(''); setReviewing(item.id)
    try {
      await request('/doctor/conversations/' + item.id + '/review', {
        method: 'PATCH', body: JSON.stringify({ review_note: notes[item.id] || '' }),
      })
      const [queue, done] = await Promise.all([
        request<Review[]>('/doctor/conversations?status=pending_review'),
        request<Review[]>('/doctor/conversations?status=reviewed'),
      ])
      setPending(queue); setCompleted(done); setSuccess('Review recorded. No reply was sent to the patient.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save review.') }
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
    try { await request('/admin/doctors/' + id + '/verify', { method: 'POST' }); await reloadAdmin(); setSuccess('Clinician verification recorded.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to verify account.') }
    finally { setBusy(false) }
  }
  async function toggleUser(account: AdminUser) {
    setError(''); setBusy(true)
    try {
      await request('/admin/users/' + account.id + '/status', { method: 'PATCH', body: JSON.stringify({ is_active: !account.is_active }) })
      await reloadAdmin()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update account.') }
    finally { setBusy(false) }
  }
  async function retry() {
    setPage('loading'); setError('')
    try { await request<void>('/auth/csrf'); await loadWorkspace(await request<User>('/auth/me')) }
    catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) setPage('landing')
      else { setError(reason instanceof Error ? reason.message : 'Unable to connect.'); setPage('unavailable') }
    }
  }

  const languageName = (value: string) => LANGUAGES.find((item) => item.value === value)?.label || value.toUpperCase()
  const displayName = profile.full_name || user?.email.split('@')[0] || 'there'
  const patientNav = [
    { key: 'dashboard' as const, label: 'Overview', icon: '⌂' },
    { key: 'assistant' as const, label: 'Health assistant', icon: '✳' },
    { key: 'profile' as const, label: 'Profile & settings', icon: '◎' },
  ]
  const conversationHistory = <div className="chat-history-section"><div className="chat-history-title">CONVERSATIONS</div><button className="button button-primary chat-new-button" onClick={newChat}>＋ New chat</button><label className="chat-search"><span>Search conversations</span><input type="search" value={chatSearch} onChange={(event) => void searchChats(event.target.value)} placeholder="Search titles" /></label><div className="chat-history-list">{chatResults.length === 0 ? <div className="chat-empty"><strong>{chatSearch ? 'No matching conversations' : 'No conversations yet'}</strong><p>{chatSearch ? 'Try a different title.' : 'Your saved messages will appear here.'}</p></div> : ['Today', 'Yesterday', 'Previous days'].map((group) => { const groupItems = chatResults.filter((item) => conversationDateGroup(item.updated_at || item.created_at) === group); return groupItems.length ? <div className="chat-history-group" key={group}><strong>{group}</strong>{groupItems.map((item) => <article className={selectedChat?.id === item.id ? 'chat-history-item selected' : 'chat-history-item'} key={item.id}><button onClick={() => void openChat(item.id)}><strong>{item.title || 'Health conversation'}</strong><small>{item.status === 'pending_review' ? 'Pending review' : 'Reviewed'}</small></button><div><button className="icon-button" aria-label={'Rename ' + item.title} onClick={() => void renameChat(item)}>✎</button><button className="icon-button" aria-label={'Copy ' + item.title} onClick={() => void shareSavedChat(item)}>↗</button><button className="icon-button danger-icon" aria-label={'Delete ' + item.title} onClick={() => void deleteChat(item)}>×</button></div></article>)}</div> : null })}</div></div>

  return (
    <div className={user ? 'app-root authenticated' : 'app-root'}>
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); if (user) navigate(user.role === 'patient' ? 'dashboard' : user.role); else navigate('landing') }} aria-label="Ghana Health Assistant home">
          <span className="brand-mark">+</span><span className="brand-copy"><strong>Ghana Health</strong><small>ASSISTANT</small></span>
        </a>
        <div className="topbar-right">{user && <button className="icon-button app-menu-button mobile-only" onClick={() => setChatDrawerOpen(true)} aria-label="Open application navigation">☰</button>}<label className="theme-control"><span className="sr-only">Color theme</span><select aria-label="Color theme" value={themeMode} onChange={(event) => setThemeMode(event.target.value as ThemeMode)}><option value="system">System theme</option><option value="light">Light theme</option><option value="dark">Dark theme</option></select></label><label className="theme-control"><span className="sr-only">{t('languageLabel')}</span><select aria-label={t('languageLabel')} value={interfaceLanguage} onChange={(event) => setInterfaceLanguage(event.target.value as InterfaceLanguage)}>{LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{user ? <><span className="session-badge"><i /> Secure session</span><span className="user-chip">{user.role === 'patient' ? displayName : user.email}</span><button className="button button-outline button-small" onClick={() => void logout()} disabled={busy}>Sign out</button></> :
          !['login', 'register', 'forgot', 'reset', 'shared'].includes(page) && <><button className="button button-quiet" onClick={() => beginAuth('login')}>{t('signIn')}</button><button className="button button-primary button-small" onClick={() => beginAuth('register')}>{t('createAccount')}</button></>}
        </div>
      </header>

      {page === 'loading' && <main className="center-state"><span className="spinner" /><p>Checking your secure session…</p></main>}
      {page === 'unavailable' && <main className="center-state"><span className="state-icon">!</span><p className="eyebrow">Service unavailable</p><h1>We couldn’t load your account.</h1><p>{error || 'The API or database did not respond. Your account data has not been changed.'}</p><button className="button button-primary" onClick={() => void retry()}>Try again</button></main>}

      {page === 'landing' && !user && <main className="landing">
        <section className="landing-copy">
          <span className="eyebrow"><span className="eyebrow-mark" /> HEALTH INFORMATION, WITH HUMAN OVERSIGHT</span>
          <h1>Care starts with<br /><em>being understood.</em></h1>
          <p className="landing-lead">A health information service shaped for Ghana’s languages, with access to clinician review.</p>
          <div className="landing-actions"><button className="button button-primary button-large" onClick={() => beginAuth('register')}>Create a patient account <span>→</span></button><button className="button button-outline button-large" onClick={() => beginAuth('login')}>Sign in</button></div>
          <div className="language-strip"><span>DESIGNED FOR</span>{LANGUAGES.map((item) => <b key={item.value}>{item.label}</b>)}</div>
        </section>
        <aside className="landing-visual">
          <div className="visual-topline"><span><i /> HEALTH INFORMATION · GHANA</span><span>GH · 01</span></div>
          <div className="visual-orbit"><div className="orbit-ring orbit-one" /><div className="orbit-ring orbit-two" /><div className="orbit-center">+</div><div className="orbit-label label-one">Patient voice</div><div className="orbit-label label-two">Local language</div><div className="orbit-label label-three">Human care</div></div>
          <div className="visual-footer"><strong>Information should feel closer to home.</strong><span>English · Twi · Ewe · Ga · Hausa</span></div>
        </aside>
        <section className="landing-bottom"><article><span className="mini-icon">01</span><div><strong>English · Twi · Ewe · Ga · Hausa</strong><p>Choose a preferred language for your account.</p></div></article><article><span className="mini-icon">02</span><div><strong>Clinician review</strong><p>Patient messages can be routed for human review.</p></div></article><article><span className="mini-icon">03</span><div><strong>Health information</strong><p>AI generated answers are not available yet.</p></div></article></section>
        <div className="medical-notice"><span>i</span><p><strong>Health service notice.</strong> This application is not clinically validated and does not provide diagnosis or treatment. Contact a qualified health professional for care.</p></div>
      </main>}

      {(page === 'login' || page === 'register') && !user && <main className="auth-layout">
        <section className="auth-aside"><span className="eyebrow">GHANA HEALTH ASSISTANT</span><h1>{authMode === 'login' ? 'Welcome back.' : 'A thoughtful place to start.'}</h1><p>{authMode === 'login' ? 'Sign in to continue to your patient workspace.' : 'Create a patient account and choose your preferred language.'}</p><div className="auth-aside-note"><span>+</span><p>Private account access. Public registration is for patients only.</p></div></section>
        <section className="auth-panel"><button className="back-link" onClick={() => { setPage('landing'); setError('') }}>← Back to home</button><span className="eyebrow">{authMode === 'login' ? 'PATIENT SIGN IN' : 'PATIENT REGISTRATION'}</span><h2>{authMode === 'login' ? 'Sign in to your account' : 'Create your account'}</h2><p className="panel-lead">{authMode === 'login' ? 'Use the email and password for your account.' : 'Your account will have the patient role.'}</p>
          <form onSubmit={(event) => void handleAuth(event)} className="form-stack">
            {authMode === 'register' && <><label htmlFor="full-name">Full name</label><input id="full-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={160} required placeholder="Your name" /><label htmlFor="register-language">Preferred language</label><select id="register-language" value={language} onChange={(event) => setLanguage(event.target.value)}>{LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></>}
            <label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required placeholder="you@example.com" />
            <label htmlFor="password">Password</label><div className="password-wrap"><input id="password" type={showPassword ? 'text' : 'password'} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={authMode === 'register' ? 12 : 1} maxLength={128} required placeholder={authMode === 'register' ? 'At least 12 characters' : 'Your password'} /><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div>
            {authMode === 'register' && <><label htmlFor="confirm-password">Confirm password</label><div className="password-wrap"><input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} maxLength={128} required placeholder="Enter password again" /><button type="button" onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? 'Hide' : 'Show'}</button></div><p className="field-hint">Use at least 12 characters. Choose a unique password.</p></>}
            {error && <p className="alert alert-error" role="alert">{error}</p>}<button className="button button-primary button-full button-large" type="submit" disabled={busy}>{busy ? 'Please wait…' : authMode === 'login' ? 'Sign in securely' : 'Create patient account'} {!busy && <span>→</span>}</button>
          </form>
          {authMode === 'login' && <button className="back-link" onClick={() => { setResetEmail(email); setError(''); setSuccess(''); setPage('forgot') }}>{t('forgotPassword')}</button>}
          <p className="auth-switch">{authMode === 'login' ? 'New to the project?' : 'Already have an account?'} <button onClick={() => beginAuth(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? t('createAccount') : t('signIn')}</button></p>
          <div className="medical-notice compact"><span>i</span><p>Do not use this service for emergencies or as a substitute for care from a qualified health professional.</p></div>
        </section>
      </main>}

      {page === 'forgot' && !user && <main className="auth-layout"><section className="auth-aside"><span className="eyebrow">GHANA HEALTH ASSISTANT</span><h1>Recover your account.</h1><p>Request a time-limited password reset link by email.</p></section><section className="auth-panel"><button className="back-link" onClick={() => { setPage('login'); setError(''); setSuccess('') }}>← Back to sign in</button><h2>{t('forgotPassword')}</h2><p className="panel-lead">If an account matches the email, we’ll send reset instructions.</p><form className="form-stack" onSubmit={(event) => void requestPasswordReset(event)}><label htmlFor="reset-email">Email address</label><input id="reset-email" type="email" autoComplete="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} required maxLength={320} />{error && <p className="alert alert-error" role="alert">{error}</p>}{success && <p className="alert alert-success" role="status">{success}</p>}<button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? t('loading') : t('sendResetLink')}</button></form></section></main>}

      {page === 'reset' && !user && <main className="auth-layout"><section className="auth-aside"><span className="eyebrow">GHANA HEALTH ASSISTANT</span><h1>Choose a new password.</h1><p>{t('passwordGuidance')}</p></section><section className="auth-panel"><h2>{t('resetPassword')}</h2>{success ? <><p className="alert alert-success" role="status">{success}</p><button className="button button-primary" onClick={() => { setPage('login'); setSuccess(''); setError('') }}>{t('signIn')}</button></> : <form className="form-stack" onSubmit={(event) => void submitPasswordReset(event)}><label htmlFor="new-password">{t('newPassword')}</label><input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} required value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} /><label htmlFor="confirm-reset-password">{t('confirmPassword')}</label><input id="confirm-reset-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} required value={resetConfirmPassword} onChange={(event) => setResetConfirmPassword(event.target.value)} /><button type="button" className="back-link" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide passwords' : 'Show passwords'}</button>{error && <p className="alert alert-error" role="alert">{error}</p>}<button className="button button-primary button-full" disabled={busy}>{busy ? t('loading') : t('resetPassword')}</button></form>}</section></main>}

      {page === 'shared' && <main className="shared-page"><section className="shared-card"><span className="eyebrow">GHANA HEALTH ASSISTANT · SHARED VIEW</span><h1>Shared conversation</h1><p className="medical-notice compact">{t('sharedReadOnly')}</p>{error && <p className="alert alert-error" role="alert">{error}</p>}{!publicConversation && !error && <p role="status">{t('loading')}</p>}{publicConversation && <><p>Conversation language: {languageName(publicConversation.preferred_language)} · {new Date(publicConversation.created_at).toLocaleDateString()}</p><div className="chat-messages">{publicConversation.messages.map((message, index) => <article key={`${message.created_at}-${index}`} className={message.sender_role === 'patient' ? 'chat-message patient-message' : 'chat-message assistant-message'}><span>{message.sender_role === 'patient' ? 'Patient' : message.sender_role === 'doctor' ? 'Clinician' : 'Health Assistant'} · {new Date(message.created_at).toLocaleString()}</span><p>{message.body}</p></article>)}</div></>}</section></main>}

      {user && <div className={`workspace ${user.role === 'patient' ? 'chat-workspace' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${chatDrawerOpen ? 'sidebar-open' : ''}`}>
        {chatDrawerOpen && <button className="app-drawer-backdrop mobile-only" aria-label="Close navigation" onClick={() => setChatDrawerOpen(false)} />}
        <aside className="sidebar">
          <div className="sidebar-brand"><span className="brand-mark">+</span><strong>Ghana Health</strong><button className="sidebar-collapse" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{sidebarCollapsed ? '›' : '‹'}</button></div>
          <div className="sidebar-role"><span className="role-avatar">{user.role === 'patient' ? (displayName[0] || 'P').toUpperCase() : user.role === 'doctor' ? 'C' : 'A'}</span><div><strong>{user.role === 'patient' ? displayName : user.role === 'doctor' ? 'Clinician workspace' : 'Administration'}</strong><small>{user.role === 'doctor' ? 'VERIFIED REVIEWER' : user.role.toUpperCase()}</small></div></div>
          {user.role === 'patient' && <nav className="side-nav" aria-label="Patient navigation">{patientNav.map((item) => <button key={item.key} className={page === item.key ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.key)} aria-label={item.label}><span>{item.icon}</span><span className="nav-label">{item.label}</span></button>)}</nav>}
          {user.role === 'patient' && page === 'assistant' && conversationHistory}
          {user.role === 'doctor' && <nav className="side-nav" aria-label="Clinician navigation"><button className="nav-item active"><span>◷</span>Review workspace</button></nav>}
          {user.role === 'admin' && <nav className="side-nav" aria-label="Administrator navigation"><button className="nav-item active"><span>▦</span>Administration</button></nav>}
          <div className="sidebar-footer"><div className="privacy-mark">◇</div><strong>Your privacy matters</strong><p>Messages are stored in your account and visible to authorized reviewers.</p></div>
        </aside>
        <main className="main-content">
          <div className="content-topline"><span>GHANA HEALTH ASSISTANT <b>/</b> {user.role.toUpperCase()}</span><span className="connected-label"><i /> Connected</span></div>
          {error && <p className="alert alert-error" role="alert">{error}</p>}{success && <p className="alert alert-success" role="status">{success}</p>}
          {user.role === 'patient' && page === 'dashboard' && <section>
            <div className="page-heading"><div><span className="eyebrow">PATIENT OVERVIEW</span><h1>Good day, {displayName.split(' ')[0]}.</h1><p>Your health information workspace is taking shape.</p></div><button className="button button-primary" onClick={() => navigate('assistant')}>Open assistant <span>→</span></button></div>
            <div className="status-banner"><div className="status-banner-icon">✳</div><div><strong>Messages are available for clinician review</strong><p>Automated health answers are unavailable until reviewed health sources and response safeguards are connected.</p></div><span className="status-tag">HUMAN REVIEW</span></div>
            <div className="stat-grid"><article className="stat-card"><span>YOUR REQUESTS</span><strong>{submissions.length}</strong><small>Saved to your account</small></article><article className="stat-card"><span>PENDING REVIEW</span><strong>{submissions.filter((item) => item.status === 'pending_review').length}</strong><small>Awaiting clinician review</small></article><article className="stat-card"><span>LANGUAGE</span><strong className="stat-language">{languageName(language)}</strong><small>Your current preference</small></article></div>
            <div className="section-heading"><div><span className="eyebrow">YOUR SPACE</span><h2>Get started</h2></div></div>
            <div className="action-grid"><button className="action-card" onClick={() => navigate('assistant')}><span className="action-icon">✳</span><strong>Health assistant</strong><p>Send a message for clinician review. Automated answers are unavailable.</p><span className="action-arrow">→</span></button><button className="action-card" onClick={() => navigate('assistant')}><span className="action-icon">◷</span><strong>Chat history</strong><p>Open messages and see clinician review status.</p><span className="action-arrow">→</span></button><button className="action-card" onClick={() => navigate('profile')}><span className="action-icon">◎</span><strong>Profile & settings</strong><p>Update your display name, language, and theme.</p><span className="action-arrow">→</span></button></div>
            <div className="medical-notice"><span>i</span><p><strong>Health service notice.</strong> This application is not clinically validated and does not provide diagnosis or treatment.</p></div>
          </section>}

          {user.role === 'patient' && page === 'assistant' && <section className="chat-page">
            <div className="chat-page-heading"><div><span className="eyebrow">HEALTH ASSISTANT</span><h1>{selectedChat?.title || 'New conversation'}</h1><p>Messages are saved to your account and routed for clinician review. Automated health answers are unavailable.</p></div><div className="chat-heading-actions"><label className="language-picker">LANGUAGE<select value={language} onChange={(event) => setLanguage(event.target.value)}>{LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button className="button button-outline button-small" onClick={() => void shareChat(selectedChat)} disabled={!selectedChat}>{t('shareConversation')}</button></div></div>
            <div className="chat-layout" aria-busy={chatBusy}>
              <aside className={chatDrawerOpen ? 'chat-history-panel drawer-open' : 'chat-history-panel'} aria-label="Conversation history"><div className="chat-history-brand"><span className="chat-mark">+</span><strong>Conversations</strong><button className="icon-button mobile-only" onClick={() => setChatDrawerOpen(false)} aria-label="Close conversation history">×</button></div><button className="button button-primary chat-new-button" onClick={newChat}>＋ New chat</button><label className="chat-search"><span>Search conversations</span><input type="search" value={chatSearch} onChange={(event) => void searchChats(event.target.value)} placeholder="Search titles" /></label><div className="chat-history-list">{chatResults.length === 0 ? <div className="chat-empty"><strong>{chatSearch ? 'No matching conversations' : 'No conversations yet'}</strong><p>{chatSearch ? 'Try a different title.' : 'Your saved messages will appear here.'}</p></div> : ['Today', 'Yesterday', 'Previous days'].map((group) => { const groupItems = chatResults.filter((item) => conversationDateGroup(item.updated_at || item.created_at) === group); return groupItems.length ? <div className="chat-history-group" key={group}><strong>{group}</strong>{groupItems.map((item) => <article className={selectedChat?.id === item.id ? 'chat-history-item selected' : 'chat-history-item'} key={item.id}><button onClick={() => void openChat(item.id)}><strong>{item.title || 'Health conversation'}</strong><small>{item.status === 'pending_review' ? 'Pending review' : 'Reviewed'}</small></button><div><button className="icon-button" aria-label={'Rename ' + item.title} onClick={() => void renameChat(item)}>✎</button><button className="icon-button" aria-label={'Copy ' + item.title} onClick={() => void shareSavedChat(item)}>↗</button><button className="icon-button danger-icon" aria-label={'Delete ' + item.title} onClick={() => void deleteChat(item)}>×</button></div></article>)}</div> : null })}</div><div className="chat-sidebar-note">Your conversations are private to your account.</div></aside>
              {chatDrawerOpen && <button className="drawer-backdrop mobile-only" aria-label="Close conversation history" onClick={() => setChatDrawerOpen(false)} />}
              <div className="chat-card"><div className="chat-header"><button className="icon-button mobile-only" onClick={() => setChatDrawerOpen(true)} aria-label="Open conversation history">☰</button><span className="chat-mark">✳</span><div><strong>{selectedChat?.title || 'New conversation'}</strong><small><i /> {selectedChat ? (selectedChat.status === 'pending_review' ? 'Awaiting clinician review' : 'Reviewed by clinician') : 'Private conversation'}</small></div><button className="icon-button" onClick={() => void shareChat(selectedChat)} disabled={!selectedChat} aria-label="Share conversation">↗</button></div><div className="chat-body" ref={chatBodyRef} aria-live="polite">{selectedChat?.messages.length ? <div className="chat-messages">{selectedChat.messages.map((message) => <article className={message.sender_role === 'patient' ? 'chat-message patient-message' : 'chat-message assistant-message'} key={message.id}><span>{message.sender_role === 'patient' ? 'You' : 'Health Assistant'} · {new Date(message.created_at).toLocaleString()}</span><p>{message.body}</p></article>)}<div className="assistant-unavailable"><strong>No automated answer is available.</strong><p>Your message is saved for clinician review. The health information engine is not connected.</p></div></div> : <div className="assistant-placeholder"><span className="placeholder-symbol">✳</span><h2>Ask a health question</h2><p>Your message will be stored and routed for clinician review. This service does not generate medical answers yet.</p></div>}</div><form className="chat-composer" onSubmit={(event) => void sendChatMessage(event)}><textarea ref={composerRef} rows={2} value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={4000} minLength={5} required aria-label="Write a message" placeholder="Write a message for clinician review…" /><button className="mic-button" type="button" disabled aria-label="Voice input unavailable">◉</button><button className="button button-primary" type="submit" disabled={sendingRequest || messageDraft.trim().length < 5}>{sendingRequest ? 'Saving…' : 'Send'}</button><label className="consent-control chat-consent"><input type="checkbox" checked={storeConsent} onChange={(event) => setStoreConsent(event.target.checked)} required /><span>I consent to storing this message for clinician review. Do not include details about emergencies; contact local emergency services.</span></label></form><p className="voice-note">Microphone input is unavailable because speech recognition is not connected.</p></div>
            </div>
          </section>}


          {user.role === 'patient' && page === 'profile' && <section>
            <div className="page-heading"><div><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Your profile</h1><p>Manage the details used to personalize your account.</p></div></div>
            <div className="settings-grid"><form className="settings-card form-stack" onSubmit={(event) => void saveProfile(event)}><h2>Personal preferences</h2><p className="panel-lead">Your account is a patient account. These details are private to your sign-in.</p><label htmlFor="profile-name">Display name</label><input id="profile-name" value={fullName || profile.full_name || ''} onChange={(event) => setFullName(event.target.value)} maxLength={160} minLength={2} required /><label htmlFor="profile-language">Preferred language</label><select id="profile-language" value={language} onChange={(event) => setLanguage(event.target.value)}>{LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><label>Email address</label><input value={user.email} disabled /><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></form>
              <aside className="settings-card privacy-card"><span className="privacy-mark">◇</span><h2>Privacy & safety</h2><p>Messages are stored in your account and can be viewed by authorized clinicians. Avoid sharing unnecessary identifying details.</p><p>Your session uses an HttpOnly authentication cookie. Sign out when you finish on a shared device.</p><span className="pill pill-waiting">Clinician review only</span><label className="theme-setting" htmlFor="theme-setting">Color theme<select id="theme-setting" value={themeMode} onChange={(event) => setThemeMode(event.target.value as ThemeMode)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></aside>
            </div>
          </section>}

          {user.role === 'doctor' && page === 'doctor' && <section>
            <div className="page-heading"><div><span className="eyebrow">VERIFIED CLINICIAN</span><h1>Review workspace</h1><p>Review patient messages. Internal notes are not sent as patient replies.</p></div><span className="pill pill-waiting">{pending.length} pending</span></div>
            <div className="section-heading"><div><span className="eyebrow">NEEDS REVIEW</span><h2>Pending requests</h2></div></div>
            {pending.length === 0 ? <div className="table-card empty-state"><span>✓</span><strong>Queue is clear</strong><p>There are no submissions waiting for review.</p></div> :
              <div className="review-list">{pending.map((item) => <article className="review-card" key={item.id}><div className="review-meta"><span className="pill pill-waiting">Pending review</span><span>{languageName(item.preferred_language)} · {new Date(item.created_at).toLocaleString()}</span></div><p className="review-message">{item.message}</p><label htmlFor={'note-' + item.id}>Clinician note <span>(internal, not sent to patient)</span></label><textarea id={'note-' + item.id} maxLength={2000} rows={3} value={notes[item.id] || ''} onChange={(event) => setNotes((previous) => ({ ...previous, [item.id]: event.target.value }))} placeholder="Optional internal note" /><button className="button button-primary" onClick={() => void reviewRequest(item)} disabled={reviewing === item.id}>{reviewing === item.id ? 'Saving review…' : 'Mark reviewed'}</button></article>)}</div>}
            <div className="section-heading"><div><span className="eyebrow">COMPLETED</span><h2>Completed reviews</h2></div></div>
            <div className="table-card">{completed.length === 0 ? <div className="empty-state"><strong>No completed reviews</strong><p>Completed items will appear here.</p></div> : completed.map((item) => <article className="request-row" key={item.id}><span className="request-symbol">✓</span><div><strong>{item.message}</strong><small>Reviewed {item.reviewed_at ? new Date(item.reviewed_at).toLocaleString() : ''}</small>{item.review_note && <small>Internal note: {item.review_note}</small>}</div><span className="pill pill-done">Reviewed</span></article>)}</div>
          </section>}

          {user.role === 'admin' && page === 'admin' && <section>
            <div className="page-heading"><div><span className="eyebrow">ADMINISTRATION</span><h1>System overview</h1><p>Manage access, clinician verification, and audit activity.</p></div></div>
            <div className="stat-grid">{[{label:'Total users',value:overview?.users ?? 0},{label:'Patients',value:overview?.patients ?? 0},{label:'Clinicians to verify',value:overview?.doctors_pending_verification ?? 0},{label:'Requests pending review',value:overview?.submissions_pending_review ?? 0}].map((stat) => <article className="stat-card" key={stat.label}><span>{stat.label.toUpperCase()}</span><strong>{stat.value}</strong></article>)}</div>
            <div className="section-heading"><div><span className="eyebrow">ACCESS CONTROL</span><h2>User management</h2></div></div>
            <div className="table-card"><div className="table-header"><div><strong>Accounts</strong><small>Public registration creates patient accounts only.</small><small>Verify clinician credentials independently before approval.</small></div></div>
              {adminUsers.length === 0 ? <div className="empty-state"><strong>No accounts found</strong></div> : <div className="admin-user-list">{adminUsers.map((account) => <article className="admin-user-row" key={account.id}><div><strong>{account.display_name || account.email}</strong><small>{account.email} · {account.role} · {new Date(account.created_at).toLocaleDateString()}</small>{account.professional_details && <small>Credential details: {account.professional_details}</small>}</div><div className="admin-user-actions">{account.role === 'doctor' && <span className={account.is_verified ? 'pill pill-done' : 'pill pill-waiting'}>{account.is_verified ? 'Verified' : 'Needs verification'}</span>}{account.role === 'doctor' && !account.is_verified && <button className="button button-outline button-small" disabled={busy} onClick={() => void verifyDoctor(account.id)}>Verify clinician</button>}<button className="button button-quiet button-small" disabled={busy} onClick={() => void toggleUser(account)}>{account.is_active ? 'Deactivate' : 'Activate'}</button></div></article>)}</div>}
            </div>
            <div className="section-heading"><div><span className="eyebrow">ACCOUNTABILITY</span><h2>Recent audit activity</h2></div></div>
            <div className="table-card">{audit.length === 0 ? <div className="empty-state"><p>No audit events have been recorded.</p></div> : audit.map((entry) => <article className="request-row audit-row" key={entry.id}><span className="request-symbol">≡</span><div><strong>{entry.action.replace(/_/g, ' ')}</strong><small>{entry.resource_type}{entry.resource_id ? ' · ' + entry.resource_id : ''} · {new Date(entry.created_at).toLocaleString()}</small></div></article>)}</div>
          </section>}
        </main>
      </div>}

      {shareDialogOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShareDialogOpen(false); setShareToken('') } }}><section className="modal-card share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title"><button className="modal-close" type="button" aria-label="Close share dialog" onClick={() => { setShareDialogOpen(false); setShareToken('') }}>×</button><span className="eyebrow">PRIVATE UNTIL YOU SHARE</span><h2 id="share-dialog-title">{t('shareConversation')}</h2><p>{t('shareWarning')}</p><p className="share-permission">Read-only access. The recipient cannot change or reply to your conversation.</p><label className="form-stack">Link expires<select value={shareExpiry} onChange={(event) => setShareExpiry(Number(event.target.value) as 1 | 24 | 168)}><option value={1}>After 1 hour</option><option value={24}>After 24 hours (recommended)</option><option value={168}>After 7 days (maximum)</option></select></label><label className="consent-control share-confirm"><input type="checkbox" checked={shareConfirmed} onChange={(event) => setShareConfirmed(event.target.checked)} /><span>{t('confirmSharing')}</span></label>{shareToken && <div className="share-link-result"><label htmlFor="share-link-output">Share link (shown only once)</label><input id="share-link-output" readOnly value={shareToken} onFocus={(event) => event.currentTarget.select()} /><button className="button button-outline" type="button" onClick={() => void copyShareLink()}>{t('copyLink')}</button></div>}<button className="button button-primary" type="button" onClick={() => void createShareLink()} disabled={busy || !shareConfirmed}>{busy ? t('loading') : t('createShareLink')}</button><div className="share-active-links"><h3>Existing links</h3>{shareLinks.length === 0 ? <p>No links have been created for this conversation.</p> : shareLinks.map((item) => <article key={item.id} className="share-link-row"><div><strong>{item.active ? 'Active' : item.revoked_at ? 'Revoked' : 'Expired'}</strong><small>Expires {new Date(item.expires_at).toLocaleString()}</small></div>{item.active && <button className="button button-quiet button-small" type="button" disabled={busy} onClick={() => void revokeShareLink(item.id)}>{t('revokeLink')}</button>}</article>)}</div></section></div>}

      <footer className={user ? 'footer workspace-footer' : 'footer'}><span>Ghana Health Assistant</span><span>Health information with clinician oversight</span></footer>
    </div>
  )
}

export default App
