
import { Schema, model } from 'mongoose'

// Each genre has a name and an optional description
const genreSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  description: {
    type: String,
    default: ''
  },

  // Allows genres to have parent categories
  parentGenreId: {
    type: Schema.Types.ObjectId,
    ref: 'Genre',
    default: null
  }

}, {
  timestamps: true,
  collection: 'genres'
})

export const Genre = model('Genre', genreSchema)
