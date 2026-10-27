
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import './Discover.css'

// Information about each book received from MongoDB
type Book = {
  _id: string
  title: string
  publicationYear?: number
  language?: string
  coverUrl?: string

  // Authors linked to the book
  authorIds?: {
    _id: string
    name: string
  }[]

  // Genres linked to the book
  genreIds?: {
    _id: string
    name: string
  }[]
}

// Information about a genre
type Genre = {
  _id: string
  name: string
}

// Background colors for books without cover images
const coverColors = [
  '#56736B',
  '#C6A1A0',
  '#BFA46E',
  '#8099A3',
  '#A87C83',
  '#B78960'
]

function Discover() {
  // Books returned by our Express API
  const [books, setBooks] = useState<Book[]>([])

  // Genres used in the dropdown
  const [genres, setGenres] = useState<Genre[]>([])

  // Text entered into the search bar
  const [search, setSearch] = useState('')

  // MongoDB ID of the selected genre
  // An empty string means "All Genres"
  const [selectedGenre, setSelectedGenre] = useState('')

  // Loading and error messages
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [genreError, setGenreError] = useState('')

  
  // LOAD GENRES FROM MONGODB

  // Fetch our genres when the page first opens
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
        if (!controller.signal.aborted) {
          setGenres(result.data)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setGenreError('Could not load genre options.')
        }
      })

    // Cancel the request if the page closes
    return () => controller.abort()
  }, [])


  // SEARCH AND FILTER BOOKS THROUGH MONGODB


  // Run whenever the user changes their search or genre
  useEffect(() => {
    const controller = new AbortController()

    // Build the query parameters for our Express API
    const params = new URLSearchParams()

    // Include a genre ID if the user selected one
    if (selectedGenre) {
      params.set('genre', selectedGenre)
    }

    // Include search text if the user typed something
    if (search.trim()) {
      params.set('search', search.trim())
    }

    // Create the final API URL
    // Example: /api/books?genre=GENRE_ID&search=Harry
    const query = params.toString()

    const url = query
      ? `http://localhost:5050/api/books?${query}`
      : 'http://localhost:5050/api/books'

    // Wait briefly before searching to avoid too many requests
    const timer = setTimeout(() => {
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
          // MongoDB has already searched and filtered the books
          if (!controller.signal.aborted) {
            setBooks(result.data)
          }
        })
        .catch((error) => {
          // Ignore requests cancelled by another search
          if (error.name !== 'AbortError') {
            setError('Could not load books from MongoDB.')
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false)
          }
        })
    }, 300)

    // Cancel old requests when the user changes the filters
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search, selectedGenre])

  
  // DISPLAY THE DISCOVER PAGE


  return (
    <div className="discover">

      {/* Page heading */}
      <div className="discover-heading">
        <h2>Find your next favorite book.</h2>
        <p>A little something for every kind of reader.</p>
      </div>

      {/* Search bar and genre dropdown */}
      <div className="discover-filters">

        {/* Search for books directly through MongoDB */}
        <input
          type="search"
          placeholder="Search books..."
          aria-label="Search books"
          value={search}
          onChange={(e) => {
            // Save what the user types
            setSearch(e.target.value)

            // Show loading while we search again
            setLoading(true)
            setError('')
          }}
        />

        {/* Filter books by their genre */}
        <select
          className="genre-select"
          aria-label="Filter books by genre"
          value={selectedGenre}
          onChange={(e) => {
            // Save the selected genre's MongoDB ID
            setSelectedGenre(e.target.value)

            // Request a new set of matching books
            setLoading(true)
            setError('')
          }}
        >
          <option value="">All Genres</option>

          {/* Get the dropdown options from our genres collection */}
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

      {/* Error messages */}
      {genreError && <p role="alert">{genreError}</p>}

      {loading && <p>Loading books...</p>}

      {error && <p role="alert">{error}</p>}

      {/* Display results when the request finishes */}
      {!loading && !error && (
        <>

          {/* Show the number of books returned by MongoDB */}
          <p className="book-count">
            {books.length} books found
          </p>

          <div className="book-grid">

            {/* Create a card for each book */}
            {books.map((book, index) => (
              <div className="book-card" key={book._id}>

                {/* Click the cover to open the Book Details page */}
                <Link
                  to={`/books/${book._id}`}
                  className="book-cover"
                  aria-label={`View details for ${book.title}`}
                  style={{
                    backgroundColor:
                      coverColors[index % coverColors.length]
                  }}
                >

                  {/* Placeholder shown when a cover is unavailable */}
                  <span className="cover-symbol">✦</span>

                  <span className="cover-title">
                    {book.title}
                  </span>

                  <span className="cover-author">
                    {book.publicationYear || 'Chapterly'}
                  </span>

                  {/* Real book cover retrieved from MongoDB */}
                  {book.coverUrl && (
                    <img
                      src={book.coverUrl}
                      alt={`Cover of ${book.title}`}
                      className="book-cover-image"
                      loading="lazy"
                      onError={(e) => {
                        // Reveal the placeholder if an image fails
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}

                </Link>

                {/* Book title */}
                <h3>{book.title}</h3>

                {/* Display real author names */}
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

                {/* Genre badges */}
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

                {/* Book language */}
                <span className="genre-tag">
                  {book.language?.toUpperCase() || 'Unknown'}
                </span>

              </div>
            ))}

          </div>

          {/* Show a message when MongoDB finds no matching books */}
          {books.length === 0 && (
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
