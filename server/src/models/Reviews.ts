
import { Schema, model } from 'mongoose'

const reviewSchema = new Schema(
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
    }
  },
  {
    collection: 'reviews',
    timestamps: true
  }
)

reviewSchema.index(
  { userId: 1, bookId: 1 },
  { unique: true }
)

export const Review = model('Review', reviewSchema)
