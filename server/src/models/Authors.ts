
import { Schema, model } from 'mongoose'

// Define what information we store about each author
const authorSchema = new Schema(
  {
    // Every author must have a name
    name: {
      type: String,
      required: true,
      trim: true
    },

    // A short introduction about the author
    bio: {
      type: String,
      default: ''
    },

    // The author's country
    country: {
      type: String,
      default: ''
    },

    // Birth year is optional because it may not be known
    birthYear: {
      type: Number
    }
  },
  {
    // Connect this model to our existing authors collection
    collection: 'authors',

    // Automatically manage timestamps for new or updated records
    timestamps: true
  }
)

// We will use Author to retrieve author data from MongoDB
export const Author = model('Author', authorSchema)
