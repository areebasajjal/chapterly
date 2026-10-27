
import { Schema, model } from 'mongoose'

// Define the information stored in a reader's profile
const profileSchema = new Schema(
  {
    // Connect this profile to an existing user
    // Each user should have only one profile
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },

    // Name displayed on the reader's profile
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },

    // Link to the reader's profile picture
    avatarUrl: {
      type: String,
      default: ''
    },

    // Short introduction written by the reader
    bio: {
      type: String,
      default: '',
      maxlength: 500
    },

    // Genres the reader enjoys
    // These IDs reference our existing genres collection
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
    // Use the profiles collection in MongoDB
    collection: 'profiles',

    // Automatically store creation and update timestamps
    timestamps: true
  }
)

// Export the model for use in our Express backend
export const Profile = model('Profile', profileSchema)
