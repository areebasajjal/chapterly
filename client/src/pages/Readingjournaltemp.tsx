import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { BookOpen, CalendarDays, Clock3, FilePenLine, Plus, Trash2, X } from 'lucide-react'
import './ReadingJournal.css'

const API_URL = 'http://localhost:5050'

type BookSummary = {
  _id: string
  title: string
  coverUrl?: string
}

type EditionSummary = {
  _id: string
  format?: string
  pages?: number
  isbn13?: string
}

type ReadingSession = {
  _id: string
  bookId: string | BookSummary | null
  editionId?: string | EditionSummary | null
  readingDate: string
  minutesRead: number
  pagesRead: number
  currentPage: number | null
  notes: string
  createdAt?: string
}

type ApiError = {
  error?: {
    code?: string
    message?: string
  }
}

type FormValues = {
  bookId: string
  readingDate: string
  minutesRead: string
  pagesRead: string
  currentPage: string
  notes: string
}

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function initialForm(): FormValues {
  return {
    bookId: '',
    readingDate: dateInputValue(new Date()),
    minutesRead: '30',
    pagesRead: '10',
    currentPage: '',
    notes: ''
  }
}

function bookIdOf(session: ReadingSession): string {
  return typeof session.bookId === 'string'
    ? session.bookId
    : session.bookId?._id ?? ''
}

function bookOf(session: ReadingSession, allBooks: BookSummary[]) {
  if (session.bookId && typeof session.bookId === 'object') {
    return session.bookId
  }
  return allBooks.find((book) => book._id === bookIdOf(session))
}

function readableDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => ({})) as ApiError
  return body.error?.message || `Request failed (${response.status}).`
}

