
import 'dotenv/config'

import express, { type Request } from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'

import { Book } from './models/Books'
import { Genre } from './models/Genres'
import { Edition } from './models/Editions'
import { User } from './models/Usertemp'
import { Profile } from './models/profilestemp'
import { Bookshelf } from './models/Bookshelvess'

import './models/Authors'
import './models/Publsihers'
import { ShelfEntry } from './models/ShelfEntries'
import './models/ReadingSessions'
import './models/Reviews'
import './models/Ratings'
import './models/Quotes'
import './models/ReadingChallenges'
import './models/ChallengeParticipants'


const app = express()

const PORT = process.env.PORT || 5050
const DB_NAME = process.env.DB_NAME || 'chapterly'
const MONGODB_URI = process.env.MONGODB_URI
const JWT_SECRET = process.env.JWT_SECRET

const COOKIE_NAME = 'chapterly_session'

const cookieSettings = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/'
}

const DEFAULT_SHELF_NAMES = [
  'Want to Read',
  'Currently Reading',
  'Read'
]


// Allow our React application to communicate with Express.
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))

app.use(express.json())
app.use(cookieParser())


// Get the logged-in user's ID from their authentication cookie.
function getSessionUserId(req: Request): string | null {
  const token = req.cookies?.[COOKIE_NAME]

  if (typeof token !== 'string' || !JWT_SECRET) {
    return null
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    })

    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      !mongoose.isObjectIdOrHexString(payload.sub)
    ) {
      return null
    }

    return payload.sub

  } catch {
    return null
  }
}


// Create the three default shelves for existing accounts.
// Existing shelves are kept instead of being duplicated.
async function ensureDefaultShelves(userId: mongoose.Types.ObjectId) {
  await Bookshelf.bulkWrite(
    DEFAULT_SHELF_NAMES.map((name) => ({
      updateOne: {
        filter: { userId, name },
        update: {
          $setOnInsert: {
            userId,
            name,
            isSystem: true,
            description: ''
          }
        },
        upsert: true
      }
    }))
  )
}


// Check whether Express and MongoDB are running.
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Chapterly API is running',
    database: mongoose.connection.name,
    connected: mongoose.connection.readyState === 1
  })
})


// Register a user and automatically create their profile and bookshelves.
app.post('/api/auth/register', async (req, res) => {
  try {
    const { displayName, email, password } = req.body ?? {}

    if (
      typeof displayName !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Please provide your name, email and password.'
        }
      })
    }

    const cleanName = displayName.trim()
    const cleanEmail = email.trim().toLowerCase()

    if (cleanName.length < 2 || cleanName.length > 60) {
      return res.status(400).json({
        error: {
          code: 'INVALID_NAME',
          message: 'Name must contain 2 to 60 characters.'
        }
      })
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailPattern.test(cleanEmail)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Please enter a valid email address.'
        }
      })
    }

    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Password must be at least 8 characters and no more than 72 bytes.'
        }
      })
    }

    const existingUser = await User.findOne({
      email: cleanEmail
    })

    if (existingUser) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists.'
        }
      })
    }

    // Hash the password so we never store it as plain text.
    const passwordHash = await bcrypt.hash(password, 12)

    const user = new User({
      email: cleanEmail,
      passwordHash,
      role: 'reader',
      status: 'active'
    })

    const profile = new Profile({
      userId: user._id,
      displayName: cleanName
    })

    // Save the user, profile and three shelves in one transaction.
    // If something fails, MongoDB rolls back all these changes.
    await mongoose.connection.transaction(async (session) => {
      await user.save({ session })
      await profile.save({ session })

      await Bookshelf.insertMany(
        DEFAULT_SHELF_NAMES.map((name) => ({
          userId: user._id,
          name,
          isSystem: true
        })),
        { session }
      )
    })

    return res.status(201).json({
      data: {
        id: user._id.toString(),
        email: user.email,
        displayName: profile.displayName,
        role: user.role
      },
      message: 'Account created successfully.'
    })

  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_ACCOUNT',
          message: 'An account or bookshelf already exists.'
        }
      })
    }

    console.error('Registration error:', error)

    return res.status(500).json({
      error: {
        code: 'REGISTRATION_ERROR',
        message: 'Could not create your account.'
      }
    })
  }
})


