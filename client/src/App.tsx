
import { useEffect, useState } from 'react'
import { Link, NavLink, Routes, Route, Outlet } from 'react-router'
import { House, BookOpen, LibraryBig, LogIn } from 'lucide-react'

import Home from './pages/Home'
import Discover from './pages/Discover'
import Library from './pages/Library'
import BookDetails from './pages/BookDetails'
import Login from './pages/login'
import Register from './pages/Register'

import './App.css'

type Reader = {
  id: string
  email: string
  displayName: string
  role: string
  avatarUrl?: string
}

function MainLayout() {
  const [reader, setReader] = useState<Reader | null>(null)
  const [checkingAccount, setCheckingAccount] = useState(true)
  const [accountError, setAccountError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    fetch('http://localhost:5050/api/auth/me', {
      credentials: 'include',
      signal: controller.signal
    })
      .then(async (response) => {
        if (response.status === 401) {
          return null
        }

        if (!response.ok) {
          throw new Error('Could not load account')
        }

        const result = await response.json()
        return result.data as Reader
      })
      .then((account) => {
        if (!controller.signal.aborted) {
          setReader(account)
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== 'AbortError') {
          setAccountError('Could not load your account.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCheckingAccount(false)
        }
      })

    return () => controller.abort()
  }, [])

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
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <House size={19} strokeWidth={1.8} />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/discover"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <BookOpen size={19} strokeWidth={1.8} />
            <span>Discover Books</span>
          </NavLink>

          <NavLink
            to="/library"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <LibraryBig size={19} strokeWidth={1.8} />
            <span>My Library</span>
          </NavLink>

        </nav>

        <div className="sidebar-account">

          {checkingAccount && (
            <p className="account-loading">
              Loading account...
            </p>
          )}

          {!checkingAccount && accountError && (
            <p className="account-loading" role="alert">
              {accountError}
            </p>
          )}

          {!checkingAccount && !accountError && reader && (
            <div className="account-profile">

              <div className="account-avatar">
                {reader.avatarUrl ? (
                  <img
                    src={reader.avatarUrl}
                    alt={`${reader.displayName}'s avatar`}
                  />
                ) : (
                  reader.displayName.charAt(0).toUpperCase()
                )}
              </div>

              <div className="account-details">
                <p className="account-name">
                  {reader.displayName}
                </p>

                <p className="account-role">
                  {reader.role} account
                </p>
              </div>

            </div>
          )}

          {!checkingAccount && !accountError && !reader && (
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
            <span className="eyebrow">
              YOUR READING SPACE
            </span>

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
      </Route>

    </Routes>
  )
}

export default App


