
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { Book } from './models/Books'

const app = express()

const PORT = process.env.PORT || 5050
const DB_NAME = process.env.DB_NAME || 'chapterly'
const MONGODB_URI = process.env.MONGODB_URI

app.use(cors({
  origin: 'http://localhost:5173'
}))

app.use(express.json())

// Check if the backend and database are connected
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Chapterly API is running',
    database: mongoose.connection.name,
    connected: mongoose.connection.readyState === 1
  })
})


app.get('/api/books', async (req, res) => {
  try {
    const books = await Book.find().sort({ title: 1 })

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


app.get('/api/books/:id', async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Invalid book ID'
        }
      })
    }

    const book = await Book.findById(id)

    if (!book) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Book not found'
        }
      })
    }

    res.json({ data: book })

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


// Connect to MongoDB before starting the server
async function startServer() {
  if (!MONGODB_URI) {
    console.error('MongoDB connection string is missing')
    return
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME
    })

    console.log(`Connected to MongoDB: ${mongoose.connection.name}`)

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`)
    })

  } catch (error) {
    console.error('MongoDB connection failed:', error)
  }
}

startServer()
