
import { useState } from 'react'
import './BookFeedback.css'

type Rating = {
  score: number
  isDemo?: boolean
}

type Review = {
  _id: string
  title?: string
  content: string
  containsSpoilers?: boolean
  visibility?: 'public' | 'private'
  isDemo?: boolean
  createdAt?: string
}

export type BookFeedbackProps = {
  ratings?: Rating[]
  reviews?: Review[]
}

function BookFeedback({
  ratings = [],
  reviews = []
}: BookFeedbackProps) {
  const [revealedReviews, setRevealedReviews] =
    useState<string[]>([])

  // Only use valid rating scores.
  const validRatings = ratings.filter(
    (rating) =>
      Number.isInteger(rating.score) &&
      rating.score >= 1 &&
      rating.score <= 5
  )

  const ratingCount = validRatings.length

  // Calculate average rating.
  const totalScore = validRatings.reduce(
    (total, rating) => total + rating.score,
    0
  )

  const averageRating =
    ratingCount > 0 ? totalScore / ratingCount : 0

  // Calculate how many users gave each star value.
  const distribution = [5, 4, 3, 2, 1].map(
    (stars) => ({
      stars,
      count: validRatings.filter(
        (rating) => rating.score === stars
      ).length
    })
  )

  // Display public reviews only.
  const publicReviews = reviews.filter(
    (review) => review.visibility === 'public'
  )

  const hasDemoData =
    validRatings.some((rating) => rating.isDemo) ||
    publicReviews.some((review) => review.isDemo)

  function toggleSpoiler(id: string) {
    setRevealedReviews((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  function formatDate(value?: string) {
    if (!value) return ''

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return ''

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <section className="chapterly-feedback">

      <div className="chapterly-feedback-heading">
        <h3>Reader Ratings & Reviews</h3>

        {hasDemoData && (
          <span className="chapterly-demo-tag">
            Demo Data
          </span>
        )}
      </div>

      {/* Ratings summary */}
      {ratingCount === 0 ? (
        <p className="chapterly-feedback-empty">
          No ratings available yet.
        </p>
      ) : (
        <div className="chapterly-rating-summary">

          <div className="chapterly-rating-average">
            <strong>
              {averageRating.toFixed(1)}
            </strong>

            <span className="chapterly-rating-stars">
              {'★'.repeat(Math.round(averageRating))}
              {'☆'.repeat(5 - Math.round(averageRating))}
            </span>

            <small>
              {ratingCount}{' '}
              {ratingCount === 1 ? 'rating' : 'ratings'}
            </small>
          </div>

          <div className="chapterly-rating-bars">
            {distribution.map((item) => (
              <div
                className="chapterly-rating-row"
                key={item.stars}
              >
                <span>{item.stars} ★</span>

                <div className="chapterly-rating-track">
                  <div
                    className="chapterly-rating-fill"
                    style={{
                      width:
                        `${(item.count / ratingCount) * 100}%`
                    }}
                  />
                </div>

                <small>{item.count}</small>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* Reviews */}
      <div className="chapterly-reviews-heading">
        <h3>Reader Reviews</h3>
        <span>{publicReviews.length}</span>
      </div>

      {publicReviews.length === 0 ? (
        <p className="chapterly-feedback-empty">
          No public reviews available yet.
        </p>
      ) : (
        <div className="chapterly-review-list">
          {publicReviews.map((review) => {
            const spoilerHidden =
              review.containsSpoilers &&
              !revealedReviews.includes(review._id)

            return (
              <article
                className="chapterly-review-card"
                key={review._id}
              >
                <div className="chapterly-review-top">
                  <h4>
                    {review.title || 'Book Review'}
                  </h4>

                  {review.isDemo && (
                    <span className="chapterly-demo-tag">
                      Demo Review
                    </span>
                  )}
                </div>

                {review.createdAt && (
                  <p className="chapterly-review-date">
                    {formatDate(review.createdAt)}
                  </p>
                )}

                {spoilerHidden ? (
                  <button
                    type="button"
                    className="chapterly-spoiler-button"
                    onClick={() =>
                      toggleSpoiler(review._id)
                    }
                  >
                    This review contains spoilers.
                    Click to reveal.
                  </button>
                ) : (
                  <>
                    <p className="chapterly-review-content">
                      {review.content}
                    </p>

                    {review.containsSpoilers && (
                      <button
                        type="button"
                        className="chapterly-hide-spoiler"
                        onClick={() =>
                          toggleSpoiler(review._id)
                        }
                      >
                        Hide spoilers
                      </button>
                    )}
                  </>
                )}
              </article>
            )
          })}
        </div>
      )}

    </section>
  )
}

export default BookFeedback
