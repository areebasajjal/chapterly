
import { Schema, model } from 'mongoose'

const quoteSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
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
    }
  },
  {
    collection: 'quotes',
    timestamps: true
  }
)

export const Quote = model('Quote', quoteSchema)
