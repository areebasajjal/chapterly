
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
}

function BookDetails() {
  const { id } = useParams()

  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  
useEffect(() => {
  // Get the book details from our Express API
  fetch(`http://localhost:5050/api/books/${id}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Book not found')
      }

      return response.json()
    })
    .then((result) => {
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

      <Link to="/discover" className="back-link">
        ← Back to Discover
      </Link>

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
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
        </div>

        {/* Book information */}
        <div className="detail-info">

          <span className="detail-genre">
            {book.language?.toUpperCase() || 'Unknown'}
          </span>

          <h2>{book.title}</h2>

          <p className="detail-author">
            Published: {book.publicationYear || 'Unknown'}
          </p>

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
