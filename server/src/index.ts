
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'

// Middleware that checks whether a reader is logged in
import { requireAuth } from './middleware/requireAuth'

// Import our MongoDB models
import { Book } from './models/Books'
import { Genre } from './models/Genres'
import { User } from './models/users'
import { Profile } from './models/Profiles'
import './models/Authors'
// Register the Publisher model for book relationships
import './models/Publishers'

// Create our Express application
const app = express()

// Read settings from the .env file
const PORT = process.env.PORT || 5050
const DB_NAME = process.env.DB_NAME || 'chapterly'
const MONGODB_URI = process.env.MONGODB_URI
const JWT_SECRET = process.env.JWT_SECRET

// Allow our React frontend to communicate with Express
// credentials: true allows login cookies to be sent
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))

// Allow Express to read JSON sent by React
app.use(express.json())

// Allow Express to read cookies from incoming requests
app.use(cookieParser())


// ========================================
// 1. CHECK SERVER CONNECTION
// ========================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Chapterly API is running',
    database: mongoose.connection.name,
    connected: mongoose.connection.readyState === 1
  })
})


// ========================================
// 2. REGISTER A NEW USER
// ========================================

app.post('/api/auth/register', async (req, res) => {

  // Get the information entered by the reader
  const { displayName, email, password } = req.body ?? {}

  // Remove extra spaces from the name
  const name = typeof displayName === 'string'
    ? displayName.trim()
    : ''

  // Remove spaces and make the email lowercase
  const cleanEmail = typeof email === 'string'
    ? email.trim().toLowerCase()
    : ''

  // Check that the name is between 2 and 60 characters
  if (name.length < 2 || name.length > 60) {
    return res.status(400).json({
      error: {
        code: 'INVALID_NAME',
        message: 'Name must be between 2 and 60 characters.'
      }
    })
  }

  // Check that the email has a valid format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address.'
      }
    })
  }

  // Require at least 8 characters in the password
  // bcrypt supports passwords up to 72 bytes
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    return res.status(400).json({
      error: {
        code: 'INVALID_PASSWORD',
        message: 'Password must be at least 8 characters and no more than 72 bytes.'
      }
    })
  }

  try {

    // Hash the password before storing it in MongoDB
    const passwordHash = await bcrypt.hash(password, 12)

    // Use a transaction to save the User and Profile together
    const newReader = await mongoose.connection.transaction(
      async (session) => {

        // Create a new account in the users collection
        const user = new User({
          email: cleanEmail,
          passwordHash,
          role: 'reader'
        })

        await user.save({ session })

        // Create a profile linked to the new user
        const profile = new Profile({
          userId: user._id,
          displayName: name
        })

        await profile.save({ session })

        // Return account details without the password hash
        return {
          id: user._id.toString(),
          email: user.email,
          displayName: profile.displayName,
          role: user.role
        }
      }
    )

    // Tell React that registration was successful
    res.status(201).json({
      data: newReader,
      message: 'Account created successfully.'
    })

  } catch (error) {

    // MongoDB error 11000 means a unique value already exists
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'This email is already registered.'
        }
      })
    }

    console.error('Registration failed:', error)

    res.status(500).json({
      error: {
        code: 'REGISTRATION_ERROR',
        message: 'Could not create the account.'
      }
    })
  }
})


// ========================================
// 3. LOGIN AN EXISTING USER
// ========================================

