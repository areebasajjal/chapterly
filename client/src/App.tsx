
import { Link, NavLink, Routes, Route } from 'react-router'
import Home from './pages/Home'
import Discover from './pages/Discover'
import Library from './pages/Library'
import './App.css'
import BookDetails from './pages/BookDetails'

function App() {
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
            Home
          </NavLink>

          <NavLink
            to="/discover"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            Discover Books
          </NavLink>

          <NavLink
            to="/library"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            My Library
          </NavLink>
        </nav>
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
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/library" element={<Library />} />
            <Route path="/books/:id" element={<BookDetails />} />
          </Routes>
        </main>

      </div>
    </div>
  )
}

export default App

