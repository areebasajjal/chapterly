
import { Schema, model } from 'mongoose'

// Information stored about a book publisher
const publisherSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    country: {
      type: String,
      trim: true,
      default: ''
    },

    website: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    collection: 'publishers',
    timestamps: true
  }
)

// Create and export the Publisher model
export const Publisher = model('Publisher', publisherSchema)
