
import { Schema, model } from 'mongoose'

// Embedded rating schema
const embeddedRatingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isInteger
    },

    isDemo: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
)

// Embedded review schema
const embeddedReviewSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    title: {
      type: String,
      trim: true,
      maxlength: 120,
      default: ''
    },

    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000
    },

    containsSpoilers: {
      type: Boolean,
      default: false
    },

    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public'
    },

    isDemo: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
)

// Main book schema
const bookSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: ''
    },

    publicationYear: {
      type: Number,
      min: 0
    },

    language: {
      type: String,
      default: 'en'
    },

    coverUrl: {
      type: String,
      default: ''
    },

    authorIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Author'
      }
    ],

    genreIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Genre'
      }
    ],

    publisherId: {
      type: Schema.Types.ObjectId,
      ref: 'Publisher'
    },

    // Ratings embedded directly inside each book
    ratings: {
      type: [embeddedRatingSchema],
      default: []
    },

    // Reviews embedded directly inside each book
    reviews: {
      type: [embeddedReviewSchema],
      default: []
    }
  },
  {
    timestamps: true,
    collection: 'books'
  }
)

export const Book = model('Book', bookSchema)
