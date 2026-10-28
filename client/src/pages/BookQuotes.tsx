
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import './BookQuotes.css'

type Quote = {
  _id: string
  quoteText: string
  quoteType: 'verified_excerpt' | 'editorial_highlight'
  sourceUrl?: string
  pageNumber?: number | null
  isDemo?: boolean
}

type BookQuotesResponse = {
  data: {
    book: {
      _id: string
      title: string
      coverUrl?: string
    }
    quotes: Quote[]
  }
  meta: {
    total: number
    verifiedCount: number
    highlightCount: number
  }
}

type RequestState = {
  bookId: string
  result: BookQuotesResponse | null
  error: string
}

function BookQuotes() {
  const { id } = useParams<{ id: string }>()

  const [request, setRequest] = useState<RequestState>({
    bookId: '',
    result: null,
    error: ''
  })

  useEffect(() => {
    if (!id) return

    const bookId = id
    const controller = new AbortController()

    async function loadQuotes() {
      try {
        const response = await fetch(
          `http://localhost:5050/api/books/${bookId}/quotes`,
          {
            signal: controller.signal
          }
        )

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'Book not found.'
              : 'Unable to load quotes.'
          )
        }

        const json: BookQuotesResponse =
          await response.json()

        if (!controller.signal.aborted) {
          setRequest({
            bookId,
            result: json,
            error: ''
          })
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setRequest({
            bookId,
            result: null,
            error:
              err instanceof Error
                ? err.message
                : 'Something went wrong.'
          })
        }
      }
    }

    void loadQuotes()

    return () => {
      controller.abort()
    }
  }, [id])

  const loading =
    Boolean(id) && request.bookId !== id

  const result =
    request.bookId === id
      ? request.result
      : null

  const error = !id
    ? 'Missing book ID.'
    : request.bookId === id
      ? request.error
      : ''

  if (loading) {
    return (
      <main className="book-quotes-page">
        <p>Loading quotes...</p>
      </main>
    )
  }

  if (error || !result) {
    return (
      <main className="book-quotes-page">
        <Link
          to="/discover"
          className="book-quotes-back"
        >
          ← Back to Discover
        </Link>

        <p>
          {error || 'No data available.'}
        </p>
      </main>
    )
  }

  const { book, quotes } = result.data

  const verifiedQuotes = quotes.filter(
    (quote) =>
      quote.quoteType === 'verified_excerpt'
  )

  const highlights = quotes.filter(
    (quote) =>
      quote.quoteType === 'editorial_highlight'
  )

  function renderQuote(quote: Quote) {
    const isVerified =
      quote.quoteType === 'verified_excerpt'

    return (
      <article
        className="book-quote-card"
        key={quote._id}
      >
        <div className="book-quote-type">
          {isVerified
            ? 'Verified Book Excerpt'
            : 'Original Editorial Highlight'}
        </div>

        <p className="book-quote-text">
          {quote.quoteText}
        </p>

        {isVerified &&
          quote.sourceUrl?.startsWith('https://') && (
            <a
              className="book-quote-source"
              href={quote.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View source ↗
            </a>
          )}
      </article>
    )
  }

  return (
    <main className="book-quotes-page">

      <Link
        to={`/books/${book._id}`}
        className="book-quotes-back"
      >
        ← Back to Book Details
      </Link>

      <header className="book-quotes-header">
        {book.coverUrl && (
          <img
            src={book.coverUrl}
            alt={`Cover of ${book.title}`}
            className="book-quotes-cover"
          />
        )}

        <div>
          <p className="book-quotes-eyebrow">
            CHAPTERLY COLLECTION
          </p>

          <h1>{book.title}</h1>

          <p>Quotes & Highlights</p>
        </div>
      </header>

      <div className="book-quotes-stats">
        <div>
          <strong>
            {verifiedQuotes.length}
          </strong>

          <span>Verified Quotes</span>
        </div>

        <div>
          <strong>
            {highlights.length}
          </strong>

          <span>Editorial Highlights</span>
        </div>

        <div>
          <strong>
            {quotes.length}
          </strong>

          <span>Total Entries</span>
        </div>
      </div>

      {verifiedQuotes.length > 0 && (
        <section className="book-quotes-section">
          <h2>Verified Book Quotes</h2>

          <p className="book-quotes-description">
            Short excerpts attributed to this book,
            with source references where available.
          </p>

          <div className="book-quotes-list">
            {verifiedQuotes.map(renderQuote)}
          </div>
        </section>
      )}

      {highlights.length > 0 && (
        <section className="book-quotes-section">
          <h2>Book-Inspired Highlights</h2>

          <p className="book-quotes-description">
            Original reflections inspired by this
            book. These are not quotations from
            the original author or text.
          </p>

          <div className="book-quotes-list">
            {highlights.map(renderQuote)}
          </div>
        </section>
      )}

      {quotes.length === 0 && (
        <div className="book-quotes-empty">
          No public quotes or highlights are
          available for this book yet.
        </div>
      )}

    </main>
  )
}

export default BookQuotes
