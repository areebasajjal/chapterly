
import 'dotenv/config'
import mongoose from 'mongoose'

import { Book } from '../models/Books'
import { Publisher } from '../models/Publsihers'
import { Edition } from '../models/Editions'

const DB_NAME = process.env.DB_NAME || 'chapterly'
const MONGODB_URI = process.env.MONGODB_URI

// Preview by default. Add --apply to save changes.
const APPLY = process.argv.includes('--apply')

const getNumberArg = (name: string, fallback: number) => {
  const argument = process.argv.find((arg) =>
    arg.startsWith(`--${name}=`)
  )

  if (!argument) return fallback

  const value = Number(argument.split('=')[1])

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid --${name} value.`)
  }

  return value
}

const LIMIT = Math.min(getNumberArg('limit', 10), 20)
const OFFSET = getNumberArg('offset', 0)

// Keep public API requests at a conservative rate.
let lastRequestTime = 0

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function fetchOpenLibrary<T>(url: string): Promise<T> {
  const delay = Math.max(
    0,
    1200 - (Date.now() - lastRequestTime)
  )

  if (delay > 0) {
    await sleep(delay)
  }

  lastRequestTime = Date.now()

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ChapterlyEducationalProject/1.0'
    },
    signal: AbortSignal.timeout(15000)
  })

  if (!response.ok) {
    throw new Error(`Open Library HTTP ${response.status}`)
  }

  return (await response.json()) as T
}

// Normalize punctuation and capitalization before matching.
function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function authorMatches(
  expected: string,
  candidates: string[] = []
) {
  const expectedName = normalize(expected)
  const expectedParts = expectedName.split(' ')

  return candidates.some((candidate) => {
    const candidateName = normalize(candidate)

    if (candidateName === expectedName) return true

    const parts = candidateName.split(' ')

    // Also handle differences in middle initials.
    return (
      expectedParts.length >= 2 &&
      parts.includes(expectedParts[0]) &&
      parts.includes(expectedParts[expectedParts.length - 1])
    )
  })
}

function validIsbn13(values: string[] = []) {
  for (const value of values) {
    const isbn = value.replace(/\D/g, '')

    if (isbn.length !== 13) continue

    const total = isbn
      .slice(0, 12)
      .split('')
      .reduce(
        (sum, digit, index) =>
          sum + Number(digit) * (index % 2 === 0 ? 1 : 3),
        0
      )

    const checkDigit = (10 - (total % 10)) % 10

    if (checkDigit === Number(isbn[12])) {
      return isbn
    }
  }

  return ''
}

function getFormat(value?: string) {
  const format = (value || '').toLowerCase()

  if (format.includes('paperback')) return 'paperback'
  if (format.includes('hardcover')) return 'hardcover'
  if (format.includes('hardback')) return 'hardcover'
  if (format.includes('audio')) return 'audiobook'
  if (format.includes('ebook') || format.includes('e-book')) {
    return 'ebook'
  }

  return 'other'
}

function getYear(value?: string) {
  const match = value?.match(/\b(1[4-9]\d{2}|20\d{2}|2100)\b/)

  return match ? Number(match[1]) : undefined
}

type SearchResult = {
  docs: {
    key: string
    title: string
    author_name?: string[]
  }[]
}

type OpenLibraryEdition = {
  key: string
  title?: string
  publishers?: string[]
  isbn_13?: string[]
  physical_format?: string
  publish_date?: string
  number_of_pages?: number
  covers?: number[]
  languages?: {
    key: string
  }[]
}

type EditionsResult = {
  entries: OpenLibraryEdition[]
}

// Find a work whose title and author match our existing book.
async function findWork(title: string, author: string) {
  const url = new URL('https://openlibrary.org/search.json')

  url.searchParams.set('title', title)
  url.searchParams.set('author', author)
  url.searchParams.set('limit', '10')
  url.searchParams.set('fields', 'key,title,author_name')

  const result = await fetchOpenLibrary<SearchResult>(
    url.toString()
  )

  const matches = result.docs.filter(
    (item) =>
      normalize(item.title) === normalize(title) &&
      authorMatches(author, item.author_name)
  )

  // Never guess when multiple works match.
  if (matches.length !== 1) return null

  const key = matches[0].key

  if (!/^\/works\/OL\d+W$/.test(key)) {
    return null
  }

  return key
}


async function findEdition(workKey: string, bookTitle: string) {
  const url = new URL(
    `https://openlibrary.org${workKey}/editions.json`
  )

  url.searchParams.set('limit', '50')

  const result = await fetchOpenLibrary<EditionsResult>(
    url.toString()
  )

  // Keep editions with clear English-language metadata.
  const candidates = result.entries.filter((edition) => {
    const publisher = edition.publishers?.[0]?.trim()

    if (!publisher || publisher.length > 150) {
      return false
    }

    if (normalize(edition.title || '') !== normalize(bookTitle)) {
      return false
    }

    // Don't assume an edition is English when language is missing.
    const isEnglish = edition.languages?.some(
      (language) => language.key === '/languages/eng'
    )

    if (!isEnglish) {
      return false
    }

    // Require a recognizable format and a valid ISBN-13.
    if (getFormat(edition.physical_format) === 'other') {
      return false
    }

    if (!validIsbn13(edition.isbn_13)) {
      return false
    }

    return true
  })

  // Prefer print editions with complete bibliographic information.
  candidates.sort((a, b) => {
    function score(edition: OpenLibraryEdition) {
      let points = 0

      const format = getFormat(edition.physical_format)

      if (format === 'paperback' || format === 'hardcover') {
        points += 5
      }

      if (edition.number_of_pages) points += 3
      if (getYear(edition.publish_date)) points += 2
      if (edition.covers?.some((cover) => cover > 0)) {
        points += 1
      }

      return points
    }

    return score(b) - score(a)
  })

  return candidates[0] || null
}



