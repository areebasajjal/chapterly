
import { Schema, model } from 'mongoose'

const readingSessionSchema = new Schema(
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

    readingDate: {
      type: Date,
      required: true,
      default: Date.now
    },

    minutesRead: {
      type: Number,
      required: true,
      min: 1
    },

    pagesRead: {
      type: Number,
      min: 0,
      default: 0
    },

    currentPage: {
      type: Number,
      min: 1,
      default: null
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    }
  },
  {
    collection: 'readingsessions',
    timestamps: true
  }
)

export const ReadingSession = model(
  'ReadingSession',
  readingSessionSchema
)
