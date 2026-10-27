 
import { Schema, model } from 'mongoose'

const editionSchema = new Schema(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      ref: 'Book',
      required: true
    },

    publisherId: {
      type: Schema.Types.ObjectId,
      ref: 'Publisher',
      default: null
    },

    isbn13: {
      type: String,
      trim: true,
      default: ''
    },

    format: {
      type: String,
      enum: [
        'hardcover',
        'paperback',
        'ebook',
        'audiobook',
        'other'
      ],
      required: true
    },

    publicationYear: {
      type: Number,
      min: 1450,
      max: 2100
    },

    language: {
      type: String,
      trim: true,
      default: 'English'
    },

    pageCount: {
      type: Number,
      min: 1
    },

    coverUrl: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    collection: 'editions',
    timestamps: true
  }
)

export const Edition = model('Edition', editionSchema)
