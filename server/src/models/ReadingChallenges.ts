
import { Schema, model } from 'mongoose'

const readingChallengeSchema = new Schema(
  {
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },

    targetBooks: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'The reading goal must be a whole number'
      }
    },

    startDate: {
      type: Date,
      required: true
    },

    endDate: {
      type: Date,
      required: true
    },

    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'private'
    },

    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'cancelled'],
      default: 'draft'
    }
  },
  {
    collection: 'readingchallenges',
    timestamps: true
  }
)

export const ReadingChallenge = model(
  'ReadingChallenge',
  readingChallengeSchema
)
