
import { Schema, model } from 'mongoose'

const ratingSchema = new Schema(
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

    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number'
      }
    }
  },
  {
    collection: 'ratings',
    timestamps: true
  }
)

// Each user can rate a particular book only once
ratingSchema.index(
  { userId: 1, bookId: 1 },
  { unique: true }
)

export const Rating = model('Rating', ratingSchema)