// Log in a user after checking their email and password.
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {}

    if (
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Email and password are required.'
        }
      })
    }

    const cleanEmail = email.trim().toLowerCase()

    // Retrieve the password hash so bcrypt can verify it.
    const user = await User.findOne({
      email: cleanEmail
    }).select('+passwordHash')

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.'
        }
      })
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    )

    if (!passwordMatches) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.'
        }
      })
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'This account is not active.'
        }
      })
    }

    const profile = await Profile.findOne({
      userId: user._id
    })

    // Give older registered users any missing default shelves.
    await ensureDefaultShelves(user._id)

    // Create a session token that expires after one hour.
    const token = jwt.sign(
      { sub: user._id.toString() },
      JWT_SECRET!,
      {
        algorithm: 'HS256',
        expiresIn: '1h'
      }
    )

    res.cookie(COOKIE_NAME, token, {
      ...cookieSettings,
      maxAge: 60 * 60 * 1000
    })

    return res.json({
      data: {
        id: user._id.toString(),
        email: user.email,
        displayName: profile?.displayName ?? user.email,
        role: user.role
      },
      message: 'Logged in successfully.'
    })

  } catch (error) {
    console.error('Login error:', error)

    return res.status(500).json({
      error: {
        code: 'LOGIN_ERROR',
        message: 'Could not log in.'
      }
    })
  }
})


// Get information about the currently logged-in reader.
app.get('/api/auth/me', async (req, res) => {
  try {
    const userId = getSessionUserId(req)

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Please log in.'
        }
      })
    }

    const user = await User.findById(userId)

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Your account is not available.'
        }
      })
    }

    const profile = await Profile.findOne({
      userId: user._id
    })

    return res.json({
      data: {
        id: user._id.toString(),
        email: user.email,
        displayName: profile?.displayName ?? user.email,
        role: user.role,
        avatarUrl: profile?.avatarUrl ?? ''
      }
    })

  } catch (error) {
    console.error('Session check error:', error)

    return res.status(500).json({
      error: {
        code: 'SESSION_ERROR',
        message: 'Could not check your login session.'
      }
    })
  }
})


// Log out the reader by removing their login cookie.
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieSettings)

  res.json({
    message: 'Logged out successfully.'
  })
})


// Retrieve the bookshelves belonging to the logged-in reader.
app.get('/api/me/bookshelves', async (req, res) => {
  try {
    const userId = getSessionUserId(req)

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Please log in to view your shelves.'
        }
      })
    }

    const user = await User.findById(userId)

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Your account is not available.'
        }
      })
    }

    // Only find shelves owned by this specific user.
    const shelves = await Bookshelf.find({
      userId: user._id
    }).sort({
      isSystem: -1,
      createdAt: 1
    })

    return res.json({
      data: shelves,
      meta: {
        total: shelves.length
      }
    })

  } catch (error) {
    console.error('Bookshelf error:', error)

    return res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: 'Could not retrieve your bookshelves.'
      }
    })
  }
})


