
import 'dotenv/config'
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.DB_NAME || 'chapterly'

async function checkDatabase() {
  if (!MONGODB_URI) {
    throw new Error('MongoDB connection string is missing.')
  }

  // Connect to our existing Chapterly database.
  await mongoose.connect(MONGODB_URI, {
    dbName: DB_NAME
  })

  const db = mongoose.connection.db

  if (!db) {
    throw new Error('Database connection failed.')
  }

  console.log('\nCHAPTERLY DATABASE REPORT')
  console.log('Database:', db.databaseName)
  console.log('----------------------------------------')

  // Find collections that actually exist in MongoDB.
  const collections = await db.listCollections().toArray()

  let totalDocuments = 0

  for (const collection of collections.sort(
    (a, b) => a.name.localeCompare(b.name)
  )) {
    // Count the documents inside each collection.
    const count = await db
      .collection(collection.name)
      .countDocuments()

    console.log(`${collection.name}: ${count}`)

    totalDocuments += count
  }

  console.log('----------------------------------------')
  console.log('Total collections:', collections.length)
  console.log('Total documents:', totalDocuments)

  await mongoose.disconnect()
}

checkDatabase().catch(async (error) => {
  console.error('Database check failed:', error)
  await mongoose.disconnect()
  process.exitCode = 1
})
