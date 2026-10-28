
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import BookLibraryControl from '../components/BookLibraryControl'
import './BookDetails.css'

type Book = {
  _id: string
  title: string
  description?: string
  publicationYear?: number
  language?: string
  coverUrl?: string

  // Authors connected to this book.
  authorIds?: {
    _id: string
    name: string
  }[]

  // Genres connected to this book.
  genreIds?: {
    _id: string
    name: string
  }[]
}

function BookDetails() {
  // Get the book ID from the URL.
  const { id } = useParams()

  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Retrieve the selected book from MongoDB through Express.
  useEffect(() => {
    let cancelled = false

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

    loadBook()

    return () => {
      cancelled = true
    }
  }, [id])

  // Show a message while the book is loading.
  if (loading) {
    return (
      <div className="book-details">
        <p>Loading book details...</p>
      </div>
    )
  }

  // Handle missing books or failed API requests.
  if (error || !book) {
    return (
      <div className="book-details">
        <h2>Book not found</h2>

        <p>
          {error || 'This book is unavailable.'}
        </p>

        <a href="/discover" className="back-link">
          ← Back to Discover
        </a>
      </div>
    )
  }

  return (
    <div className="book-details">

      {/* Return to the Discover page. */}
      <a href="/discover" className="back-link">
        ← Back to Discover
      </a>

      <div className="book-details-layout">

        {/* Book cover */}
        <div className="detail-cover">
          <span>✦</span>

          {/* Show the book title if no cover is available. */}
          <div>
            <h3>{book.title}</h3>
          </div>

          {/* Display the cover stored in MongoDB. */}
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

        {/* Book information */}
        <div className="detail-info">

          {/* Language */}
          <span className="detail-genre">
            {book.language?.toUpperCase() || 'Unknown'}
          </span>

          {/* Book title */}
          <h2>{book.title}</h2>

          {/* Authors */}
          <p className="detail-book-author">
            {book.authorIds
              ?.map((author) => author.name)
              .join(', ') || 'Author unavailable'}
          </p>

          {/* Publication year */}
          <p className="detail-author">
            Published: {book.publicationYear || 'Unknown'}
          </p>

          {/* Genres */}
          {book.genreIds && book.genreIds.length > 0 && (
            <div className="book-details-genres">
              {book.genreIds.map((genre) => (
                <span
                  key={genre._id}
                  className="book-details-genre-badge"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          )}

          {/* Book description */}
          <h3>About this book</h3>

          <p>
            {book.description ||
              'No description available yet.'}
          </p>

          {/* Save the book to the reader's personal library. */}
          <BookLibraryControl />

        </div>

      </div>
    </div>
  )
}

export default BookDetails

