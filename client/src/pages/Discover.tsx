
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import './Discover.css'

// This tells TypeScript what information each book contains
type Book = {
  _id: string
  title: string
  publicationYear?: number
  language?: string
  coverUrl?: string

  // Each book can belong to one or more genres
  // MongoDB gives us the genre ID and name
  genreIds: {
    _id: string
    name: string
  }[]
}

// Background colors used when a book has no cover image
const coverColors = [
  '#56736B',
  '#C6A1A0',
  '#BFA46E',
  '#8099A3',
  '#A87C83',
  '#B78960'
]

function Discover() {
  // Store the books we receive from MongoDB
  const [books, setBooks] = useState<Book[]>([])

  // Store what the user types in the search bar
  const [search, setSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load books from our Express backend when the page opens
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

  // Only show books whose titles match the search text
  const filteredBooks = books.filter((book) =>
    book.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="discover">

      <div className="discover-heading">
        <h2>Find your next favorite book.</h2>
        <p>A little something for every kind of reader.</p>
      </div>

      {/* Search bar */}
      <div className="discover-filters">
        <input
          type="search"
          placeholder="Search books..."
          aria-label="Search books"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Show a message while books are loading */}
      {loading && <p>Loading books...</p>}

      {/* Show an error if the database request fails */}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && (
        <>
          <p className="book-count">
            {filteredBooks.length} books found
          </p>

          <div className="book-grid">

            {/* Create a card for every book */}
            {filteredBooks.map((book, index) => (
              <div className="book-card" key={book._id}>

                {/* Clicking the cover opens the book details page */}
                <Link
                  to={`/books/${book._id}`}
                  className="book-cover"
                  aria-label={`View details for ${book.title}`}
                  style={{
                    backgroundColor:
                      coverColors[index % coverColors.length]
                  }}
                >

                  {/* Placeholder shown when no cover is available */}
                  <span className="cover-symbol">✦</span>
                  <span className="cover-title">{book.title}</span>

                  <span className="cover-author">
                    {book.publicationYear || 'Chapterly'}
                  </span>

                  {/* Show the cover image saved in MongoDB */}
                  {book.coverUrl && (
                    <img
                      src={book.coverUrl}
                      alt={`Cover of ${book.title}`}
                      className="book-cover-image"
                      loading="lazy"
                      onError={(e) => {
                        // Hide the image if its URL does not work
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                </Link>

                {/* Book title */}
                <h3>{book.title}</h3>

                {/* Publication year */}
                <p>
                  {book.publicationYear
                    ? `Published in ${book.publicationYear}`
                    : 'Publication year unavailable'}
                </p>

                {/* Display the genres linked to this book */}
                <div className="book-genres">
                  {book.genreIds?.map((genre) => (
                    <span
                      className="genre-badge"
                      key={genre._id}
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>

                {/* Keep the language tag we already had */}
                <span className="genre-tag">
                  {book.language?.toUpperCase() || 'Unknown'}
                </span>

              </div>
            ))}
          </div>

          {/* Show this when the search has no matching books */}
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