app.post('/api/me/bookshelves/:shelfId/books', async (req, res) => {
  try {
    const userId = getSessionUserId(req)

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Please log in first.'
        }
      })
    }

    const user = await User.findById(userId)

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Your account is not available.'
        }
      })
    }

    const { shelfId } = req.params
    const { bookId } = req.body ?? {}

    // Both references must be valid MongoDB ObjectIds.
    if (
      !mongoose.isObjectIdOrHexString(shelfId) ||
      typeof bookId !== 'string' ||
      !mongoose.isObjectIdOrHexString(bookId)
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid bookshelf or book ID.'
        }
      })
    }

    // A reader can only modify their own bookshelf.
    const shelf = await Bookshelf.findOne({
      _id: shelfId,
      userId: user._id
    })

    if (!shelf) {
      return res.status(404).json({
        error: {
          code: 'SHELF_NOT_FOUND',
          message: 'Bookshelf not found.'
        }
      })
    }

    // Check that the selected book exists in our catalog.
    const bookExists = await Book.exists({
      _id: bookId
    })

    if (!bookExists) {
      return res.status(404).json({
        error: {
          code: 'BOOK_NOT_FOUND',
          message: 'Book not found.'
        }
      })
    }

    // Don't add the same book twice to one bookshelf.
    const existingEntry = await ShelfEntry.exists({
      shelfId: shelf._id,
      bookId
    })

    if (existingEntry) {
      return res.status(409).json({
        error: {
          code: 'BOOK_ALREADY_SAVED',
          message: 'This book is already on the selected shelf.'
        }
      })
    }

    // A book can have only one default reading status.
    if (shelf.isSystem) {
      const systemShelves = await Bookshelf.find({
        userId: user._id,
        isSystem: true,
        _id: { $ne: shelf._id }
      }).select('_id')

      const savedElsewhere = await ShelfEntry.exists({
        bookId,
        shelfId: {
          $in: systemShelves.map((item) => item._id)
        }
      })

      if (savedElsewhere) {
        return res.status(409).json({
          error: {
            code: 'BOOK_HAS_READING_STATUS',
            message: 'This book is on another reading-status shelf. Move it instead.'
          }
        })
      }
    }

    // Store the relationship in the ShelfEntries collection.
    const entry = await ShelfEntry.create({
      shelfId: shelf._id,
      bookId
    })

    // Retrieve the book's title and cover for our frontend.
    await entry.populate('bookId', 'title coverUrl publicationYear')

    return res.status(201).json({
      data: entry,
      message: 'Book added to your bookshelf.'
    })

  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return res.status(409).json({
        error: {
          code: 'BOOK_ALREADY_SAVED',
          message: 'This book is already on the selected shelf.'
        }
      })
    }

    console.error('Error adding book:', error)

    return res.status(500).json({
      error: {
        code: 'SAVE_ERROR',
        message: 'Could not save this book.'
      }
    })
  }
})


app.get('/api/me/bookshelves/:shelfId/books', async (req, res) => {
  try {
    // Identify the reader using their login cookie.
    const userId = getSessionUserId(req)

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Please log in first.'
        }
      })
    }

    // Confirm the account still exists and is active.
    const user = await User.findById(userId)

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Your account is not available.'
        }
      })
    }

    const { shelfId } = req.params

    // Check that the bookshelf ID is valid.
    if (!mongoose.isObjectIdOrHexString(shelfId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid bookshelf ID.'
        }
      })
    }

    // Only allow the reader to access their own bookshelf.
    const shelf = await Bookshelf.findOne({
      _id: shelfId,
      userId: user._id
    })

    if (!shelf) {
      return res.status(404).json({
        error: {
          code: 'SHELF_NOT_FOUND',
          message: 'Bookshelf not found.'
        }
      })
    }

    // Find all entries belonging to this bookshelf.
    const entries = await ShelfEntry.find({
      shelfId: shelf._id
    })
      .populate('bookId', 'title coverUrl publicationYear')
      .sort({ createdAt: -1 })

    // Send the bookshelf and its saved books to React.
    return res.json({
      data: {
        shelf: {
          id: shelf._id,
          name: shelf.name
        },
        entries
      },
      meta: {
        total: entries.length
      }
    })

  } catch (error) {
    console.error('Error fetching saved books:', error)

    return res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: 'Could not retrieve saved books.'
      }
    })
  }
})



app.delete('/api/me/bookshelves/:shelfId/books/:entryId', async (req, res) => {
  try {
    // Identify the reader from their login session.
    const userId = getSessionUserId(req)

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Please log in first.'
        }
      })
    }

    // Check that the account exists and is active.
    const user = await User.findById(userId)

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Your account is not available.'
        }
      })
    }

    const { shelfId, entryId } = req.params

    // Validate both MongoDB ObjectIds.
    if (
      !mongoose.isObjectIdOrHexString(shelfId) ||
      !mongoose.isObjectIdOrHexString(entryId)
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid bookshelf or entry ID.'
        }
      })
    }

    // The reader must own the selected bookshelf.
    const shelf = await Bookshelf.findOne({
      _id: shelfId,
      userId: user._id
    })

    if (!shelf) {
      return res.status(404).json({
        error: {
          code: 'SHELF_NOT_FOUND',
          message: 'Bookshelf not found.'
        }
      })
    }

    // Delete the entry only if it belongs to this bookshelf.
    const deletedEntry = await ShelfEntry.findOneAndDelete({
      _id: entryId,
      shelfId: shelf._id
    })

    if (!deletedEntry) {
      return res.status(404).json({
        error: {
          code: 'ENTRY_NOT_FOUND',
          message: 'Book entry not found on this shelf.'
        }
      })
    }

    return res.json({
      message: 'Book removed from your bookshelf.',
      data: {
        deletedEntryId: deletedEntry._id
      }
    })

  } catch (error) {
    console.error('Error removing book:', error)

    return res.status(500).json({
      error: {
        code: 'DELETE_ERROR',
        message: 'Could not remove this book.'
      }
    })
  }
})



