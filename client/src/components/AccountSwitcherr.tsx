import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { Check, ChevronUp, Plus, UserRoundX } from 'lucide-react'
import './AccountSwitcher.css'

export type SwitcherAccount = {
  id: string
  email: string
  displayName: string
  role: string
  avatarUrl?: string
}

type AccountSwitcherProps = {
  current: SwitcherAccount
  accounts: SwitcherAccount[]
  onForget: (id: string) => void
}

export default function AccountSwitcher({
  current,
  accounts,
  onForget
}: AccountSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<SwitcherAccount | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [switching, setSwitching] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setSelected(null)
        setPassword('')
        setError('')
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        setSelected(null)
        setPassword('')
        setError('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const orderedAccounts = [
    current,
    ...accounts.filter(account => account.id !== current.id)
  ]

  async function handleSwitch(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !password || switching) return

    setSwitching(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: selected.email,
          password
        })
      })

      const body: {
        error?: { message?: string }
      } = await response.json()

      if (!response.ok) {
        throw new Error(body.error?.message || 'Could not switch accounts.')
      }

      // The backend has replaced the HTTP-only session cookie.
      // Reloading clears any reader-specific state from the previous account.
      window.location.assign('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch accounts.')
      setSwitching(false)
    }
  }

  function chooseAccount(account: SwitcherAccount) {
    if (account.id === current.id) {
      setOpen(false)
      setSelected(null)
      return
    }
    setSelected(account)
    setPassword('')
    setError('')
  }

  function goBack() {
    setSelected(null)
    setPassword('')
    setError('')
  }

  return (
    <div className="chapterly-account-switcher" ref={rootRef}>
      {open && (
        <div className="chapterly-account-popover" id="chapterly-account-menu">
          {selected ? (
            <form onSubmit={handleSwitch} className="chapterly-account-password-form">
              <button type="button" className="chapterly-account-back" onClick={goBack}>
                ← All accounts
              </button>
              <h3>Switch to {selected.displayName}</h3>
              <p className="chapterly-account-caption">{selected.email}</p>
              <label htmlFor="chapterly-switch-password">Account password</label>
              <input
                id="chapterly-switch-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
                autoFocus
              />
              {error && <p className="chapterly-account-error" role="alert">{error}</p>}
              <button className="chapterly-account-submit" type="submit" disabled={switching || !password}>
                {switching ? 'Switching…' : 'Switch account'}
              </button>
            </form>
          ) : (
            <>
              <div className="chapterly-account-popover-heading">
                <strong>Switch account</strong>
              </div>

              <div className="chapterly-account-list" role="group" aria-label="Saved accounts on this browser">
                {orderedAccounts.map(account => (
                  <div className="chapterly-account-entry" key={account.id}>
                    <button
                      className="chapterly-account-option"
                      type="button"
                      onClick={() => chooseAccount(account)}
                    >
                      <span className="chapterly-account-mini-avatar">
                        {account.avatarUrl ? (
                          <img src={account.avatarUrl} alt="" />
                        ) : (
                          account.displayName.charAt(0).toUpperCase()
                        )}
                      </span>
                      <span className="chapterly-account-option-text">
                        <strong>{account.displayName}</strong>
                        <small>{account.email}</small>
                      </span>
                      {account.id === current.id && <Check size={17} aria-label="Current account" />}
                    </button>
                    {account.id !== current.id && (
                      <button
                        className="chapterly-account-forget"
                        type="button"
                        title={`Forget ${account.displayName} on this browser`}
                        aria-label={`Forget ${account.displayName} on this browser`}
                        onClick={() => onForget(account.id)}
                      >
                        <UserRoundX size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="chapterly-account-actions">
                <Link to="/register" onClick={() => setOpen(false)}>
                  <Plus size={16} /> Create new account
                </Link>
              </div>
              <p className="chapterly-account-hint">
                Accounts appear here after you sign into them on this browser.
              </p>
            </>
          )}
        </div>
      )}

      <button
        className="chapterly-account-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="chapterly-account-menu"
        aria-label={`Current account: ${current.displayName}. Open account switcher`}
        onClick={() => {
          setOpen(previous => !previous)
          setSelected(null)
          setPassword('')
          setError('')
        }}
      >
        <span className="chapterly-account-main-avatar">
          {current.avatarUrl ? (
            <img src={current.avatarUrl} alt="" />
          ) : (
            current.displayName.charAt(0).toUpperCase()
          )}
        </span>
        <span className="chapterly-account-main-text">
          <strong>{current.displayName}</strong>
          <small>{current.role} account</small>
        </span>
        <ChevronUp size={18} className={open ? 'chapterly-chevron-active' : ''} />
      </button>
    </div>
  )
}
