
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import './BookDetails.css'

type Book = {
  _id: string
  title: string
  description?: string
  publicationYear?: number
  language?: string
}

function BookDetails() {
  const { id } = useParams()
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
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

  if (loading) {
    return <p>Loading book details...</p>
  }

  if (error || !book) {
    return (
      <div>
        <h2>Book not found</h2>
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
        <div
          className="detail-cover"
          style={{ backgroundColor: '#56736B' }}
        >
          <span>✦</span>

          <div>
            <h3>{book.title}</h3>
          </div>
        </div>

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
