
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

// Request data from our Express backend.
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

  useEffect(() => {
    let cancelled = false

    async function loadLibrary() {
      try {
        setLoading(true)
        setError('')

        // First retrieve the reader's bookshelves.
        const shelvesResult = await getData<ShelvesResponse>(
          '/api/me/bookshelves'
        )

        const shelfOrder = [
          'Currently Reading',
          'Want to Read',
          'Read'
        ]

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

        // Retrieve the saved books for every shelf.
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

        const groupedBooks: Record<string, ShelfEntry[]> = {}

        for (const shelf of shelfResults) {
          groupedBooks[shelf.shelfId] = shelf.entries
        }

        setShelves(orderedShelves)
        setBooksByShelf(groupedBooks)

        // Start by showing Currently Reading.
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
        if (!cancelled) setLoading(false)
      }
    }

    loadLibrary()

    return () => {
      cancelled = true
    }
  }, [])

  const activeShelf = shelves.find(
    (shelf) => shelf._id === activeShelfId
  )

  const savedEntries = booksByShelf[activeShelfId] || []

  return (
    <main className="library-page">
      <header className="library-header">
        <p className="library-eyebrow">YOUR READING SPACE</p>
        <h1>My Library</h1>
        <p>
          Every story has a place. Keep track of yours here.
        </p>
      </header>

      {loading && (
        <p className="library-message">
          Loading your books...
        </p>
      )}

      {error && (
        <div className="library-message library-error">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
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
                onClick={() => setActiveShelfId(shelf._id)}
              >
                <span>{shelf.name}</span>
                <span className="library-tab-count">
                  {booksByShelf[shelf._id]?.length || 0}
                </span>
              </button>
            ))}
          </div>

          <section className="library-content">
            <div className="library-section-heading">
              <h2>{activeShelf?.name || 'Your Books'}</h2>
              <span>
                {savedEntries.length} {
                  savedEntries.length === 1 ? 'book' : 'books'
                }
              </span>
            </div>

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
              <div className="library-book-grid">
                {savedEntries.map((entry) => {
                  const book = entry.bookId

                  if (!book) return null

                  return (
                    <a
                      href={`/books/${book._id}`}
                      key={entry._id}
                      className="library-book-card"
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

                      <h3>{book.title}</h3>

                      {book.publicationYear && (
                        <p>
                          Published in {book.publicationYear}
                        </p>
                      )}
                    </a>
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
