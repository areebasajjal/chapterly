
import { Schema, model } from 'mongoose'

const challengeParticipantSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    challengeId: {
      type: Schema.Types.ObjectId,
      ref: 'ReadingChallenge',
      required: true
    },

    joinedAt: {
      type: Date,
      default: Date.now
    },

    completedBooks: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Completed books must be a whole number'
      }
    },

    status: {
      type: String,
      enum: ['active', 'completed', 'left'],
      default: 'active'
    },

    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'challengeparticipants',
    timestamps: true
  }
)

challengeParticipantSchema.index(
  { userId: 1, challengeId: 1 },
  { unique: true }
)

export const ChallengeParticipant = model(
  'ChallengeParticipant',
  challengeParticipantSchema
)
