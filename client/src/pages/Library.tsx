
import { useEffect, useState } from 'react'
import './Library.css'

const API_URL = 'http://localhost:5050'

type Bookshelf = {
  _id: string
  name: string
  isSystem: boolean
}

type SavedBook = {
  _id: string
  title: string
  coverUrl?: string
  publicationYear?: number
}

type ShelfEntry = {
  _id: string
  shelfId: string
  bookId: SavedBook | null
}

type ShelvesResponse = {
  data: Bookshelf[]
}

type EntriesResponse = {
  data: {
    entries: ShelfEntry[]
  }
}

// Fetch data from our Express backend.
async function getData<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include'
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.error?.message || 'Could not load your library.'
    )
  }

  return result as T
}

export default function Library() {
  const [shelves, setShelves] = useState<Bookshelf[]>([])

  const [booksByShelf, setBooksByShelf] = useState<
    Record<string, ShelfEntry[]>
  >({})

  const [activeShelfId, setActiveShelfId] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')

  const [movingEntryId, setMovingEntryId] = useState('')
  const [deletingEntryId, setDeletingEntryId] = useState('')

  // Load the reader's bookshelves and saved books.
  useEffect(() => {
    let cancelled = false

    async function loadLibrary() {
      try {
        setLoading(true)
        setError('')

        const shelvesResult = await getData<ShelvesResponse>(
          '/api/me/bookshelves'
        )

        const shelfOrder = [
          'Currently Reading',
          'Want to Read',
          'Read'
        ]

        // Keep the three main shelves in a consistent order.
        const orderedShelves = [...shelvesResult.data].sort(
          (a, b) => {
            const aIndex = shelfOrder.indexOf(a.name)
            const bIndex = shelfOrder.indexOf(b.name)

            return (
              (aIndex === -1 ? 99 : aIndex) -
              (bIndex === -1 ? 99 : bIndex)
            )
          }
        )

        // Fetch the saved books for each bookshelf.
        const shelfResults = await Promise.all(
          orderedShelves.map(async (shelf) => {
            const result = await getData<EntriesResponse>(
              `/api/me/bookshelves/${shelf._id}/books`
            )

            return {
              shelfId: shelf._id,
              entries: result.data.entries
            }
          })
        )

        if (cancelled) return

        // Store the entries according to their bookshelf.
        const groupedBooks: Record<string, ShelfEntry[]> = {}

        for (const shelf of shelfResults) {
          groupedBooks[shelf.shelfId] = shelf.entries
        }

        setShelves(orderedShelves)
        setBooksByShelf(groupedBooks)

        // Open Currently Reading by default.
        const firstShelf =
          orderedShelves.find(
            (shelf) => shelf.name === 'Currently Reading'
          ) || orderedShelves[0]

        setActiveShelfId(firstShelf?._id || '')

      } catch (err) {
        if (cancelled) return

        setError(
          err instanceof Error
            ? err.message
            : 'Could not load your library.'
        )

      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadLibrary()

    return () => {
      cancelled = true
    }
  }, [])

  // Find the selected bookshelf and its saved books.
  const activeShelf = shelves.find(
    (shelf) => shelf._id === activeShelfId
  )

  const savedEntries = booksByShelf[activeShelfId] || []

  const actionInProgress = Boolean(
    movingEntryId || deletingEntryId
  )

  // Move a book to a different reading-status shelf.
  async function moveBook(
    entry: ShelfEntry,
    targetShelfId: string
  ) {
    const sourceShelfId = entry.shelfId

    if (
      sourceShelfId === targetShelfId ||
      actionInProgress
    ) {
      return
    }

    setMovingEntryId(entry._id)
    setActionError('')

    try {
      const response = await fetch(
        `${API_URL}/api/me/bookshelves/${sourceShelfId}/books/${entry._id}/move`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            targetShelfId
          })
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error?.message || 'Could not move this book.'
        )
      }

      // Update both shelves after MongoDB confirms the move.
      setBooksByShelf((current) => ({
        ...current,

        [sourceShelfId]: (
          current[sourceShelfId] || []
        ).filter(
          (item) => item._id !== entry._id
        ),

        [targetShelfId]: [
          {
            ...entry,
            shelfId: targetShelfId
          },
          ...(current[targetShelfId] || []).filter(
            (item) => item._id !== entry._id
          )
        ]
      }))

    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Could not update the reading status.'
      )

    } finally {
      setMovingEntryId('')
    }
  }

  // Remove a saved book without deleting it from the catalog.
  async function removeBook(entry: ShelfEntry) {
    if (actionInProgress) return

    const confirmed = window.confirm(
      'Remove this book from your library?'
    )

    if (!confirmed) return

    const shelfId = entry.shelfId

    setDeletingEntryId(entry._id)
    setActionError('')

    try {
      const response = await fetch(
        `${API_URL}/api/me/bookshelves/${shelfId}/books/${entry._id}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error?.message || 'Could not remove this book.'
        )
      }

      // Remove the entry from React after successful deletion.
      setBooksByShelf((current) => ({
        ...current,
        [shelfId]: (current[shelfId] || []).filter(
          (item) => item._id !== entry._id
        )
      }))

    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Could not remove this book.'
      )

    } finally {
      setDeletingEntryId('')
    }
  }

  return (
    <main className="library-page">

      {/* Library heading */}
      <header className="library-header">
        <p className="library-eyebrow">
          YOUR READING SPACE
        </p>

        <h1>My Library</h1>

        <p>
          Every story has a place. Keep track of yours here.
        </p>
      </header>

      {/* Loading state */}
      {loading && (
        <p className="library-message">
          Loading your books...
        </p>
      )}

      {/* Error while loading books */}
      {error && (
        <div
          className="library-message library-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <>

          {/* Bookshelf tabs */}
          <div className="library-tabs" role="tablist">

            {shelves.map((shelf) => (
              <button
                key={shelf._id}
                type="button"
                role="tab"
                aria-selected={activeShelfId === shelf._id}
                className={
                  activeShelfId === shelf._id
                    ? 'library-tab active'
                    : 'library-tab'
                }
                onClick={() => {
                  setActiveShelfId(shelf._id)
                  setActionError('')
                }}
              >
                <span>
                  {shelf.name}
                </span>

                <span className="library-tab-count">
                  {booksByShelf[shelf._id]?.length || 0}
                </span>
              </button>
            ))}

          </div>

          {/* Books inside the selected bookshelf */}
          <section className="library-content">

            {/* Show errors from moving or removing books */}
            {actionError && (
              <p
                className="library-message library-error"
                role="alert"
              >
                {actionError}
              </p>
            )}

            <div className="library-section-heading">
              <h2>
                {activeShelf?.name || 'Your Books'}
              </h2>

              <span>
                {savedEntries.length}{' '}
                {savedEntries.length === 1
                  ? 'book'
                  : 'books'}
              </span>
            </div>

            {/* Show a message when the shelf is empty */}
            {savedEntries.length === 0 ? (
              <div className="library-empty">
                <h3>No books here yet.</h3>

                <p>
                  Explore the catalog and start building
                  your reading collection.
                </p>

                <a href="/discover">
                  Discover Books
                </a>
              </div>
            ) : (

              /* Display all saved books */
              <div className="library-book-grid">

                {savedEntries.map((entry) => {
                  const book = entry.bookId

                  if (!book) return null

                  return (
                    <div
                      key={entry._id}
                      className="library-book-card"
                    >

                      {/* Book details link */}
                      <a
                        href={`/books/${book._id}`}
                        className="library-book-link"
                      >
                        {book.coverUrl ? (
                          <img
                            src={book.coverUrl}
                            alt={`Cover of ${book.title}`}
                            loading="lazy"
                          />
                        ) : (
                          <div className="library-no-cover">
                            No Cover
                          </div>
                        )}

                        <h3>
                          {book.title}
                        </h3>

                        {book.publicationYear && (
                          <p>
                            Published in {book.publicationYear}
                          </p>
                        )}
                      </a>

                      {/* Reading-status dropdown */}
                      <div className="library-status-control">

                        <label htmlFor={`status-${entry._id}`}>
                          Reading Status
                        </label>

                        <select
                          id={`status-${entry._id}`}
                          value={entry.shelfId}
                          disabled={actionInProgress}
                          onChange={(event) => {
                            moveBook(entry, event.target.value)
                          }}
                        >
                          {shelves
                            .filter(
                              (shelf) =>
                                shelf.isSystem ||
                                shelf._id === entry.shelfId
                            )
                            .map((shelf) => (
                              <option
                                key={shelf._id}
                                value={shelf._id}
                              >
                                {shelf.name}
                              </option>
                            ))}
                        </select>

                      </div>

                      {/* Moving state */}
                      {movingEntryId === entry._id && (
                        <p className="library-moving">
                          Updating status...
                        </p>
                      )}

                      {/* Remove book button */}
                      <button
                        type="button"
                        className="library-remove-button"
                        disabled={actionInProgress}
                        onClick={() => removeBook(entry)}
                      >
                        {deletingEntryId === entry._id
                          ? 'Removing...'
                          : 'Remove from Library'}
                      </button>

                    </div>
                  )
                })}

              </div>
            )}

          </section>
        </>
      )}

    </main>
  )
}
