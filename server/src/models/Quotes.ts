import { Schema, model } from 'mongoose'

// A quote can be (1) user-saved, (2) a verified excerpt from a book,
// or (3) original editorial material written for Chapterly.
// Editorial material must NEVER be displayed as a verbatim/famous book quote.
const quoteSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      required: function (this: { quoteType?: string }) {
        return this.quoteType === 'user_saved'
      }
    },
    bookId: {
      type: Schema.Types.ObjectId,
      ref: 'Book',
      required: true
    },
    editionId: {
      type: Schema.Types.ObjectId,
      ref: 'Edition',
      default: null
    },
    quoteText: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 2000
    },
    pageNumber: {
      type: Number,
      min: 1,
      default: null
    },
    personalNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    isFavorite: {
      type: Boolean,
      default: false
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'private'
    },
    quoteType: {
      type: String,
      enum: ['user_saved', 'verified_excerpt', 'editorial_highlight'],
      default: 'user_saved',
      required: true
    },
    // Optional citation. Only use this for a real, verified quotation.
    sourceUrl: {
      type: String,
      trim: true,
      default: ''
    },
    isDemo: {
      type: Boolean,
      default: false
    }
  },
  {
    collection: 'quotes',
    timestamps: true
  }
)

quoteSchema.index({ bookId: 1, quoteType: 1, visibility: 1 })
quoteSchema.index({ userId: 1, createdAt: -1 })

export const Quote = model('Quote', quoteSchema)
