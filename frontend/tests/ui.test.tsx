import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import App from '../src/App'
import { Icon } from '../src/components/ui/Icon'

const patient = {
  id: 'u1',
  email: 'ama@example.com',
  role: 'patient',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(data),
  } as Response)
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/csrf')) return jsonResponse(null, 204)
      if (url.endsWith('/auth/me')) return jsonResponse(patient)
      if (url.endsWith('/patient/profile')) return jsonResponse({ full_name: 'Ama Mensah', preferred_language: 'en', messages_consent_given_at: null })
      if (url.endsWith('/patient/profile/consent')) return jsonResponse({ full_name: 'Ama Mensah', preferred_language: 'en', messages_consent_given_at: '2026-01-02T00:00:00Z' })
      if (url.endsWith('/patient/conversations')) return jsonResponse([])
      return jsonResponse({}, 404)
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Icon', () => {
  it('is decorative by default', () => {
    const { container } = render(<Icon name="menu" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).not.toHaveAttribute('role')
  })

  it('exposes a label when provided', () => {
    render(<Icon name="share" label="Share" />)
    expect(screen.getByRole('img', { name: 'Share' })).toBeInTheDocument()
  })
})

describe('chat workspace', () => {
  it('renders a compact, single-header chat without unavailable voice controls', async () => {
    const user = userEvent.setup()
    render(<App />)

    const navigation = await screen.findByRole('navigation', { name: /patient navigation/i })
    await user.click(within(navigation).getByRole('button', { name: /health assistant/i }))

    expect(await screen.findByRole('heading', { name: /ask a health question/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /write a message/i })).toBeInTheDocument()
    expect(screen.getAllByRole('combobox', { name: /health-conversation language/i })).toHaveLength(2)

    expect(screen.queryByText(/voice input is unavailable/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/automated health answers are unavailable/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/saved for clinician review\./i)).not.toBeInTheDocument()
  })

  it('has no detectable accessibility violations in the chat workspace', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const navigation = await screen.findByRole('navigation', { name: /patient navigation/i })
    await user.click(within(navigation).getByRole('button', { name: /health assistant/i }))
    await screen.findByRole('heading', { name: /ask a health question/i })

    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})

describe('message consent', () => {
  async function signInAndOpenAssistant(user: ReturnType<typeof userEvent.setup>) {
    render(<App />)
    const navigation = await screen.findByRole('navigation', { name: /patient navigation/i })
    await user.click(within(navigation).getByRole('button', { name: /health assistant/i }))
    await screen.findByRole('heading', { name: /ask a health question/i })
  }

  it('opens the consent modal when focusing the message box without consent', async () => {
    const user = userEvent.setup()
    await signInAndOpenAssistant(user)
    const textbox = screen.getByRole('textbox', { name: /write a message/i })
    fireEvent.focus(textbox)
    expect(screen.getByRole('dialog', { name: /before you start/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /i consent to storing my messages for clinician review/i })).toBeInTheDocument()
  })

  it('does not send and reopens the modal when send is pressed without consent', async () => {
    const user = userEvent.setup()
    await signInAndOpenAssistant(user)
    const textbox = screen.getByRole('textbox', { name: /write a message/i })
    fireEvent.focus(textbox)
    await screen.findByRole('dialog', { name: /before you start/i })
    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(screen.getByRole('dialog', { name: /before you start/i })).toBeInTheDocument()
  })

  it('cancelling the modal closes it and keeps send disabled', async () => {
    const user = userEvent.setup()
    await signInAndOpenAssistant(user)
    const textbox = screen.getByRole('textbox', { name: /write a message/i })
    fireEvent.focus(textbox)
    await screen.findByRole('dialog', { name: /before you start/i })
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('accepting consent persists it and enables sending', async () => {
    const user = userEvent.setup()
    await signInAndOpenAssistant(user)
    const textbox = screen.getByRole('textbox', { name: /write a message/i })
    fireEvent.focus(textbox)
    await screen.findByRole('dialog', { name: /before you start/i })
    await user.click(screen.getByRole('checkbox', { name: /i consent to storing my messages for clinician review/i }))
    await user.click(screen.getByRole('button', { name: /accept and continue/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.type(textbox, 'I have a question about sleep.')
    await user.click(screen.getByRole('checkbox', { name: /i agree to send this message to dahl inference/i }))
    await user.click(screen.getByRole('button', { name: /send/i }))
    await screen.findByRole('heading', { name: /ask a health question/i })
  })

  it('keeps send clickable for a valid draft and points to the required AI consent', async () => {
    const user = userEvent.setup()
    await signInAndOpenAssistant(user)
    const textbox = screen.getByRole('textbox', { name: /write a message/i })
    fireEvent.focus(textbox)
    await screen.findByRole('dialog', { name: /before you start/i })
    await user.click(screen.getByRole('checkbox', { name: /i consent to storing my messages for clinician review/i }))
    await user.click(screen.getByRole('button', { name: /accept and continue/i }))
    await user.type(textbox, 'hi')

    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeEnabled()
    await user.click(sendButton)
    expect(await screen.findByText(/please agree to send this message to the ai provider/i)).toBeInTheDocument()
  })
})