app.post('/api/auth/login', async (req, res) => {

  // Get the email and password entered by the reader
  const { email, password } = req.body ?? {}

  // Check that both fields contain text
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DETAILS',
        message: 'Email and password are required.'
      }
    })
  }

  // A secret key is needed to create login tokens
  if (!JWT_SECRET) {
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Login is currently unavailable.'
      }
    })
  }

  try {

    // Find the user using their email
    // Include the password hash so we can verify it
    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select('+passwordHash')

    // Compare the entered password with the saved hash
    const correctPassword = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false

    // Reject incorrect details or inactive accounts
    if (!user || !correctPassword || user.status !== 'active') {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.'
        }
      })
    }

    // Find the profile belonging to this user
    const profile = await Profile.findOne({
      userId: user._id
    })

    // The account must have a linked profile
    if (!profile) {
      return res.status(500).json({
        error: {
          code: 'PROFILE_MISSING',
          message: 'Could not load the user profile.'
        }
      })
    }

    // Create a signed token containing the user's ID
    // The token expires after one hour
    const token = jwt.sign(
      { sub: user._id.toString() },
      JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '1h'
      }
    )

    // Store the login token in an HTTP-only cookie
    // Browser JavaScript cannot read an HTTP-only cookie
    res.cookie('chapterly_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000,
      path: '/'
    })

    // Return the reader's information to React
    res.json({
      data: {
        id: user._id.toString(),
        email: user.email,
        displayName: profile.displayName,
        role: user.role
      },
      message: 'Logged in successfully.'
    })

  } catch (error) {

    console.error('Login failed:', error)

    res.status(500).json({
      error: {
        code: 'LOGIN_ERROR',
        message: 'Could not log in.'
      }
    })
  }
})


// ========================================
// 4. GET THE CURRENTLY LOGGED-IN USER
// ========================================

app.get('/api/auth/me', async (req, res) => {

  // Get the login token from the browser's cookie
  const token = req.cookies?.chapterly_session

  // If there is no token, the reader is not logged in
  if (typeof token !== 'string' || !token) {
    return res.status(401).json({
      error: {
        code: 'NOT_LOGGED_IN',
        message: 'Please log in first.'
      }
    })
  }

  // Check that our token secret is available
  if (!JWT_SECRET) {
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Authentication is unavailable.'
      }
    })
  }

  // This variable will store the logged-in user's ID
  let userId: string

  try {

    // Verify that the token is genuine and has not expired
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    })

    // Check that the token contains a valid MongoDB User ID
    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      !mongoose.isObjectIdOrHexString(decoded.sub)
    ) {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Please log in again.'
        }
      })
    }

    // Save the User ID from the verified token
    userId = decoded.sub

  } catch {

    // An expired or modified token cannot be used
    return res.status(401).json({
      error: {
        code: 'INVALID_SESSION',
        message: 'Your session has expired. Please log in again.'
      }
    })
  }

  try {

    // Find the user using the ID from the login token
    const user = await User.findById(userId)

    // The account must exist and be active
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: {
          code: 'ACCOUNT_UNAVAILABLE',
          message: 'Please log in again.'
        }
      })
    }

    // Find the profile connected to this user
    const profile = await Profile.findOne({
      userId: user._id
    })

    // Return an error if the profile is missing
    if (!profile) {
      return res.status(500).json({
        error: {
          code: 'PROFILE_MISSING',
          message: 'Could not load your profile.'
        }
      })
    }

    // Send the user's account and profile details to React
    // Never include the password hash in the response
    res.json({
      data: {
        id: user._id.toString(),
        email: user.email,
        displayName: profile.displayName,
        role: user.role,
        avatarUrl: profile.avatarUrl
      }
    })

  } catch (error) {

    console.error('Error loading current user:', error)

    res.status(500).json({
      error: {
        code: 'USER_ERROR',
        message: 'Could not retrieve your account.'
      }
    })
  }
})



 // ========================================
 // 5. LOG OUT THE CURRENT USER
 // ========================================

