
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import './BookDetails.css'

// Structure of a book received from MongoDB
type Book = {
  _id: string
  title: string
  description?: string
  publicationYear?: number
  language?: string
  coverUrl?: string

  // A book can belong to multiple genres
  // Each genre has its own MongoDB ID and name
  genreIds?: {
    _id: string
    name: string
  }[]
}

function BookDetails() {
  // Get the book ID from the URL
  const { id } = useParams()

  // Store the selected book and its loading status
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Get the selected book's details from our Express API
    fetch(`http://localhost:5050/api/books/${id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Book not found')
        }

        return response.json()
      })
      .then((result) => {
        // Save the book information received from MongoDB
        setBook(result.data)
      })
      .catch(() => {
        setError('Could not load this book.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id])

  // Show a message while the book is loading
  if (loading) {
    return <p>Loading book details...</p>
  }

  // Handle missing books or failed requests
  if (error || !book) {
    return (
      <div>
        <h2>Book not found</h2>
        <p>{error || 'This book is unavailable.'}</p>
        <Link to="/discover">Back to Discover</Link>
      </div>
    )
  }

  return (
    <div className="book-details">

      {/* Link back to the Discover page */}
      <Link to="/discover" className="back-link">
        ← Back to Discover
      </Link>

      <div className="book-details-layout">

        {/* Book cover section */}
        <div className="detail-cover">
          <span>✦</span>

          {/* Fallback design if the book has no cover image */}
          <div>
            <h3>{book.title}</h3>
          </div>

          {/* Display the actual book cover from MongoDB */}
          {book.coverUrl && (
            <img
              src={book.coverUrl}
              alt={`Cover of ${book.title}`}
              className="detail-cover-image"
              onError={(e) => {
                // Hide broken images to reveal the fallback design
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
        </div>

        {/* Book information section */}
        <div className="detail-info">

          {/* Display the book's language */}
          <span className="detail-genre">
            {book.language?.toUpperCase() || 'Unknown'}
          </span>

          {/* Book title */}
          <h2>{book.title}</h2>

          {/* Publication year */}
          <p className="detail-author">
            Published: {book.publicationYear || 'Unknown'}
          </p>

          {/* Display the genres linked to this book */}
          
          {book.genreIds && book.genreIds.length > 0 && (
            <div className="book-details-genres">

              {/* Create a badge for each genre */}
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

          {/* Book description */}
          <h3>About this book</h3>

          <p>
            {book.description || 'No description available yet.'}
          </p>

        </div>

      </div>
    </div>
  )
}

export default BookDetails