app.patch('/api/me/bookshelves/:shelfId/books/:entryId/move', async (req, res) => {
  try {
    const userId = getSessionUserId(req)

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Please log in first.'
        }
      })
    }

    const user = await User.findById(userId)

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Your account is not available.'
        }
      })
    }

    const { shelfId, entryId } = req.params
    const { targetShelfId } = req.body ?? {}

    // Check that all three IDs are valid MongoDB ObjectIds.
    if (
      !mongoose.isObjectIdOrHexString(shelfId) ||
      !mongoose.isObjectIdOrHexString(entryId) ||
      typeof targetShelfId !== 'string' ||
      !mongoose.isObjectIdOrHexString(targetShelfId)
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid bookshelf or entry ID.'
        }
      })
    }

    if (shelfId === targetShelfId) {
      return res.status(400).json({
        error: {
          code: 'SAME_SHELF',
          message: 'The book is already on this bookshelf.'
        }
      })
    }

    // Check that the reader owns both bookshelves.
    const sourceShelf = await Bookshelf.findOne({
      _id: shelfId,
      userId: user._id
    })

    const targetShelf = await Bookshelf.findOne({
      _id: targetShelfId,
      userId: user._id
    })

    if (!sourceShelf || !targetShelf) {
      return res.status(404).json({
        error: {
          code: 'SHELF_NOT_FOUND',
          message: 'One of the bookshelves was not found.'
        }
      })
    }

    // Find the book entry on its current shelf.
    const entry = await ShelfEntry.findOne({
      _id: entryId,
      shelfId: sourceShelf._id
    })

    if (!entry) {
      return res.status(404).json({
        error: {
          code: 'ENTRY_NOT_FOUND',
          message: 'Book entry not found.'
        }
      })
    }

    // Prevent duplicate copies on the destination shelf.
    const alreadyOnTarget = await ShelfEntry.exists({
      shelfId: targetShelf._id,
      bookId: entry.bookId
    })

    if (alreadyOnTarget) {
      return res.status(409).json({
        error: {
          code: 'BOOK_ALREADY_SAVED',
          message: 'This book is already on the destination shelf.'
        }
      })
    }

    // A book should have only one default reading status.
    if (targetShelf.isSystem) {
      const otherSystemShelves = await Bookshelf.find({
        userId: user._id,
        isSystem: true,
        _id: {
          $nin: [sourceShelf._id, targetShelf._id]
        }
      }).select('_id')

      const conflictingEntry = await ShelfEntry.exists({
        bookId: entry.bookId,
        shelfId: {
          $in: otherSystemShelves.map((shelf) => shelf._id)
        }
      })

      if (conflictingEntry) {
        return res.status(409).json({
          error: {
            code: 'BOOK_HAS_READING_STATUS',
            message: 'This book already has another reading status.'
          }
        })
      }
    }

    // Move the existing entry by changing its shelf reference.
    const updatedEntry = await ShelfEntry.findOneAndUpdate(
      {
        _id: entry._id,
        shelfId: sourceShelf._id
      },
      {
        $set: {
          shelfId: targetShelf._id
        }
      },
      {
        new: true,
        runValidators: true
      }
    )

    if (!updatedEntry) {
      return res.status(409).json({
        error: {
          code: 'ENTRY_CHANGED',
          message: 'This book was moved or removed. Please refresh.'
        }
      })
    }

    await updatedEntry.populate(
      'bookId',
      'title coverUrl publicationYear'
    )

    return res.json({
      data: {
        entry: updatedEntry,
        fromShelf: sourceShelf.name,
        toShelf: targetShelf.name
      },
      message: 'Book moved successfully.'
    })

  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return res.status(409).json({
        error: {
          code: 'BOOK_ALREADY_SAVED',
          message: 'This book already exists on the destination shelf.'
        }
      })
    }

    console.error('Error moving book:', error)

    return res.status(500).json({
      error: {
        code: 'MOVE_ERROR',
        message: 'Could not move this book.'
      }
    })
  }
})


