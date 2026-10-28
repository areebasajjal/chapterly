import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight, BookMarked, BookOpen, Bookmark, CalendarDays,
  Clock3, LibraryBig, NotebookPen, Quote, Sparkles, Trophy
} from 'lucide-react'
import './Home.css'

const API_URL = 'http://localhost:5050'

type BookCard = {
  id: string
  title: string
  coverUrl: string
  currentPage?: number | null
}

type Dashboard = {
  reader: { displayName: string; avatarUrl: string }
  stats: {
    booksRead: number
    currentlyReading: number
    wantToRead: number
    readingSessions: number
    demoSessions: number
    minutesRead: number
    pagesRead: number
  }
  continueReading: BookCard[]
  recentSessions: {
    id: string
    bookId: string
    bookTitle: string
    readingDate: string
    minutesRead: number
    pagesRead: number
  }[]
  activity: { day: string; minutes: number }[]
  challenges: {
    id: string
    title: string
    targetBooks: number
    completedBooks: number
    status: string
  }[]
  featuredQuote: {
    text: string
    type: 'verified_excerpt' | 'editorial_highlight'
    bookId: string
    bookTitle: string
  } | null
  explore: BookCard[]
}

type DashboardState = {
  status: 'loading' | 'ready' | 'unauthorized' | 'error'
  data: Dashboard | null
  message: string
}

