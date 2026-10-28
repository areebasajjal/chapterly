import { Router, type Request } from 'express'
import mongoose from 'mongoose'

type SessionGetter = (req: Request) => string | null

const asText = (value: unknown) =>
  typeof value === 'string' ? value : ''

const asNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

export function createDashboardRouter(getSessionUserId: SessionGetter) {
  const router = Router()

  router.get('/', async (req, res) => {
    try {
      const sessionId = getSessionUserId(req)

      if (!sessionId || !mongoose.isObjectIdOrHexString(sessionId)) {
        return res.status(401).json({
          error: { code: 'NOT_AUTHENTICATED', message: 'Please log in first.' }
        })
      }

      const userId = new mongoose.Types.ObjectId(sessionId)
      const database = mongoose.connection

      const user = await database.collection('users').findOne(
        { _id: userId },
        { projection: { email: 1, status: 1 } }
      )

      if (!user || user.status !== 'active') {
        return res.status(401).json({
          error: { code: 'INVALID_SESSION', message: 'Your account is unavailable.' }
        })
      }

      const profile = await database.collection('profiles').findOne(
        { userId },
        { projection: { displayName: 1, avatarUrl: 1 } }
      )

      const shelves = await database.collection('bookshelves')
        .find({ userId }, { projection: { _id: 1, name: 1 } })
        .toArray()

      const shelfIds = shelves.map(shelf => shelf._id)
      const entries = shelfIds.length
        ? await database.collection('shelfentries')
            .find(
              { shelfId: { $in: shelfIds } },
              { projection: { shelfId: 1, bookId: 1, currentPage: 1, addedAt: 1 } }
            )
            .toArray()
        : []

      const shelfById = new Map(
        shelves.map(shelf => [String(shelf._id), asText(shelf.name).toLowerCase()])
      )

      const entriesFor = (name: string) => entries.filter(entry =>
        shelfById.get(String(entry.shelfId)) === name.toLowerCase()
      )

      const reading = entriesFor('currently reading')
      const read = entriesFor('read')
      const want = entriesFor('want to read')

      const [totals] = await database.collection('readingsessions').aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            minutes: { $sum: '$minutesRead' },
            pages: { $sum: '$pagesRead' }
          }
        }
      ]).toArray()

      const demoSessionCount = await database.collection('readingsessions').countDocuments({
        userId, notes: /^\[DEMO DATA\]/
      })

      const recentSessions = await database.collection('readingsessions')
        .find(
          { userId },
          { projection: { bookId: 1, readingDate: 1, minutesRead: 1, pagesRead: 1 } }
        )
        .sort({ readingDate: -1, _id: -1 })
        .limit(5)
        .toArray()

      // Use UTC day boundaries consistently in MongoDB and the chart.
      const today = new Date()
      const firstDay = new Date(Date.UTC(
        today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 6
      ))

      const weekRows = await database.collection('readingsessions').aggregate([
        { $match: { userId, readingDate: { $gte: firstDay, $lte: today } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$readingDate', timezone: 'UTC' } },
            minutes: { $sum: '$minutesRead' }
          }
        }
      ]).toArray()

      const weekMap = new Map(weekRows.map(row => [String(row._id), asNumber(row.minutes)]))
      const activity = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(firstDay)
        date.setUTCDate(firstDay.getUTCDate() + index)
        const day = date.toISOString().slice(0, 10)
        return { day, minutes: weekMap.get(day) ?? 0 }
      })

      const participantRows = await database.collection('challengeparticipants')
        .find(
          { userId, status: { $in: ['active', 'completed'] } },
          { projection: { challengeId: 1, completedBooks: 1, status: 1 } }
        )
        .limit(3)
        .toArray()

      const challengeDocs = participantRows.length
        ? await database.collection('readingchallenges')
            .find({ _id: { $in: participantRows.map(p => p.challengeId) } },
              { projection: { title: 1, targetBooks: 1, status: 1 } })
            .toArray()
        : []

      const challengeById = new Map(challengeDocs.map(doc => [String(doc._id), doc]))
      const challenges = participantRows.flatMap(participant => {
        const challenge = challengeById.get(String(participant.challengeId))
        if (!challenge) return []
        return [{
          id: String(challenge._id),
          title: asText(challenge.title),
          targetBooks: asNumber(challenge.targetBooks),
          completedBooks: asNumber(participant.completedBooks),
          status: asText(participant.status)
        }]
      })

      const savedBookIds = [...new Set(entries.map(entry => String(entry.bookId)))]
        .filter(id => mongoose.isObjectIdOrHexString(id))
        .map(id => new mongoose.Types.ObjectId(id))

      const recentBookIds = recentSessions.map(session => String(session.bookId))
        .filter(id => mongoose.isObjectIdOrHexString(id))
        .map(id => new mongoose.Types.ObjectId(id))

      const bookDocs = await database.collection('books')
        .find(
          { _id: { $in: [...savedBookIds, ...recentBookIds] } },
          { projection: { title: 1, coverUrl: 1 } }
        )
        .toArray()
      const bookById = new Map(bookDocs.map(book => [String(book._id), book]))

      const continueReading = reading.slice(0, 4).flatMap(entry => {
        const book = bookById.get(String(entry.bookId))
        if (!book) return []
        return [{
          id: String(book._id),
          title: asText(book.title),
          coverUrl: asText(book.coverUrl),
          currentPage: typeof entry.currentPage === 'number' ? entry.currentPage : null
        }]
      })

      const recent = recentSessions.map(session => ({
        id: String(session._id),
        bookId: String(session.bookId),
        bookTitle: asText(bookById.get(String(session.bookId))?.title) || 'Unknown book',
        readingDate: session.readingDate,
        minutesRead: asNumber(session.minutesRead),
        pagesRead: asNumber(session.pagesRead)
      }))

      const featuredQuote = await database.collection('quotes').findOne(
        {
          visibility: 'public',
          quoteType: { $in: ['verified_excerpt', 'editorial_highlight'] },
          ...(savedBookIds.length ? { bookId: { $in: savedBookIds } } : {})
        },
        { projection: { quoteText: 1, quoteType: 1, bookId: 1 } }
      )

      const quoteBook = featuredQuote
        ? bookById.get(String(featuredQuote.bookId)) ?? await database.collection('books').findOne(
            { _id: featuredQuote.bookId }, { projection: { title: 1 } }
          )
        : null

      const explore = await database.collection('books')
        .find(
          { _id: { $nin: savedBookIds } },
          { projection: { title: 1, coverUrl: 1 } }
        )
        .sort({ title: 1 })
        .limit(4)
        .toArray()

      return res.json({
        data: {
          reader: {
            displayName: asText(profile?.displayName) || asText(user.email).split('@')[0],
            avatarUrl: asText(profile?.avatarUrl)
          },
          stats: {
            booksRead: read.length,
            currentlyReading: reading.length,
            wantToRead: want.length,
            readingSessions: asNumber(totals?.sessions),
            demoSessions: demoSessionCount,
            minutesRead: asNumber(totals?.minutes),
            pagesRead: asNumber(totals?.pages)
          },
          continueReading,
          recentSessions: recent,
          activity,
          challenges,
          featuredQuote: featuredQuote && quoteBook ? {
            text: asText(featuredQuote.quoteText),
            type: asText(featuredQuote.quoteType),
            bookId: String(featuredQuote.bookId),
            bookTitle: asText(quoteBook.title)
          } : null,
          explore: explore.map(book => ({
            id: String(book._id), title: asText(book.title), coverUrl: asText(book.coverUrl)
          }))
        }
      })
    } catch (error) {
      console.error('Chapterly dashboard error:', error)
      return res.status(500).json({
        error: { code: 'DASHBOARD_ERROR', message: 'Could not load your dashboard.' }
      })
    }
  })

  return router
}
