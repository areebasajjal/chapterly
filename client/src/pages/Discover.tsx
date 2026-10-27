
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import './Discover.css'

// Define the information we receive for each book
type Book = {
  _id: string
  title: string
  publicationYear?: number
  language?: string
  coverUrl?: string

  // Authors connected to this book in MongoDB
  authorIds?: {
    _id: string
    name: string
  }[]

  // Genres connected to this book in MongoDB
  genreIds?: {
    _id: string
    name: string
  }[]
}

// Define the information we receive for each genre
type Genre = {
  _id: string
  name: string
}

// Background colors used if a book cover is unavailable
const coverColors = [
  '#56736B',
  '#C6A1A0',
  '#BFA46E',
  '#8099A3',
  '#A87C83',
  '#B78960'
]

function Discover() {
  // Store the books retrieved from MongoDB
  const [books, setBooks] = useState<Book[]>([])

  // Store the available genres for our dropdown
  const [genres, setGenres] = useState<Genre[]>([])

  // Store the text entered in the search bar
  const [search, setSearch] = useState('')

  // Store the selected genre's MongoDB ID
  // An empty string means we want all genres
  const [selectedGenre, setSelectedGenre] = useState('')

  // Track loading and error messages
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [genreError, setGenreError] = useState('')

  // --------------------------------------------------
  // LOAD GENRES FROM MONGODB
  // --------------------------------------------------

  // Get all genres once when the Discover page opens
  useEffect(() => {
    const controller = new AbortController()

    fetch('http://localhost:5050/api/genres', {
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch genres')
        }

        return response.json()
      })
      .then((result) => {
        // Save the genres so they appear in our dropdown
        if (!controller.signal.aborted) {
          setGenres(result.data)
        }
      })
      .catch((error) => {
        // Ignore requests cancelled when the page closes
        if (error.name !== 'AbortError') {
          setGenreError('Could not load genre options.')
        }
      })

    return () => controller.abort()
  }, [])

  // --------------------------------------------------
  // LOAD BOOKS AND APPLY GENRE FILTERING
  // --------------------------------------------------

  // Run this whenever the selected genre changes
  useEffect(() => {
    // Cancel an old request if the user switches genres
    const controller = new AbortController()

    // No selected genre means we request all books
    // Otherwise, we send the genre ID to Express
    const url = selectedGenre
      ? `http://localhost:5050/api/books?genre=${selectedGenre}`
      : 'http://localhost:5050/api/books'

    fetch(url, {
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch books')
        }

        return response.json()
      })
      .then((result) => {
        // MongoDB has already filtered the books by genre
        if (!controller.signal.aborted) {
          setBooks(result.data)
        }
      })
      .catch((error) => {
        // Do not show an error for intentionally cancelled requests
        if (error.name !== 'AbortError') {
          setError('Could not load books from MongoDB.')
        }
      })
      .finally(() => {
        // Finish loading only if this request was not cancelled
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    // Clean up the previous request when the genre changes
    return () => controller.abort()
  }, [selectedGenre])

  // --------------------------------------------------
  // SEARCH BOOKS BY TITLE
  // --------------------------------------------------

  // Search within the books returned by our backend
  // Genre filtering happens in MongoDB, but title
  // searching currently happens here in React
  const filteredBooks = books.filter((book) =>
    book.title.toLowerCase().includes(search.toLowerCase())
  )

  // --------------------------------------------------
  // DISPLAY THE DISCOVER PAGE
  // --------------------------------------------------

  return (
    <div className="discover">

      {/* Page heading */}
      <div className="discover-heading">
        <h2>Find your next favorite book.</h2>
        <p>A little something for every kind of reader.</p>
      </div>

      {/* Search bar and genre dropdown */}
      <div className="discover-filters">

        {/* Search books by their titles */}
        <input
          type="search"
          placeholder="Search books..."
          aria-label="Search books"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Filter books using genres stored in MongoDB */}
        <select
          className="genre-select"
          aria-label="Filter books by genre"
          value={selectedGenre}
          onChange={(e) => {
            // Save the genre the user selected
            setSelectedGenre(e.target.value)

            // Show loading while the new books are requested
            setLoading(true)

            // Clear any error from the previous request
            setError('')
          }}
        >
          {/* Empty value means no genre filter */}
          <option value="">All Genres</option>

          {/* Create an option for every genre in MongoDB */}
          {genres.map((genre) => (
            <option
              key={genre._id}
              value={genre._id}
            >
              {genre.name}
            </option>
          ))}
        </select>

      </div>

      {/* Show an error if genres cannot be retrieved */}
      {genreError && (
        <p role="alert">{genreError}</p>
      )}

      {/* Show a message while books are being loaded */}
      {loading && <p>Loading books...</p>}

      {/* Show an error if the books request fails */}
      {error && <p role="alert">{error}</p>}

      {/* Display books only when loading has finished */}
      {!loading && !error && (
        <>

          {/* Number of books matching the current filters */}
          <p className="book-count">
            {filteredBooks.length} books found
          </p>

          <div className="book-grid">

            {/* Create one card for every matching book */}
            {filteredBooks.map((book, index) => (
              <div
                className="book-card"
                key={book._id}
              >

                {/* Clicking the cover opens the book details */}
                <Link
                  to={`/books/${book._id}`}
                  className="book-cover"
                  aria-label={`View details for ${book.title}`}
                  style={{
                    backgroundColor:
                      coverColors[index % coverColors.length]
                  }}
                >

                  {/* Placeholder if the book has no cover image */}
                  <span className="cover-symbol">✦</span>

                  <span className="cover-title">
                    {book.title}
                  </span>

                  <span className="cover-author">
                    {book.publicationYear || 'Chapterly'}
                  </span>

                  {/* Show the actual cover stored in MongoDB */}
                  {book.coverUrl && (
                    <img
                      src={book.coverUrl}
                      alt={`Cover of ${book.title}`}
                      className="book-cover-image"
                      loading="lazy"
                      onError={(e) => {
                        // Hide broken covers to reveal the placeholder
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}

                </Link>

                {/* Book title */}
                <h3>{book.title}</h3>

                {/* Display the names of the book's authors */}
                <p className="book-author">
                  {book.authorIds
                    ?.map((author) => author.name)
                    .join(', ') || 'Author unavailable'}
                </p>

                {/* Publication year */}
                <p>
                  {book.publicationYear
                    ? `Published in ${book.publicationYear}`
                    : 'Publication year unavailable'}
                </p>

                {/* Display all genres linked to this book */}
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

                {/* Display the book's language */}
                <span className="genre-tag">
                  {book.language?.toUpperCase() || 'Unknown'}
                </span>

              </div>
            ))}
          </div>

          {/* Message shown if no books match the filters */}
          {filteredBooks.length === 0 && (
            <p className="empty-message">
              No books found. Try another search or genre!
            </p>
          )}

        </>
      )}
    </div>
  )
}

export default Discover
