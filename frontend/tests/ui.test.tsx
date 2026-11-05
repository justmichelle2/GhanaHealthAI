import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
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
      if (url.endsWith('/patient/profile')) return jsonResponse({ full_name: 'Ama Mensah', preferred_language: 'en' })
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
    expect(screen.getByRole('combobox', { name: /health-conversation language/i })).toBeInTheDocument()

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