// Retrieve all books, with optional genre and title filters.
app.get('/api/books', async (req, res) => {
  try {
    const genreId = req.query.genre
    const search = req.query.search

    if (
      genreId !== undefined &&
      (
        typeof genreId !== 'string' ||
        !mongoose.isObjectIdOrHexString(genreId)
      )
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_GENRE',
          message: 'Please provide a valid genre ID.'
        }
      })
    }

    if (
      search !== undefined &&
      typeof search !== 'string'
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_SEARCH',
          message: 'Search must be text.'
        }
      })
    }

    const filter: {
      genreIds?: mongoose.Types.ObjectId
      title?: RegExp
    } = {}

    // Filter books by a particular genre ID.
    if (typeof genreId === 'string') {
      filter.genreIds = new mongoose.Types.ObjectId(genreId)
    }

    // Search for titles without case sensitivity.
    if (typeof search === 'string' && search.trim()) {
      const safeSearch = search.trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

      filter.title = new RegExp(safeSearch, 'i')
    }

    // Populate retrieves names from related collections.
    const books = await Book.find(filter)
      .populate('authorIds', 'name')
      .populate('genreIds', 'name')
      .populate('publisherId', 'name country website')
      .sort({ title: 1 })

    return res.json({
      data: books,
      meta: {
        total: books.length
      }
    })

  } catch (error) {
    console.error('Error fetching books:', error)

    return res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: 'Could not retrieve books.'
      }
    })
  }
})


// Retrieve all editions belonging to a particular book.
app.get('/api/books/:id/editions', async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid book ID.'
        }
      })
    }

    const bookExists = await Book.exists({
      _id: id
    })

    if (!bookExists) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Book not found.'
        }
      })
    }

    // Find editions and retrieve their book and publisher details.
    const editions = await Edition.find({
      bookId: id
    })
      .populate('bookId', 'title publicationYear')
      .populate('publisherId', 'name country website')
      .sort({ publicationYear: 1 })

    return res.json({
      data: editions,
      meta: {
        total: editions.length
      }
    })

  } catch (error) {
    console.error('Error fetching editions:', error)

    return res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: 'Could not retrieve book editions.'
      }
    })
  }
})


// Retrieve one book by its MongoDB ObjectId.
app.get('/api/books/:id', async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid book ID.'
        }
      })
    }

    const book = await Book.findById(id)
      .populate('authorIds', 'name')
      .populate('genreIds', 'name')
      .populate('publisherId', 'name country website')

    if (!book) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Book not found.'
        }
      })
    }

    return res.json({
      data: book
    })

  } catch (error) {
    console.error('Error fetching book:', error)

    return res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: 'Could not retrieve the book.'
      }
    })
  }
})


// Retrieve all book genres in alphabetical order.
app.get('/api/genres', async (req, res) => {
  try {
    const genres = await Genre.find()
      .sort({ name: 1 })

    return res.json({
      data: genres,
      meta: {
        total: genres.length
      }
    })

  } catch (error) {
    console.error('Error fetching genres:', error)

    return res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: 'Could not retrieve genres.'
      }
    })
  }
})


// Connect to MongoDB Atlas and start our Express server.
async function startServer() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is missing from the .env file.')
    return
  }

  if (!JWT_SECRET) {
    console.error('JWT_SECRET is missing from the .env file.')
    return
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME
    })

    // Create/check the unique bookshelf index before accepting requests.
    await Bookshelf.init()
    await ShelfEntry.init()

    console.log(
      `Connected to MongoDB: ${mongoose.connection.name}`
    )

    const registeredModels = mongoose.modelNames().sort()

    console.log(
      `Registered models (${registeredModels.length}):`,
      registeredModels.join(', ')
    )

    app.listen(PORT, () => {
      console.log(
        `Server running at http://localhost:${PORT}`
      )
    })

  } catch (error) {
    console.error(
      'MongoDB connection or server startup failed:',
      error
    )
  }
}

startServer()
