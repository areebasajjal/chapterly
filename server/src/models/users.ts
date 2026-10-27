
import { Schema, model } from 'mongoose'

// Define what information a Chapterly user has
const userSchema = new Schema(
  {
    // Email is used to identify each user's account
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    // Store a secure password hash, never the actual password
    passwordHash: {
      type: String,
      required: true,
      select: false
    },

    // Every user has one main role
    role: {
      type: String,
      enum: ['reader', 'moderator', 'admin'],
      default: 'reader'
    },

    // A user can have more than one additional capability
    capabilities: {
      type: [String],
      enum: ['author_contributor', 'challenge_organizer'],
      default: []
    },

    // Used to manage whether an account is active
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active'
    }
  },
  {
    // Connect this model to the users collection
    collection: 'users',

    // Automatically add createdAt and updatedAt
    timestamps: true
  }
)

// Export the model so our backend can use it
export const User = model('User', userSchema)
