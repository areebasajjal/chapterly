
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import './Discover.css'

type Book = {
  _id: string
  title: string
  publicationYear?: number
  language?: string
}

const coverColors = [
  '#56736B',
  '#C6A1A0',
  '#BFA46E',
  '#8099A3',
  '#A87C83',
  '#B78960'
]

function Discover() {
  const [books, setBooks] = useState<Book[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('http://localhost:5050/api/books')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch books')
        }
        return response.json()
      })
      .then((result) => {
        setBooks(result.data)
      })
      .catch(() => {
        setError('Could not load books from MongoDB.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const filteredBooks = books.filter((book) =>
    book.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="discover">
      <div className="discover-heading">
        <h2>Find your next favorite book.</h2>
        <p>A little something for every kind of reader.</p>
      </div>

      <div className="discover-filters">
        <input
          type="search"
          placeholder="Search books..."
          aria-label="Search books"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <p>Loading books...</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && !error && (
        <>
          <p className="book-count">
            {filteredBooks.length} books found
          </p>

          <div className="book-grid">
            {filteredBooks.map((book, index) => (
              <div className="book-card" key={book._id}>
                <Link
                  to={`/books/${book._id}`}
                  className="book-cover"
                  style={{
                    backgroundColor:
                      coverColors[index % coverColors.length]
                  }}
                >
                  <span className="cover-symbol">✦</span>

                  <span className="cover-title">
                    {book.title}
                  </span>

                  <span className="cover-author">
                    {book.publicationYear || 'Chapterly'}
                  </span>
                </Link>

                <h3>{book.title}</h3>

                <p>
                  {book.publicationYear
                    ? `Published in ${book.publicationYear}`
                    : 'Publication year unavailable'}
                </p>

                <span className="genre-tag">
                  {book.language?.toUpperCase() || 'Unknown'}
                </span>
              </div>
            ))}
          </div>

          {filteredBooks.length === 0 && (
            <p className="empty-message">
              No books found. Try another search!
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default Discover
