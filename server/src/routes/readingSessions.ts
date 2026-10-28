
import { Router, type Request } from 'express'
import mongoose from 'mongoose'

import { ReadingSession } from '../models/ReadingSessions'
import { Book } from '../models/Books'
import { Edition } from '../models/Editions'

type SessionGetter = (req: Request) => string | null

class InvalidInput extends Error {}

function parseFields(
  body: unknown,
  creating: boolean
): Record<string, unknown> {
  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw new InvalidInput('Invalid request body.')
  }

  const input = body as Record<string, unknown>
  const fields: Record<string, unknown> = {}

  const allowed = [
    'readingDate',
    'minutesRead',
    'pagesRead',
    'currentPage',
    'notes',
    'editionId',
    ...(creating ? ['bookId'] : [])
  ]

  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) {
      throw new InvalidInput(
        `Field "${key}" cannot be changed.`
      )
    }
  }

  if (creating && !('minutesRead' in input)) {
    throw new InvalidInput(
      'Reading minutes are required.'
    )
  }

  if ('minutesRead' in input) {
    const value = input.minutesRead

    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 1
    ) {
      throw new InvalidInput(
        'Minutes must be a positive whole number.'
      )
    }

    fields.minutesRead = value
  }

  if ('pagesRead' in input) {
    const value = input.pagesRead

    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw new InvalidInput(
        'Pages read must be a nonnegative whole number.'
      )
    }

    fields.pagesRead = value
  }

  if ('currentPage' in input) {
    const value = input.currentPage

    if (
      value !== null &&
      (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1
      )
    ) {
      throw new InvalidInput(
        'Current page must be positive or null.'
      )
    }

    fields.currentPage = value
  }

  if ('readingDate' in input) {
    const value = input.readingDate

    if (typeof value !== 'string') {
      throw new InvalidInput('Invalid reading date.')
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      throw new InvalidInput('Invalid reading date.')
    }

    fields.readingDate = date
  }

  if ('notes' in input) {
    const value = input.notes

    if (
      typeof value !== 'string' ||
      value.trim().length > 500
    ) {
      throw new InvalidInput(
        'Notes cannot exceed 500 characters.'
      )
    }

    fields.notes = value.trim()
  }

  if ('editionId' in input) {
    const value = input.editionId

    if (
      value !== null &&
      (
        typeof value !== 'string' ||
        !mongoose.isObjectIdOrHexString(value)
      )
    ) {
      throw new InvalidInput('Invalid edition ID.')
    }

    fields.editionId = value
  }

  return fields
}

function sendError(res: any, error: unknown) {
  if (error instanceof InvalidInput) {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: error.message
      }
    })
  }

  console.error('Reading session error:', error)

  return res.status(500).json({
    error: {
      code: 'SESSION_ERROR',
      message: 'Could not complete this operation.'
    }
  })
}

export function createReadingSessionsRouter(
  getSessionUserId: SessionGetter
) {
  const router = Router()

  // All routes require an active login session.
  router.use(async (req, res, next) => {
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

      const user = await mongoose.connection
        .collection('users')
        .findOne(
          { _id: new mongoose.Types.ObjectId(userId) },
          { projection: { status: 1 } }
        )

      if (!user || user.status !== 'active') {
        return res.status(401).json({
          error: {
            code: 'INVALID_SESSION',
            message: 'Your account is unavailable.'
          }
        })
      }

      res.locals.userId = userId
      next()
    } catch (error) {
      sendError(res, error)
    }
  })

  // READ: Retrieve the logged-in user's sessions.
  router.get('/', async (_req, res) => {
    try {
      const sessions = await ReadingSession.find({
        userId: res.locals.userId
      })
        .populate('bookId', 'title coverUrl')
        .populate('editionId', 'format pages isbn13')
        .sort({ readingDate: -1, createdAt: -1 })
        .lean()

      return res.json({
        data: sessions,
        meta: { total: sessions.length }
      })
    } catch (error) {
      return sendError(res, error)
    }
  })

  // READ: Retrieve one session belonging to the user.
  router.get('/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params

      if (!mongoose.isObjectIdOrHexString(sessionId)) {
        throw new InvalidInput('Invalid session ID.')
      }

      const session = await ReadingSession.findOne({
        _id: sessionId,
        userId: res.locals.userId
      })
        .populate('bookId', 'title coverUrl')
        .populate('editionId', 'format pages isbn13')
        .lean()

      if (!session) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Reading session not found.'
          }
        })
      }

      return res.json({ data: session })
    } catch (error) {
      return sendError(res, error)
    }
  })

  // CREATE: Record a new reading session.
  router.post('/', async (req, res) => {
    try {
      const fields = parseFields(req.body, true)
      const bookId = req.body.bookId

      if (
        typeof bookId !== 'string' ||
        !mongoose.isObjectIdOrHexString(bookId)
      ) {
        throw new InvalidInput('Select a valid book.')
      }

      const bookExists = await Book.exists({
        _id: bookId
      })

      if (!bookExists) {
        return res.status(404).json({
          error: {
            code: 'BOOK_NOT_FOUND',
            message: 'Selected book does not exist.'
          }
        })
      }

      if (fields.editionId) {
        const editionExists = await Edition.exists({
          _id: fields.editionId,
          bookId
        })

        if (!editionExists) {
          throw new InvalidInput(
            'Edition does not belong to this book.'
          )
        }
      }

      const session = await ReadingSession.create({
        ...fields,
        bookId,
        userId: res.locals.userId
      })

      return res.status(201).json({
        data: session,
        message: 'Reading session saved.'
      })
    } catch (error) {
      return sendError(res, error)
    }
  })

  // UPDATE: Edit an existing reading session.
  router.patch('/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params

      if (!mongoose.isObjectIdOrHexString(sessionId)) {
        throw new InvalidInput('Invalid session ID.')
      }

      const fields = parseFields(req.body, false)

      if (Object.keys(fields).length === 0) {
        throw new InvalidInput(
          'Provide at least one field to update.'
        )
      }

      const session = await ReadingSession.findOne({
        _id: sessionId,
        userId: res.locals.userId
      })

      if (!session) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Reading session not found.'
          }
        })
      }

      if (fields.editionId) {
        const editionExists = await Edition.exists({
          _id: fields.editionId,
          bookId: session.bookId
        })

        if (!editionExists) {
          throw new InvalidInput(
            'Edition does not belong to this book.'
          )
        }
      }

      session.set(fields)
      await session.save()

      return res.json({
        data: session,
        message: 'Reading session updated.'
      })
    } catch (error) {
      return sendError(res, error)
    }
  })

  // DELETE: Remove the user's reading session.
  router.delete('/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params

      if (!mongoose.isObjectIdOrHexString(sessionId)) {
        throw new InvalidInput('Invalid session ID.')
      }

      const deleted = await ReadingSession.findOneAndDelete({
        _id: sessionId,
        userId: res.locals.userId
      })

      if (!deleted) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Reading session not found.'
          }
        })
      }

      return res.json({
        message: 'Reading session deleted.'
      })
    } catch (error) {
      return sendError(res, error)
    }
  })

  return router
}
