
import { Schema, model } from 'mongoose'

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

export const Publisher = model('Publisher', publisherSchema)
