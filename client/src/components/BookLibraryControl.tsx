
import { useEffect, useState } from 'react'
import './BookLibraryControl.css'

const API_URL = 'http://localhost:5050'

type Bookshelf = {
  _id: string
  name: string
  isSystem: boolean
}

type ShelfEntry = {
  _id: string
  shelfId: string
  bookId: {
    _id: string
  } | null
}

type SavedLocation = {
  entryId: string
  shelfId: string
}

type ApiError = Error & {
  status?: number
}

// Send requests to our Express backend.
async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include'
  })

  const result = await response.json()

  if (!response.ok) {
    const error = new Error(
      result.error?.message || 'Something went wrong.'
    ) as ApiError

    error.status = response.status
    throw error
  }

  return result as T
}

export default function BookLibraryControl() {

  // Get the book ID from the URL, such as /books/123.
  const pathParts = window.location.pathname
    .split('/')
    .filter(Boolean)

  const bookId = pathParts[0] === 'books'
    ? pathParts[1]
    : ''

  const [shelves, setShelves] = useState<Bookshelf[]>([])
  const [selectedShelfId, setSelectedShelfId] = useState('')

  const [savedLocation, setSavedLocation] =
    useState<SavedLocation | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loginRequired, setLoginRequired] = useState(false)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Load the reader's bookshelves and check the book's status.
  useEffect(() => {
    let cancelled = false

    async function loadBookStatus() {
      if (!bookId) {
        setError('Could not identify this book.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        setMessage('')
        setLoginRequired(false)

        // Get the bookshelves belonging to the reader.
        const shelfResult = await apiRequest<{
          data: Bookshelf[]
        }>('/api/me/bookshelves')

        const shelfOrder = [
          'Want to Read',
          'Currently Reading',
          'Read'
        ]

        // Only show the three default reading-status shelves.
        const systemShelves = shelfResult.data
          .filter((shelf) => shelf.isSystem)
          .sort((a, b) => {
            return (
              shelfOrder.indexOf(a.name) -
              shelfOrder.indexOf(b.name)
            )
          })

        // Retrieve the books saved on each shelf.
        const results = await Promise.all(
          systemShelves.map(async (shelf) => {
            const response = await apiRequest<{
              data: {
                entries: ShelfEntry[]
              }
            }>(
              `/api/me/bookshelves/${shelf._id}/books`
            )

            return {
              shelf,
              entries: response.data.entries
            }
          })
        )

        if (cancelled) return

        // Find out whether this book is already saved.
        let existingLocation: SavedLocation | null = null

        for (const result of results) {
          const existingEntry = result.entries.find(
            (entry) => entry.bookId?._id === bookId
          )

          if (existingEntry) {
            existingLocation = {
              entryId: existingEntry._id,
              shelfId: result.shelf._id
            }

            break
          }
        }

        setShelves(systemShelves)
        setSavedLocation(existingLocation)

        // Select the existing status or default to Want to Read.
        const defaultShelf = systemShelves.find(
          (shelf) => shelf.name === 'Want to Read'
        )

        const initialShelfId = existingLocation
          ? existingLocation.shelfId
          : defaultShelf?._id || systemShelves[0]?._id || ''

        setSelectedShelfId(initialShelfId)

      } catch (err) {
        if (cancelled) return

        const requestError = err as ApiError

        if (requestError.status === 401) {
          setLoginRequired(true)
        } else {
          setError(
            requestError.message || 'Could not load your library.'
          )
        }

      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadBookStatus()

    return () => {
      cancelled = true
    }
  }, [bookId])

  // Add the book to the library or update its reading status.
  async function saveBook() {
    if (!bookId || !selectedShelfId || saving) return

    // Do nothing if the book already has the selected status.
    if (savedLocation?.shelfId === selectedShelfId) {
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {

      if (savedLocation) {

        // Move an existing book to another bookshelf.
        await apiRequest(
          `/api/me/bookshelves/${savedLocation.shelfId}/books/${savedLocation.entryId}/move`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              targetShelfId: selectedShelfId
            })
          }
        )

        // Update the status displayed on the page.
        setSavedLocation({
          entryId: savedLocation.entryId,
          shelfId: selectedShelfId
        })

        setMessage('Reading status updated successfully.')

      } else {

        // Create a new ShelfEntry in MongoDB.
        const result = await apiRequest<{
          data: {
            _id: string
          }
        }>(
          `/api/me/bookshelves/${selectedShelfId}/books`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              bookId
            })
          }
        )

        // Remember the new entry and its bookshelf.
        setSavedLocation({
          entryId: result.data._id,
          shelfId: selectedShelfId
        })

        setMessage('Book added to your library!')
      }

    } catch (err) {
      const requestError = err as ApiError

      if (requestError.status === 401) {
        setLoginRequired(true)
      } else {
        setError(
          requestError.message || 'Could not save this book.'
        )
      }

    } finally {
      setSaving(false)
    }
  }

  // Find the bookshelf containing this book.
  const currentShelf = shelves.find(
    (shelf) => shelf._id === savedLocation?.shelfId
  )

  const alreadySelected =
    savedLocation !== null &&
    savedLocation.shelfId === selectedShelfId

  return (
    <section className="book-library-control">

      <h2>Add to Library</h2>

      {loading ? (

        <p className="book-library-message">
          Checking your library...
        </p>

      ) : loginRequired ? (

        <div className="book-library-message">
          <p>
            Log in to save this book to your library.
          </p>

          <a
            href="/login"
            className="book-library-button"
          >
            Log In
          </a>
        </div>

      ) : error && shelves.length === 0 ? (

        <p
          className="book-library-error"
          role="alert"
        >
          {error}
        </p>

      ) : (

        <>

          {/* Show whether the book is already saved. */}
          {savedLocation ? (

            <p className="book-library-message">
              Currently saved under{' '}
              <strong>
                {currentShelf?.name}
              </strong>.
            </p>

          ) : (

            <p className="book-library-message">
              Choose where you'd like to save this book.
            </p>

          )}

          {/* Reading status dropdown */}
          <label htmlFor="book-reading-status">
            Reading Status
          </label>

          <select
            id="book-reading-status"
            value={selectedShelfId}
            disabled={saving}
            onChange={(event) => {
              setSelectedShelfId(event.target.value)
              setError('')
              setMessage('')
            }}
          >
            {shelves.map((shelf) => (

              <option
                key={shelf._id}
                value={shelf._id}
              >
                {shelf.name}
              </option>

            ))}
          </select>

          {/* Add book or update reading status */}
          <button
            type="button"
            className="book-library-button"
            onClick={saveBook}
            disabled={
              saving ||
              !selectedShelfId ||
              alreadySelected
            }
          >
            {saving
              ? 'Saving...'
              : alreadySelected
                ? 'Saved to Library'
                : savedLocation
                  ? 'Update Reading Status'
                  : 'Add to Library'}
          </button>

          {/* Success message */}
          {message && (
            <p
              className="book-library-success"
              role="status"
            >
              {message}
            </p>
          )}

          {/* Error message */}
          {error && (
            <p
              className="book-library-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {/* Open My Library using a normal HTML link. */}
          {savedLocation && (
            <a
              href="/library"
              className="book-library-view"
            >
              View My Library
            </a>
          )}

        </>

      )}

    </section>
  )
}

