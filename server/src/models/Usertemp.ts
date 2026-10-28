
import { Schema, model } from 'mongoose'

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    // Store the encrypted password hash, never the actual password.
    passwordHash: {
      type: String,
      required: true,
      select: false
    },

    role: {
      type: String,
      enum: ['reader', 'moderator', 'admin'],
      default: 'reader'
    },

    capabilities: {
      type: [String],
      default: []
    },

    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active'
    }
  },
  {
    collection: 'users',
    timestamps: true
  }
)

export const User = model('User', userSchema)