function BookCover({ book }: { book: BookCard }) {
  return book.coverUrl ? (
    <img className="home-book-cover" src={book.coverUrl} alt={`Cover of ${book.title}`} loading="lazy" />
  ) : (
    <div className="home-book-cover home-book-placeholder" aria-hidden="true">
      <BookOpen size={27} />
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return hours ? `${hours}h ${remaining}m` : `${remaining} min`
}

export default function Home() {
  const [state, setState] = useState<DashboardState>({
    status: 'loading', data: null, message: ''
  })

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const response = await fetch(`${API_URL}/api/me/dashboard`, {
          credentials: 'include', signal: controller.signal
        })

        if (response.status === 401) {
          if (!controller.signal.aborted) {
            setState({ status: 'unauthorized', data: null, message: 'Sign in to view your reading dashboard.' })
          }
          return
        }

        if (!response.ok) {
          const body: { error?: { message?: string } } = await response.json().catch(() => ({}))
          throw new Error(body.error?.message || `Dashboard request failed (${response.status}).`)
        }

        const result: { data: Dashboard } = await response.json()
        if (!controller.signal.aborted) {
          setState({ status: 'ready', data: result.data, message: '' })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            status: 'error', data: null,
            message: error instanceof Error ? error.message : 'Unable to load the dashboard.'
          })
        }
      }
    }

    void load()
    return () => controller.abort()
  }, [])

  if (state.status === 'loading') {
    return <div className="chapterly-home home-message" role="status">Loading your reading dashboard...</div>
  }

  if (state.status === 'unauthorized') {
    return (
      <div className="chapterly-home home-message">
        <h1>Your reading story starts here.</h1>
        <p>{state.message}</p>
        <Link className="home-primary-link" to="/login">Log in <ArrowRight size={16} /></Link>
      </div>
    )
  }

  if (!state.data) {
    return (
      <div className="chapterly-home home-message" role="alert">
        <h1>Dashboard unavailable</h1>
        <p>{state.message}</p>
        <button className="home-primary-link" onClick={() => window.location.reload()}>Try again</button>
      </div>
    )
  }

  const { reader, stats, continueReading, recentSessions, activity, challenges, featuredQuote, explore } = state.data
  const maxMinutes = Math.max(1, ...activity.map(day => day.minutes))
  const hasWeeklyActivity = activity.some(day => day.minutes > 0)

  const statCards = [
    { label: 'Books read', value: stats.booksRead, icon: BookMarked, note: 'Finished titles' },
    { label: 'Currently reading', value: stats.currentlyReading, icon: BookOpen, note: 'On your active shelf' },
    { label: 'Want to read', value: stats.wantToRead, icon: Bookmark, note: 'Saved for later' },
    { label: 'Reading sessions', value: stats.readingSessions, icon: Clock3, note: 'Total journal entries' }
  ]

  return (
    <div className="chapterly-home">
      <section className="home-hero">
        <div>
          <div className="home-eyebrow"><Sparkles size={15} /> YOUR READING DASHBOARD</div>
          <h1>Welcome back, {reader.displayName}.</h1>
          <p>Every chapter counts. Here's how your reading journey is going.</p>
          {stats.demoSessions > 0 && (
            <div className="home-demo-note">Includes {stats.demoSessions} demo reading sessions for testing.</div>
          )}
          <Link className="home-primary-link" to="/journal">Log a reading session <ArrowRight size={17} /></Link>
        </div>
        <div className="home-hero-symbol" aria-hidden="true"><BookOpen size={58} strokeWidth={1.3} /></div>
      </section>

      <section className="home-stats" aria-label="Reading statistics">
        {statCards.map(({ label, value, icon: Icon, note }) => (
          <div className="home-stat" key={label}>
            <div className="home-stat-heading"><span>{label}</span><Icon size={20} strokeWidth={1.7} /></div>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </section>

      <section className="home-content-grid">
        <div className="home-column">
          <div className="home-section-heading">
            <h2><BookOpen size={20} /> Continue reading</h2>
            <Link to="/library">My Library <ArrowRight size={15} /></Link>
          </div>
          {continueReading.length ? (
            <div className="home-book-list">
              {continueReading.map(book => (
                <Link className="home-book-row" key={book.id} to={`/books/${book.id}`}>
                  <BookCover book={book} />
                  <div className="home-book-meta">
                    <strong>{book.title}</strong>
                    <span>{book.currentPage ? `Page ${book.currentPage}` : 'Currently reading'}</span>
                  </div>
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="home-empty"><p>No books on your Currently Reading shelf yet.</p><Link to="/discover">Discover a book</Link></div>
          )}

          <div className="home-section-heading home-separated">
            <h2><NotebookPen size={20} /> Recent reading</h2>
            <Link to="/journal">View journal <ArrowRight size={15} /></Link>
          </div>
          {recentSessions.length ? (
            <div className="home-session-list">
              {recentSessions.map(session => (
                <div className="home-session-row" key={session.id}>
                  <div className="home-session-icon"><CalendarDays size={19} /></div>
                  <div className="home-session-meta">
                    <Link to={`/books/${session.bookId}`}>{session.bookTitle}</Link>
                    <span>{formatDate(session.readingDate)} · {formatMinutes(session.minutesRead)} · {session.pagesRead} pages</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="home-empty"><p>No sessions yet. Record your first reading session!</p><Link to="/journal">Open Reading Journal</Link></div>
          )}
        </div>

        <div className="home-column">
          <div className="home-section-heading">
            <h2><Clock3 size={20} /> Reading activity</h2>
            <span>Last 7 days · UTC</span>
          </div>
          <div className="home-activity-card">
            <div className="home-activity-totals">
              <div><strong>{formatMinutes(stats.minutesRead)}</strong><span>Total reading time</span></div>
              <div><strong>{stats.pagesRead.toLocaleString()}</strong><span>Pages logged</span></div>
            </div>
            {hasWeeklyActivity ? (
              <div className="home-chart" role="img" aria-label="Reading minutes for the last seven days">
                {activity.map(day => {
                  const label = new Date(`${day.day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
                  return (
                    <div className="home-chart-day" key={day.day} title={`${day.day}: ${day.minutes} minutes`}>
                      <div className="home-chart-rail"><div className="home-chart-bar" style={{ height: `${day.minutes / maxMinutes * 100}%` }} /></div>
                      <span>{label}</span>
                    </div>
                  )
                })}
              </div>
            ) : <p className="home-chart-empty">No reading sessions in the last seven days.</p>}
          </div>

          <div className="home-section-heading home-separated">
            <h2><Trophy size={20} /> My challenges</h2>
            <span>Progress</span>
          </div>
          <div className="home-challenge-list">
            {challenges.length ? challenges.map(challenge => {
              const percentage = challenge.targetBooks > 0
                ? Math.min(100, Math.round(challenge.completedBooks / challenge.targetBooks * 100)) : 0
              return (
                <div className="home-challenge" key={challenge.id}>
                  <strong>{challenge.title}</strong>
                  <span>{challenge.completedBooks} / {challenge.targetBooks} books · {challenge.status}</span>
                  <div className="home-progress-rail" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${challenge.title} progress`}>
                    <div style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              )
            }) : <div className="home-empty"><p>You haven't joined a reading challenge yet.</p><span>Challenges page is coming soon.</span></div>}
          </div>
        </div>
      </section>

      {featuredQuote && (
        <section className="home-featured-quote">
          <Quote size={25} aria-hidden="true" />
          <div>
            <div className="home-quote-label">{featuredQuote.type === 'verified_excerpt' ? 'VERIFIED BOOK EXCERPT' : 'ORIGINAL BOOK-INSPIRED HIGHLIGHT'}</div>
            <p>{featuredQuote.text}</p>
            <Link to={`/books/${featuredQuote.bookId}/quotes`}>
              {featuredQuote.bookTitle} <ArrowRight size={15} />
            </Link>
            {featuredQuote.type === 'editorial_highlight' && <small>Original editorial text, not a quotation from the book.</small>}
          </div>
        </section>
      )}

      <section className="home-discover-section">
        <div className="home-section-heading"><h2><LibraryBig size={20} /> Explore the catalog</h2><Link to="/discover">Discover books <ArrowRight size={15} /></Link></div>
        <div className="home-explore-grid">
          {explore.map(book => (
            <Link className="home-explore-book" to={`/books/${book.id}`} key={book.id}>
              <BookCover book={book} /><strong>{book.title}</strong>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
