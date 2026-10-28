
import { Schema, model } from 'mongoose'

const profileSchema = new Schema(
  {
    // Connect each profile to its registered user.
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60
    },

    avatarUrl: {
      type: String,
      trim: true,
      default: ''
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },

    // A reader can select multiple favorite book genres.
    preferredGenres: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'Genre'
        }
      ],
      default: []
    }
  },
  {
    collection: 'profiles',
    timestamps: true
  }
)

export const Profile = model('Profile', profileSchema)
