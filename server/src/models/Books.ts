
import { Schema, model } from 'mongoose'

const bookSchema = new Schema({
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

  authorIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Author'
  }],

  genreIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Genre'
  }],

  publisherId: {
  type: Schema.Types.ObjectId,
  ref: 'Publisher',
  default: null
}

}, {
  timestamps: true,
  collection: 'books'
})

export const Book = model('Book', bookSchema)
