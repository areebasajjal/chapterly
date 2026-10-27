
import { Schema, model } from 'mongoose'

const bookshelfSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },

    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300
    },

    isSystem: {
      type: Boolean,
      default: false
    }
  },
  {
    collection: 'bookshelves',
    timestamps: true
  }
)

// A reader cannot have two shelves with the exact same name.
bookshelfSchema.index(
  { userId: 1, name: 1 },
  { unique: true }
)

export const Bookshelf = model('Bookshelf', bookshelfSchema)
