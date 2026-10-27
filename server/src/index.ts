
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'

import { Book } from './models/Books'
import { Genre } from './models/Genres'
import './models/Authors'

// Create our Express application
const app = express()

// Get the server settings from our .env file
const PORT = process.env.PORT || 5050
const DB_NAME = process.env.DB_NAME || 'chapterly'
const MONGODB_URI = process.env.MONGODB_URI

// Allow our React frontend to communicate with Express
app.use(cors({
  origin: 'http://localhost:5173'
}))

// Allow Express to read JSON data from requests
app.use(express.json())


// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

// Check whether the backend and MongoDB are connected
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Chapterly API is running',
    database: mongoose.connection.name,
    connected: mongoose.connection.readyState === 1
  })
})


// --------------------------------------------------
// GET ALL BOOKS / FILTER BOOKS BY GENRE
// --------------------------------------------------

app.get('/api/books', async (req, res) => {
  try {
    // Get the selected genre ID from the URL
    // Example: /api/books?genre=123456789012345678901234
    const genreId = req.query.genre

    // If a genre was provided, make sure its ID is valid
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
          message: 'Please provide a valid genre ID'
        }
      })
    }

    // Create the filter we will send to MongoDB
    // No genre selected means we should show all books
    let filter = {}

    if (typeof genreId === 'string') {
      // MongoDB will find books containing this genre ID
      // inside their genreIds array
      filter = {
        genreIds: new mongoose.Types.ObjectId(genreId)
      }
    }

    // Retrieve only the books matching our filter
    // Populate also gives us readable author and genre names
    const books = await Book.find(filter)
      .populate('authorIds', 'name')
      .populate('genreIds', 'name')
      .sort({ title: 1 })

    // Return the books and their total count to React
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
        message: 'Could not retrieve books'
      }
    })
  }
})


// --------------------------------------------------
// GET ONE BOOK BY ITS ID
// --------------------------------------------------

app.get('/api/books/:id', async (req, res) => {
  try {
    // Get the book ID from the URL
    const { id } = req.params

    // Make sure the book ID is valid
    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid book ID'
        }
      })
    }

    // Find the selected book using its MongoDB ObjectId
    // Also retrieve its author and genre names
    const book = await Book.findById(id)
      .populate('authorIds', 'name')
      .populate('genreIds', 'name')

    // If the book does not exist, return a 404 error
    if (!book) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Book not found'
        }
      })
    }

    // Send the selected book's information to React
    res.json({
      data: book
    })

  } catch (error) {
    console.error('Error fetching book:', error)

    res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: 'Could not retrieve book'
      }
    })
  }
})


// --------------------------------------------------
// GET ALL GENRES
// --------------------------------------------------

app.get('/api/genres', async (req, res) => {
  try {
    // Retrieve all genres in alphabetical order
    const genres = await Genre.find().sort({ name: 1 })

    // Return the genres so React can use them
    // in our upcoming genre dropdown
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
        message: 'Could not retrieve genres'
      }
    })
  }
})


// CONNECT TO MONGODB AND START EXPRESS


async function startServer() {
  // Stop if the MongoDB connection string is missing
  if (!MONGODB_URI) {
    console.error('MongoDB connection string is missing')
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

    // Start Express only after MongoDB connects
    app.listen(PORT, () => {
      console.log(
        `Server running at http://localhost:${PORT}`
      )
    })

  } catch (error) {
    console.error('MongoDB connection failed:', error)
  }
}

// Start our backend
startServer()