async function importData() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from .env')
  }

  await mongoose.connect(MONGODB_URI, {
    dbName: DB_NAME
  })

  try {
    const db = mongoose.connection.db

    if (!db) {
      throw new Error('Database connection failed.')
    }

    // Read the existing author names without changing them.
    const authors = await db
      .collection('authors')
      .find({}, { projection: { name: 1 } })
      .toArray()

    const authorNames = new Map(
      authors.map((author) => [
        String(author._id),
        String(author.name)
      ])
    )

    // Work with the books already stored in Chapterly.
    const books = await Book.find()
      .sort({ title: 1 })
      .skip(OFFSET)
      .limit(LIMIT)
      .lean()

    const existingBookIds = new Set(
      (await Edition.distinct('bookId')).map(String)
    )

    let imported = 0
    let skipped = 0
    let failed = 0

    console.log('\nCHAPTERLY METADATA IMPORT')
    console.log('Database:', DB_NAME)
    console.log('Mode:', APPLY ? 'IMPORT' : 'PREVIEW')
    console.log('Offset:', OFFSET)
    console.log('Batch size:', LIMIT)
    console.log('----------------------------------------')

    for (const book of books) {
      const bookId = String(book._id)

      // Preserve any editions we previously created.
      if (existingBookIds.has(bookId)) {
        console.log(`SKIP: ${book.title} (already has an edition)`)
        skipped++
        continue
      }

      const author = book.authorIds
        ?.map((id) => authorNames.get(String(id)))
        .find((name): name is string => Boolean(name))

      if (!author) {
        console.log(`SKIP: ${book.title} (missing author)`)
        skipped++
        continue
      }

      try {
        const workKey = await findWork(book.title, author)

        if (!workKey) {
          console.log(`SKIP: ${book.title} (no reliable match)`)
          skipped++
          continue
        }

        const edition = await findEdition(workKey, book.title)

        if (!edition) {
          console.log(`SKIP: ${book.title} (no suitable edition)`)
          skipped++
          continue
        }

        const publisherName = edition.publishers![0].trim()
        const isbn13 = validIsbn13(edition.isbn_13)
        const publicationYear = getYear(edition.publish_date)
        const format = getFormat(edition.physical_format)

        const pageCount =
          typeof edition.number_of_pages === 'number' &&
          Number.isInteger(edition.number_of_pages) &&
          edition.number_of_pages > 0
            ? edition.number_of_pages
            : undefined

        const coverId = edition.covers?.find(
          (cover) => Number.isInteger(cover) && cover > 0
        )

        const coverUrl = coverId
          ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
          : ''

        const language = edition.languages?.some(
          (item) => item.key.endsWith('/eng')
        )
          ? 'English'
          : 'Unknown'

        console.log(`\nMATCH: ${book.title}`)
        console.log('Author:', author)
        console.log('Publisher:', publisherName)
        console.log('Format:', format)
        console.log('ISBN-13:', isbn13 || 'Not available')
        console.log('Year:', publicationYear ?? 'Not available')
        console.log('Pages:', pageCount ?? 'Not available')
        console.log('Source:', `https://openlibrary.org${edition.key}`)

        if (!APPLY) {
          console.log('PREVIEW ONLY: No changes saved.')
          continue
        }

        // Save publisher, edition and book link together.
        await mongoose.connection.transaction(async (session) => {
          const escapedName = publisherName.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
          )

          let publisher = await Publisher.findOne({
            name: {
              $regex: `^${escapedName}$`,
              $options: 'i'
            }
          }).session(session)

          if (!publisher) {
            const created = await Publisher.create(
              [{
                name: publisherName,
                country: '',
                website: ''
              }],
              { session }
            )

            publisher = created[0]
          }

          // Create one real edition for the existing book.
          await Edition.create(
            [{
              bookId: book._id,
              publisherId: publisher._id,
              isbn13,
              format,
              ...(publicationYear ? { publicationYear } : {}),
              ...(pageCount ? { pageCount } : {}),
              language,
              coverUrl
            }],
            { session }
          )

          // Link the book to this publisher if not linked yet.
          await Book.updateOne(
            {
              _id: book._id,
              publisherId: null
            },
            {
              $set: {
                publisherId: publisher._id
              }
            },
            { session }
          )
        })

        existingBookIds.add(bookId)
        imported++

        console.log('SAVED successfully.')

      } catch (error) {
        failed++
        console.error(`FAILED: ${book.title}`, error)

        // Stop rather than repeatedly request after rate limiting.
        if (
          error instanceof Error &&
          error.message.includes('HTTP 429')
        ) {
          console.error('Open Library rate limit reached.')
          break
        }
      }
    }

    console.log('\n----------------------------------------')
    console.log('Import completed.')
    console.log('New editions:', imported)
    console.log('Skipped:', skipped)
    console.log('Failed:', failed)

    if (!APPLY) {
      console.log('This was a preview. MongoDB was not changed.')
    }
  } finally {
    await mongoose.disconnect()
  }
}

importData().catch((error) => {
  console.error('Import failed:', error)
  process.exitCode = 1
})