export default function ReadingJournal() {
  const [books, setBooks] = useState<BookSummary[]>([])
  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [authRequired, setAuthRequired] = useState(false)
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormValues>(initialForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const [sessionResponse, bookResponse] = await Promise.all([
          fetch(`${API_URL}/api/me/reading-sessions`, {
            credentials: 'include',
            signal: controller.signal
          }),
          fetch(`${API_URL}/api/books`, {
            signal: controller.signal
          })
        ])

        if (sessionResponse.status === 401) {
          if (!controller.signal.aborted) setAuthRequired(true)
          return
        }
        if (!sessionResponse.ok) throw new Error(await responseError(sessionResponse))
        if (!bookResponse.ok) throw new Error(await responseError(bookResponse))

        const sessionJson: { data: ReadingSession[] } = await sessionResponse.json()
        const bookJson: { data: BookSummary[] } = await bookResponse.json()
        if (!controller.signal.aborted) {
          setSessions(sessionJson.data)
          setBooks(bookJson.data)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPageError(error instanceof Error ? error.message : 'Could not load your reading journal.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [])

  const totals = useMemo(() => ({
    minutes: sessions.reduce((sum, s) => sum + s.minutesRead, 0),
    pages: sessions.reduce((sum, s) => sum + s.pagesRead, 0)
  }), [sessions])

  const displayedSessions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return [...sessions]
      .filter((session) => {
        if (!query) return true
        const book = bookOf(session, books)
        return (book?.title || '').toLocaleLowerCase().includes(query) ||
          session.notes.toLocaleLowerCase().includes(query)
      })
      .sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime())
  }, [sessions, books, search])

  function newSession() {
    setEditingId(null)
    setForm(initialForm())
    setNotice('')
    setFormError('')
    setFormOpen(true)
  }

  function editSession(session: ReadingSession) {
    setEditingId(session._id)
    setForm({
      bookId: bookIdOf(session),
      readingDate: dateInputValue(new Date(session.readingDate)),
      minutesRead: String(session.minutesRead),
      pagesRead: String(session.pagesRead),
      currentPage: session.currentPage == null ? '' : String(session.currentPage),
      notes: session.notes || ''
    })
    setNotice('')
    setFormError('')
    setFormOpen(true)
  }

  function closeForm() {
    if (saving) return
    setFormOpen(false)
    setEditingId(null)
    setFormError('')
  }

  async function saveSession() {
    const minutesRead = Number(form.minutesRead)
    const pagesRead = Number(form.pagesRead)
    const currentPage = form.currentPage.trim() === '' ? null : Number(form.currentPage)

    if (!form.bookId) {
      setFormError('Please select a book.')
      return
    }
    if (!form.readingDate) {
      setFormError('Please choose a reading date.')
      return
    }
    if (!Number.isInteger(minutesRead) || minutesRead < 1) {
      setFormError('Minutes read must be a positive whole number.')
      return
    }
    if (!Number.isInteger(pagesRead) || pagesRead < 0) {
      setFormError('Pages read must be zero or a positive whole number.')
      return
    }
    if (currentPage !== null && (!Number.isInteger(currentPage) || currentPage < 1)) {
      setFormError('Current page must be a positive whole number.')
      return
    }
    if (form.notes.length > 500) {
      setFormError('Notes cannot exceed 500 characters.')
      return
    }

    setSaving(true)
    setFormError('')
    setNotice('')
    try {
      const payload = {
        ...(editingId ? {} : { bookId: form.bookId }),
        readingDate: new Date(`${form.readingDate}T12:00:00`).toISOString(),
        minutesRead,
        pagesRead,
        currentPage,
        notes: form.notes.trim()
      }
      const response = await fetch(
        editingId
          ? `${API_URL}/api/me/reading-sessions/${editingId}`
          : `${API_URL}/api/me/reading-sessions`,
        {
          method: editingId ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      )
      if (response.status === 401) {
        setAuthRequired(true)
        throw new Error('Session expired. Please log in again.')
      }
      if (!response.ok) throw new Error(await responseError(response))

      const saved: { data: ReadingSession } = await response.json()
      // Response from POST/PATCH may have an unpopulated bookId; bookOf()
      // resolves its title against the already-loaded catalog.
      setSessions((current) => editingId
        ? current.map((entry) => entry._id === editingId ? saved.data : entry)
        : [saved.data, ...current]
      )
      setNotice(editingId ? 'Reading session updated.' : 'Reading session added.')
      setFormOpen(false)
      setEditingId(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save your session.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSession(session: ReadingSession) {
    const book = bookOf(session, books)
    if (!window.confirm(`Delete your reading session for "${book?.title || 'this book'}"? This cannot be undone.`)) return

    setDeletingId(session._id)
    setPageError('')
    setNotice('')
    try {
      const response = await fetch(`${API_URL}/api/me/reading-sessions/${session._id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (response.status === 401) {
        setAuthRequired(true)
        throw new Error('Session expired. Please log in again.')
      }
      if (!response.ok) throw new Error(await responseError(response))
      setSessions((current) => current.filter((entry) => entry._id !== session._id))
      setNotice('Reading session deleted.')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not delete this session.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <section className="journal-page"><p role="status">Loading your reading journal...</p></section>
  }

  if (authRequired) {
    return (
      <section className="journal-page journal-state">
        <BookOpen size={35} aria-hidden="true" />
        <h1>Your Reading Journal</h1>
        <p>Log in to view and manage your own reading sessions.</p>
        <Link className="journal-primary" to="/login">Log in to Chapterly</Link>
      </section>
    )
  }

  if (pageError && books.length === 0 && sessions.length === 0) {
    return <section className="journal-page"><p className="journal-error" role="alert">{pageError}</p></section>
  }

  return (
    <section className="journal-page">
      <div className="journal-heading">
        <div>
          <p className="journal-eyebrow">YOUR READING SPACE</p>
          <h1>Reading Journal</h1>
          <p>Track the pages, minutes and moments that make up your reading journey.</p>
        </div>
        <button type="button" className="journal-primary" onClick={newSession}>
          <Plus size={17} aria-hidden="true" /> Log Reading
        </button>
      </div>

      <div className="journal-stats">
        <div><span>Total sessions</span><strong>{sessions.length}</strong></div>
        <div><span>Reading time</span><strong>{totals.minutes.toLocaleString()} <small>min</small></strong></div>
        <div><span>Pages read</span><strong>{totals.pages.toLocaleString()}</strong></div>
      </div>

      {notice && <p className="journal-success" role="status">{notice}</p>}
      {pageError && <p className="journal-error" role="alert">{pageError}</p>}

      {formOpen && (
        <form className="journal-form" onSubmit={(event) => { event.preventDefault(); void saveSession() }}>
          <div className="journal-form-top">
            <div>
              <h2>{editingId ? 'Edit reading session' : 'Log a reading session'}</h2>
              <p>Only you can view and manage the sessions in your journal.</p>
            </div>
            <button type="button" className="journal-icon-button" onClick={closeForm} aria-label="Close form" disabled={saving}>
              <X size={19} aria-hidden="true" />
            </button>
          </div>

          <div className="journal-form-grid">
            <label className="journal-field journal-wide">
              <span>Book <em>*</em></span>
              <select required disabled={Boolean(editingId) || saving} value={form.bookId}
                onChange={(event) => setForm((old) => ({ ...old, bookId: event.target.value }))}>
                <option value="">Choose a book</option>
                {books.map((book) => <option value={book._id} key={book._id}>{book.title}</option>)}
              </select>
            </label>

            <label className="journal-field">
              <span>Reading date <em>*</em></span>
              <input required type="date" value={form.readingDate} disabled={saving}
                onChange={(event) => setForm((old) => ({ ...old, readingDate: event.target.value }))} />
            </label>

            <label className="journal-field">
              <span>Minutes read <em>*</em></span>
              <input required type="number" min={1} step={1} value={form.minutesRead} disabled={saving}
                onChange={(event) => setForm((old) => ({ ...old, minutesRead: event.target.value }))} />
            </label>

            <label className="journal-field">
              <span>Pages read</span>
              <input type="number" min={0} step={1} value={form.pagesRead} disabled={saving}
                onChange={(event) => setForm((old) => ({ ...old, pagesRead: event.target.value }))} />
            </label>

            <label className="journal-field">
              <span>Current page (optional)</span>
              <input type="number" min={1} step={1} placeholder="e.g. 124" value={form.currentPage} disabled={saving}
                onChange={(event) => setForm((old) => ({ ...old, currentPage: event.target.value }))} />
            </label>

            <label className="journal-field journal-wide">
              <span>Notes (optional)</span>
              <textarea rows={3} maxLength={500} placeholder="What did you think about today's reading?"
                value={form.notes} disabled={saving}
                onChange={(event) => setForm((old) => ({ ...old, notes: event.target.value }))} />
              <small>{form.notes.length} / 500 characters</small>
            </label>
          </div>

          {formError && <p className="journal-error" role="alert">{formError}</p>}

          <div className="journal-form-actions">
            <button type="button" className="journal-secondary" onClick={closeForm} disabled={saving}>Cancel</button>
            <button type="submit" className="journal-primary" disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Save Session'}
            </button>
          </div>
        </form>
      )}

      <div className="journal-list-heading">
        <div>
          <h2>Reading history</h2>
          <p>{sessions.length} sessions in your journal</p>
        </div>
        <input aria-label="Search reading history" type="search" placeholder="Search books or notes..."
          value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {displayedSessions.length === 0 ? (
        <div className="journal-empty">
          <BookOpen size={32} aria-hidden="true" />
          <h3>{search ? 'No matching sessions' : 'Your journal starts here'}</h3>
          <p>{search ? 'Try a different search term.' : 'Log your first reading session to start tracking your progress.'}</p>
          {!search && !formOpen && <button type="button" className="journal-primary" onClick={newSession}>Log your first session</button>}
        </div>
      ) : (
        <div className="journal-session-list">
          {displayedSessions.map((session) => {
            const book = bookOf(session, books)
            const isDemo = session.notes.startsWith('[DEMO DATA]')
            const notesText = isDemo ? session.notes.replace(/^\[DEMO DATA\]\s*/, '') : session.notes
            return (
              <article className="journal-session" key={session._id}>
                <div className="journal-cover" aria-hidden="true">
                  {book?.coverUrl ? <img src={book.coverUrl} alt="" /> : <BookOpen size={25} />}
                </div>
                <div className="journal-session-body">
                  <div className="journal-session-title-row">
                    <div>
                      <h3>{book?.title || 'Book unavailable'}</h3>
                      <span className="journal-date"><CalendarDays size={13} aria-hidden="true" /> {readableDate(session.readingDate)}</span>
                    </div>
                    {isDemo && <span className="journal-demo">Demo data</span>}
                  </div>
                  <div className="journal-metrics">
                    <span><Clock3 size={15} aria-hidden="true" /> {session.minutesRead} min</span>
                    <span><BookOpen size={15} aria-hidden="true" /> {session.pagesRead} pages</span>
                    {session.currentPage != null && <span>Current page {session.currentPage}</span>}
                  </div>
                  {notesText && <p className="journal-note">{notesText}</p>}
                </div>
                <div className="journal-actions">
                  <button type="button" onClick={() => editSession(session)} aria-label={`Edit ${book?.title || 'reading'} session`} title="Edit session">
                    <FilePenLine size={17} aria-hidden="true" />
                  </button>
                  <button type="button" className="journal-danger" disabled={deletingId === session._id}
                    onClick={() => { void deleteSession(session) }} aria-label={`Delete ${book?.title || 'reading'} session`} title="Delete session">
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
