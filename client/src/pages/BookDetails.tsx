
import { Link, useParams } from 'react-router'
import { books } from '../data/books'
import './BookDetails.css'

function BookDetails() {
  const { id } = useParams()

  const book = books.find((item) => item.id === Number(id))

  if (!book) {
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
          style={{ backgroundColor: book.color }}
        >
          <span>✦</span>
          <div>
            <h3>{book.title}</h3>
            <p>{book.author}</p>
          </div>
        </div>

        <div className="detail-info">
          <span className="detail-genre">{book.genre}</span>

          <h2>{book.title}</h2>
          <p className="detail-author">by {book.author}</p>

          <h3>About this book</h3>
          <p>{book.description}</p>
        </div>
      </div>
    </div>
  )
}

export default BookDetails
