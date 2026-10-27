import { useState } from 'react'
import './Discover.css'
import { books } from '../data/books'
import { Link } from 'react-router'


function Discover() {

  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('All Genres')

  const filteredBooks = books.filter((book) => {
    const matchesSearch = book.title.toLowerCase().includes(search.toLowerCase()) || book.author.toLowerCase().includes(search.toLowerCase())

    const matchesGenre = genre === 'All Genres' || book.genre === genre

    return matchesSearch && matchesGenre
  })

  return (
    <div className="discover">

      <div className="discover-heading">
        <h2>Find your next favorite book.</h2>
        <p>A little something for every kind of reader.</p>
      </div>

      <div className="discover-filters">
        <input
          type="search"
          placeholder="Search books or authors..."
          aria-label="Search books or authors"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          aria-label="Filter by genre"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
        >
          <option>All Genres</option>
          <option>Fiction</option>
          <option>Classics</option>
          <option>Fantasy</option>
          <option>Self-Help</option>
        </select>
      </div>

      <p className="book-count">
        {filteredBooks.length} books found
      </p>

      <div className="book-grid">
        {filteredBooks.map((book) => (
          <div className="book-card" key={book.id}>

            <div>
              
              <Link
                to={`/books/${book.id}`}
                className="book-cover"
                style={{ backgroundColor: book.color }}
                aria-label={`View details for ${book.title}`}
              >
                <span className="cover-symbol">✦</span>
                <span className="cover-title">{book.title}</span>
                <span className="cover-author">{book.author}</span>
              </Link>

            </div>

            <h3>{book.title}</h3>
            <p>{book.author}</p>
            <span className="genre-tag">{book.genre}</span>

          </div>
        ))}
      </div>

      {filteredBooks.length === 0 && (
        <p className="empty-message">
          No books found. Try another search!
        </p>
      )}

    </div>
  )
}

export default Discover