app.post('/api/auth/logout', (req, res) => {

  // Remove the login cookie from the browser
  res.clearCookie('chapterly_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  })

  // Tell React that the reader has been logged out
  res.json({
    message: 'Logged out successfully.'
  })
})


 // TEST A PROTECTED ROUTE
 

app.get('/api/me/test', requireAuth, (req, res) => {

  // Get the verified user's ID from our middleware
  const userId = res.locals.userId

  // This response is sent only if authentication succeeds
  res.json({
    message: 'You are logged in!',
    userId: userId
  })
})



// ========================================
// 5. GET ALL BOOKS, SEARCH AND FILTER
// ========================================

app.get('/api/books', async (req, res) => {
  try {

    // Get search and genre values from the URL
    const genreId = req.query.genre
    const searchQuery = req.query.search

    // Check whether the genre ID is valid
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
          message: 'Invalid genre ID.'
        }
      })
    }

    // Check whether the search text is valid
    if (
      searchQuery !== undefined &&
      (
        typeof searchQuery !== 'string' ||
        searchQuery.length > 100
      )
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_SEARCH',
          message: 'Search must be under 100 characters.'
        }
      })
    }

    // Create an empty MongoDB filter
    // An empty filter returns all books
    const filter: {
      genreIds?: mongoose.Types.ObjectId
      title?: RegExp
    } = {}

    // Filter by genre if one is selected
    if (typeof genreId === 'string') {
      filter.genreIds = new mongoose.Types.ObjectId(genreId)
    }

    // Search by title if the reader entered something
    if (
      typeof searchQuery === 'string' &&
      searchQuery.trim()
    ) {

      const searchText = searchQuery.trim()

      // Treat special regex symbols as normal text
      const safeSearch = searchText.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      )

      // 'i' means uppercase and lowercase are treated alike
      filter.title = new RegExp(safeSearch, 'i')
    }

    // Find the matching books
    // Populate retrieves the related author and genre names
    // Find books and retrieve their related information
    const books = await Book.find(filter)
      .populate('authorIds', 'name')
      .populate('genreIds', 'name')
      .populate('publisherId', 'name country website')
      .sort({ title: 1 })
    // Send the results to React
    res.json({
      data: books,
      meta: {
        total: books.length
      }
    })

  } catch (error) {

    console.error('Error fetching books:', error)

    res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: 'Could not retrieve books.'
      }
    })
  }
})


// ========================================
// 6. GET ONE BOOK BY ITS ID
// ========================================

app.get('/api/books/:id', async (req, res) => {
  try {

    // Get the book ID from the URL
    const { id } = req.params

    // Check that the ID is valid
    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid book ID.'
        }
      })
    }

    // Find the book using its MongoDB ObjectId
    // Find one book with its authors, genres and publisher
  const book = await Book.findById(id)
    .populate('authorIds', 'name')
    .populate('genreIds', 'name')
    .populate('publisherId', 'name country website')

    // Return an error if the book does not exist
    if (!book) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Book not found.'
        }
      })
    }

    // Send the selected book's details to React
    res.json({
      data: book
    })

  } catch (error) {

    console.error('Error fetching book:', error)

    res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: 'Could not retrieve book.'
      }
    })
  }
})


// ========================================
// 7. GET ALL GENRES
// ========================================

app.get('/api/genres', async (req, res) => {
  try {

    // Find all genres and sort them alphabetically
    const genres = await Genre.find().sort({ name: 1 })

    // Send the genres to the React frontend
    res.json({
      data: genres,
      meta: {
        total: genres.length
      }
    })

  } catch (error) {

    console.error('Error fetching genres:', error)

    res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: 'Could not retrieve genres.'
      }
    })
  }
})


// ========================================
// 8. CONNECT TO MONGODB AND START SERVER
// ========================================

async function startServer() {

  // Stop if the MongoDB connection string is missing
  if (!MONGODB_URI) {
    console.error('MongoDB connection string is missing.')
    return
  }

  // Stop if the login secret is missing or too short
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('A strong JWT_SECRET is required in .env.')
    return
  }

  try {

    // Connect to our Chapterly database in MongoDB Atlas
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME
    })

    console.log(
      `Connected to MongoDB: ${mongoose.connection.name}`
    )

    // Prepare the Users and Profiles collections
    // Also make sure their unique indexes are created
    await User.init()
    await Profile.init()

    // Start Express after MongoDB is connected
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`)
    })

  } catch (error) {

    console.error('MongoDB connection failed:', error)
  }
}

// Start our Chapterly backend
startServer()
