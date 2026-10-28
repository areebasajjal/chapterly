import { useEffect, useState } from 'react'
import { Link, NavLink, Routes, Route, Outlet } from 'react-router'
import { House, BookOpen, LibraryBig, LogIn } from 'lucide-react'
import AccountSwitcher, { type SwitcherAccount } from './components/AccountSwitcherr'

import Home from './pages/Home'
import Discover from './pages/Discover'
import Library from './pages/Library'
import BookDetails from './pages/BookDetails'
import BookQuotes from './pages/BookQuotes'
import Login from './pages/Login'
import Register from './pages/Register'

import './App.css'

const SAVED_ACCOUNTS_KEY = 'chapterly:remembered-accounts:v1'

type Reader = SwitcherAccount

// Only public-facing account labels are saved locally. No passwords or tokens.
function readRememberedAccounts(): Reader[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(SAVED_ACCOUNTS_KEY) || '[]'
    )
    if (!Array.isArray(value)) return []
    return value.filter((item): item is Reader =>
      item !== null &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.email === 'string' &&
      typeof item.displayName === 'string' &&
      typeof item.role === 'string'
    )
  } catch {
    return []
  }
}

function rememberAccount(account: Reader): Reader[] {
  const next = [
    account,
    ...readRememberedAccounts().filter(item => item.id !== account.id)
  ]
  try {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next))
  } catch {
    // Browsers with blocked storage can still use the current session.
  }
  return next
}

function MainLayout() {
  const [reader, setReader] = useState<Reader | null>(null)
  const [loading, setLoading] = useState(true)
  const [accountError, setAccountError] = useState('')
  const [rememberedAccounts, setRememberedAccounts] = useState<Reader[]>(
    readRememberedAccounts
  )

  // Check whether the reader has an active login session.
  useEffect(() => {
    const controller = new AbortController()

    async function loadReader() {
      try {
        const response = await fetch('http://localhost:5050/api/auth/me', {
          credentials: 'include',
          signal: controller.signal
        })

        if (response.status === 401) {
          if (!controller.signal.aborted) {
            setReader(null)
            setAccountError('')
          }
          return
        }

        if (!response.ok) {
          throw new Error('Could not load account')
        }

        const result: { data: Reader } = await response.json()

        if (!controller.signal.aborted) {
          setReader(result.data)
          setRememberedAccounts(rememberAccount(result.data))
          setAccountError('')
        }
      } catch {
        if (!controller.signal.aborted) {
          setAccountError('Could not load your account.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadReader()

    return () => controller.abort()
  }, [])

  function forgetAccount(id: string) {
    const next = rememberedAccounts.filter(account => account.id !== id)
    try {
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next))
    } catch {
      // If storage is blocked, the visible list can still update.
    }
    setRememberedAccounts(next)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <div className="brand-icon">📖</div>
          <div>
            <h1>Chapterly</h1>
            <p>Your reading companion</p>
          </div>
        </Link>

        <p className="nav-label">MAIN MENU</p>

        <nav className="nav-list" aria-label="Main navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <House size={19} strokeWidth={1.8} />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/discover"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <BookOpen size={19} strokeWidth={1.8} />
            <span>Discover Books</span>
          </NavLink>

          <NavLink
            to="/library"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <LibraryBig size={19} strokeWidth={1.8} />
            <span>My Library</span>
          </NavLink>
        </nav>

        <div className="sidebar-account">
          {loading && <p className="account-loading">Loading account...</p>}

          {!loading && accountError && (
            <p className="account-loading" role="alert">{accountError}</p>
          )}

          {!loading && !accountError && reader && (
            <AccountSwitcher
              current={reader}
              accounts={rememberedAccounts}
              onForget={forgetAccount}
            />
          )}

          {!loading && !accountError && !reader && (
            <Link to="/login" className="account-login-link">
              <LogIn size={19} strokeWidth={1.8} />
              <span>Log In to Chapterly</span>
            </Link>
          )}
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">YOUR READING SPACE</span>
            <h2>Make room for more stories.</h2>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/library" element={<Library />} />
        <Route path="/books/:id" element={<BookDetails />} />
        <Route path="/books/:id/quotes" element={<BookQuotes />} />
      </Route>
    </Routes>
  )
}

export default App

