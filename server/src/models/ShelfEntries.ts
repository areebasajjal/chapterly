
import { Schema, model } from 'mongoose'

const shelfEntrySchema = new Schema(
  {
    shelfId: {
      type: Schema.Types.ObjectId,
      ref: 'Bookshelf',
      required: true
    },

    bookId: {
      type: Schema.Types.ObjectId,
      ref: 'Book',
      required: true
    },

    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500
    }
  },
  {
    collection: 'shelfentries',
    timestamps: true
  }
)

// Prevent the same book from being added twice to one shelf
shelfEntrySchema.index(
  { shelfId: 1, bookId: 1 },
  { unique: true }
)

export const ShelfEntry = model(
  'ShelfEntry',
  shelfEntrySchema
)
