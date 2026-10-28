
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import BookLibraryControl from '../components/BookLibraryControl'
import './BookDetails.css'

import BookFeedback, {
  type BookFeedbackProps
} from '../components/BookFeedback'


// Publisher information connected to a book or edition.
type Publisher = {
  _id: string
  name: string
  country?: string
  website?: string
}

// Book information received from MongoDB.
type Book = {
  _id: string
  title: string
  description?: string
  publicationYear?: number
  language?: string
  coverUrl?: string

  authorIds?: {
    _id: string
    name: string
  }[]

  genreIds?: {
    _id: string
    name: string
  }[]

  publisherId?: Publisher | null

  ratings?: BookFeedbackProps['ratings']
reviews?: BookFeedbackProps['reviews']
}

// Edition information received from MongoDB.
type Edition = {
  _id: string
  isbn13?: string
  format: string
  publicationYear?: number
  language?: string
  pageCount?: number
  coverUrl?: string
  publisherId?: Publisher | null
}

// Display readable format names.
function formatEdition(format: string) {
  const formats: Record<string, string> = {
    hardcover: 'Hardcover',
    paperback: 'Paperback',
    ebook: 'Ebook',
    audiobook: 'Audiobook',
    other: 'Other'
  }

  return formats[format] || 'Unavailable'
}

function BookDetails() {
  // Get the selected book ID from the URL.
  const { id } = useParams()

  // Store book information.
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Store all editions connected to this book.
  const [editions, setEditions] = useState<Edition[]>([])
  const [editionsLoading, setEditionsLoading] = useState(true)
  const [editionsError, setEditionsError] = useState('')

  useEffect(() => {
    let cancelled = false

    // Retrieve the selected book and its publisher.
    async function loadBook() {
      try {
        setLoading(true)
        setError('')
        setBook(null)

        if (!id) {
          throw new Error('Book ID is missing.')
        }

        const response = await fetch(
          `http://localhost:5050/api/books/${id}`
        )

        if (!response.ok) {
          throw new Error('Book not found.')
        }

        const result = await response.json()

        if (!cancelled) {
          setBook(result.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load this book.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    // Retrieve editions and their publishers.
    async function loadEditions() {
      try {
        setEditionsLoading(true)
        setEditionsError('')
        setEditions([])

        if (!id) {
          throw new Error('Book ID is missing.')
        }

        const response = await fetch(
          `http://localhost:5050/api/books/${id}/editions`
        )

        if (!response.ok) {
          throw new Error('Could not load editions.')
        }

        const result = await response.json()

        if (!cancelled) {
          setEditions(
            Array.isArray(result.data) ? result.data : []
          )
        }
      } catch {
        if (!cancelled) {
          setEditionsError('Could not load edition information.')
        }
      } finally {
        if (!cancelled) {
          setEditionsLoading(false)
        }
      }
    }

    // Load book and edition information together.
    loadBook()
    loadEditions()

    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="book-details">
        <p>Loading book details...</p>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="book-details">
        <h2>Book not found</h2>

        <p>{error || 'This book is unavailable.'}</p>

        <a href="/discover" className="back-link">
          ← Back to Discover
        </a>
      </div>
    )
  }

  // Prefer the publisher linked to the book.
  // Use an edition's publisher if the book has none.
  const publisherName =
    book.publisherId?.name ||
    editions.find((edition) => edition.publisherId?.name)
      ?.publisherId?.name ||
    'Unavailable'

  return (
    <div className="book-details">

      {/* Back to Discover */}
      <a href="/discover" className="back-link">
        ← Back to Discover
      </a>

      <div className="book-details-layout">

        {/* Book cover */}
        <div className="detail-cover">
          <span>✦</span>

          <div>
            <h3>{book.title}</h3>
          </div>

          {book.coverUrl && (
            <img
              src={book.coverUrl}
              alt={`Cover of ${book.title}`}
              className="detail-cover-image"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          )}
        </div>

        {/* Book details */}
        <div className="detail-info">

          {/* Language */}
          <span className="detail-genre">
            {book.language?.toUpperCase() || 'Unknown'}
          </span>

          {/* Title */}
          <h2>{book.title}</h2>

          {/* Authors */}
          <p className="detail-book-author">
            {book.authorIds
              ?.map((author) => author.name)
              .join(', ') || 'Author unavailable'}
          </p>

          {/* Original publication year */}
          <p className="detail-author">
            Originally published:{' '}
            {book.publicationYear || 'Unavailable'}
          </p>

          {/* Genres */}
          {book.genreIds && book.genreIds.length > 0 && (
            <div className="book-details-genres">
              {book.genreIds.map((genre) => (
                <span
                  className="book-details-genre-badge"
                  key={genre._id}
                >
                  {genre.name}
                </span>
              ))}
            </div>
          )}

          {/* Publisher and edition details */}
          <h3>Publication Details</h3>

          <div className="publication-summary">

            <div className="publication-summary-item">
              <span>Publisher</span>
              <strong>{publisherName}</strong>
            </div>

            <div className="publication-summary-item">
              <span>Available Editions</span>
              <strong>
                {editionsLoading
                  ? 'Loading...'
                  : editionsError
                    ? 'Could not load'
                    : editions.length > 0
                      ? `${editions.length} ${
                          editions.length === 1
                            ? 'Edition'
                            : 'Editions'
                        }`
                      : 'Unavailable'}
              </strong>
            </div>

          </div>

          {/* Display imported editions */}
          {editionsLoading ? (
            <p className="edition-empty">
              Loading edition information...
            </p>
          ) : editionsError ? (
            <p className="edition-empty">
              {editionsError}
            </p>
          ) : editions.length === 0 ? (
            <p className="edition-empty">
              Edition information: Unavailable
            </p>
          ) : (
            <div className="book-editions-list">

              {editions.map((edition) => (
                <div
                  className="book-edition-card"
                  key={edition._id}
                >

                  <div className="book-edition-header">
                    <strong>
                      {formatEdition(edition.format)}
                    </strong>

                    <span>
                      {edition.publicationYear || 'Year unavailable'}
                    </span>
                  </div>

                  <div className="book-edition-grid">

                    <div>
                      <span>Publisher</span>
                      <strong>
                        {edition.publisherId?.name ||
                          'Unavailable'}
                      </strong>
                    </div>

                    <div>
                      <span>ISBN-13</span>
                      <strong>
                        {edition.isbn13 || 'Unavailable'}
                      </strong>
                    </div>

                    <div>
                      <span>Pages</span>
                      <strong>
                        {edition.pageCount ?? 'Unavailable'}
                      </strong>
                    </div>

                    <div>
                      <span>Language</span>
                      <strong>
                        {edition.language &&
                        edition.language !== 'Unknown'
                          ? edition.language
                          : 'Unavailable'}
                      </strong>
                    </div>

                  </div>
                </div>
              ))}

            </div>
          )}

          {/* Book description */}
          <h3>About this book</h3>

          <p>
            {book.description ||
              'No description available yet.'}
          </p>

                <BookFeedback
        ratings={book.ratings}
        reviews={book.reviews}
      />


<Link
  to={`/books/${book._id}/quotes`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginTop: '20px',
              padding: '12px 20px',
              backgroundColor: '#294A3D',
              color: '#FFFFFF',
              borderRadius: '20px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'background-color 0.2s ease'
            }}
>
  <span aria-hidden="true">❝</span>
  View Quotes & Highlights
  <span aria-hidden="true">❝</span>
</Link>

                {/* Existing Add to Library functionality */}
          <BookLibraryControl />

        </div>
      </div>
    </div>
  )
}

export default BookDetails
