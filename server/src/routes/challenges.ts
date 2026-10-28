import { Router, type Request, type Response } from 'express'
import mongoose from 'mongoose'

import { ReadingChallenge } from '../models/ReadingChallenges'
import { ChallengeParticipant } from '../models/ChallengeParticipants'

type SessionGetter = (request: Request) => string | null

type ChallengeInput = {
    title?: string
    description?: string
    targetBooks?: number
    startDate?: Date
    endDate?: Date
    visibility?: 'public' | 'private'
    status?: 'draft' | 'active' | 'completed' | 'cancelled'
}

class BadRequest extends Error { }

function isId(value: unknown): value is string {
    return typeof value === 'string' && mongoose.isObjectIdOrHexString(value)
}

function parseCalendarDate(value: unknown, lastMoment: boolean): Date {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new BadRequest('Enter a valid date in YYYY-MM-DD format.')
    }
    const date = new Date(`${value}T${lastMoment ? '23:59:59.999' : '00:00:00.000'}Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new BadRequest('The selected date is invalid.')
    }
    return date
}

function validateChallenge(body: unknown, creating: boolean): ChallengeInput {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new BadRequest('Provide challenge details.')
    }

    const data = body as Record<string, unknown>
    const allowed = ['title', 'description', 'targetBooks', 'startDate', 'endDate', 'visibility', 'status']
    for (const key of Object.keys(data)) {
        if (!allowed.includes(key)) throw new BadRequest(`Cannot change field: ${key}`)
    }
    if (!creating && Object.keys(data).length === 0) {
        throw new BadRequest('Provide at least one field to update.')
    }

    const result: ChallengeInput = {}
    if (creating || Object.hasOwn(data, 'title')) {
        if (typeof data.title !== 'string' || !data.title.trim() || data.title.trim().length > 100) {
            throw new BadRequest('Challenge title must be 1–100 characters.')
        }
        result.title = data.title.trim()
    }
    if (creating || Object.hasOwn(data, 'description')) {
        if (data.description !== undefined && typeof data.description !== 'string') {
            throw new BadRequest('Description must be text.')
        }
        const description = typeof data.description === 'string' ? data.description.trim() : ''
        if (description.length > 500) throw new BadRequest('Description cannot exceed 500 characters.')
        result.description = description
    }
    if (creating || Object.hasOwn(data, 'targetBooks')) {
        if (typeof data.targetBooks !== 'number' || !Number.isInteger(data.targetBooks) || data.targetBooks < 1 || data.targetBooks > 1000) {
            throw new BadRequest('Reading goal must be a whole number between 1 and 1000.')
        }
        result.targetBooks = data.targetBooks
    }
    if (creating || Object.hasOwn(data, 'startDate')) {
        result.startDate = parseCalendarDate(data.startDate, false)
    }
    if (creating || Object.hasOwn(data, 'endDate')) {
        result.endDate = parseCalendarDate(data.endDate, true)
    }
    if (creating || Object.hasOwn(data, 'visibility')) {
        if (data.visibility !== undefined && data.visibility !== 'public' && data.visibility !== 'private') {
            throw new BadRequest('Visibility must be public or private.')
        }
        result.visibility = data.visibility === 'public' ? 'public' : 'private'
    }
    if (creating || Object.hasOwn(data, 'status')) {
        if (data.status !== undefined && !['draft', 'active', 'completed', 'cancelled'].includes(String(data.status))) {
            throw new BadRequest('Invalid challenge status.')
        }
        result.status = (data.status ?? 'draft') as ChallengeInput['status']
    }
    return result
}

function handleError(response: Response, error: unknown) {
    if (error instanceof BadRequest) {
        return response.status(400).json({ error: { code: 'INVALID_INPUT', message: error.message } })
    }
    if ((error as { code?: number })?.code === 11000) {
        return response.status(409).json({ error: { code: 'ALREADY_JOINED', message: 'You have already joined this challenge.' } })
    }
    console.error('Reading Challenges error:', error)
    return response.status(500).json({ error: { code: 'CHALLENGE_ERROR', message: 'Could not complete this action.' } })
}

export function createChallengesRouter(getSessionUserId: SessionGetter) {
    const router = Router()

    router.use(async (request, response, next) => {
        try {
            const sessionId = getSessionUserId(request)
            if (!isId(sessionId)) {
                response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'Please sign in.' } })
                return
            }
            const userId = new mongoose.Types.ObjectId(sessionId)
            const user = await mongoose.connection.collection('users').findOne(
                { _id: userId },
                { projection: { status: 1 } }
            )
            if (!user || user.status !== 'active') {
                response.status(401).json({ error: { code: 'INVALID_SESSION', message: 'Your session is unavailable.' } })
                return
            }
            response.locals.userId = userId
            next()
        } catch (error) {
            handleError(response, error)
        }
    })

    // READ: Public active challenges, authored challenges, and challenges already joined.
    router.get('/', async (_request, response) => {
        try {
            const userId = response.locals.userId as mongoose.Types.ObjectId
            const memberships = await ChallengeParticipant.find({ userId }).lean()
            const joinedIds = memberships.map(p => p.challengeId)
            const challenges = await ReadingChallenge.find({
                $or: [
                    { visibility: 'public', status: 'active' },
                    { creatorId: userId },
                    { _id: { $in: joinedIds } }
                ]
            }).sort({ createdAt: -1 }).lean()

            const ids = challenges.map(c => c._id)
            const memberCounts = ids.length
                ? await ChallengeParticipant.aggregate<{ _id: mongoose.Types.ObjectId, count: number }>([
                    { $match: { challengeId: { $in: ids }, status: { $in: ['active', 'completed'] } } },
                    { $group: { _id: '$challengeId', count: { $sum: 1 } } }
                ])
                : []
            const countMap = new Map(memberCounts.map(row => [String(row._id), row.count]))
            const membershipMap = new Map(memberships.map(p => [String(p.challengeId), p]))

            const result = challenges.map(challenge => {
                const membership = membershipMap.get(String(challenge._id))
                return {
                    id: String(challenge._id),
                    title: challenge.title,
                    description: challenge.description,
                    targetBooks: challenge.targetBooks,
                    startDate: challenge.startDate,
                    endDate: challenge.endDate,
                    visibility: challenge.visibility,
                    status: challenge.status,
                    isOwner: String(challenge.creatorId) === String(userId),
                    participantCount: countMap.get(String(challenge._id)) ?? 0,
                    isDemo: String(challenge.description ?? '').startsWith('[DEMO DATA]'),
                    myParticipation: membership ? {
                        id: String(membership._id),
                        status: membership.status,
                        completedBooks: membership.completedBooks
                    } : null
                }
            })
            return response.json({ data: result, meta: { total: result.length } })
        } catch (error) {
            return handleError(response, error)
        }
    })

    // CREATE: Authenticated users can create draft or active challenges.
    router.post('/', async (request, response) => {
        try {
            const fields = validateChallenge(request.body, true)
            if (!fields.startDate || !fields.endDate || fields.endDate <= fields.startDate) {
                throw new BadRequest('The end date must be after the start date.')
            }
            const challenge = await ReadingChallenge.create({
                ...fields,
                creatorId: response.locals.userId
            })
            return response.status(201).json({ data: challenge, message: 'Challenge created.' })
        } catch (error) {
            return handleError(response, error)
        }
    })

    // UPDATE: Only the challenge creator can edit its settings.
    router.patch('/:id', async (request, response) => {
        try {
            if (!isId(request.params.id)) throw new BadRequest('Invalid challenge ID.')
            const fields = validateChallenge(request.body, false)
            const challenge = await ReadingChallenge.findOne({
                _id: request.params.id,
                creatorId: response.locals.userId
            })
            if (!challenge) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Challenge not found or not yours.' } })
            const start = fields.startDate ?? challenge.startDate
            const end = fields.endDate ?? challenge.endDate
            if (end <= start) throw new BadRequest('The end date must be after the start date.')
            if (fields.targetBooks !== undefined && fields.targetBooks !== challenge.targetBooks) {
                const hasMembers = await ChallengeParticipant.exists({ challengeId: challenge._id })
                if (hasMembers) throw new BadRequest('Reading targets cannot change after someone has joined. Edit other details instead.')
            }
            challenge.set(fields)
            await challenge.save()
            return response.json({ data: challenge, message: 'Challenge updated.' })
        } catch (error) {
            return handleError(response, error)
        }
    })

    // DELETE: Protect participation history; only delete unused challenges.
    router.delete('/:id', async (request, response) => {
        try {
            if (!isId(request.params.id)) throw new BadRequest('Invalid challenge ID.')
            const challenge = await ReadingChallenge.findOne({
                _id: request.params.id,
                creatorId: response.locals.userId
            })
            if (!challenge) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Challenge not found or not yours.' } })
            const hasParticipants = await ChallengeParticipant.exists({ challengeId: challenge._id })
            if (hasParticipants) {
                return response.status(409).json({
                    error: {
                        code: 'HAS_PARTICIPANTS',
                        message: 'This challenge has participation history. Change its status to Cancelled instead.'
                    }
                })
            }
            await ReadingChallenge.deleteOne({ _id: challenge._id, creatorId: response.locals.userId })
            return response.json({ message: 'Challenge deleted.' })
        } catch (error) {
            return handleError(response, error)
        }
    })

    // JOIN: A public, active challenge can be joined during its scheduled dates.
    router.post('/:id/join', async (request, response) => {
        try {
            if (!isId(request.params.id)) throw new BadRequest('Invalid challenge ID.')
            const userId = response.locals.userId as mongoose.Types.ObjectId
            const challenge = await ReadingChallenge.findById(request.params.id).lean()
            if (!challenge) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Challenge not found.' } })
            const now = new Date()
            const eligible = challenge.status === 'active' &&
                (challenge.visibility === 'public' || String(challenge.creatorId) === String(userId)) &&
                challenge.startDate <= now && challenge.endDate >= now
            if (!eligible) return response.status(403).json({ error: { code: 'NOT_OPEN', message: 'This challenge is not open for joining.' } })

            const existing = await ChallengeParticipant.findOne({ userId, challengeId: challenge._id })
            if (existing) {
                if (existing.status !== 'left') return response.status(409).json({ error: { code: 'ALREADY_JOINED', message: 'You are already participating.' } })
                existing.status = 'active'
                existing.completedBooks = 0
                existing.completedAt = null
                existing.joinedAt = now
                await existing.save()
            } else {
                await ChallengeParticipant.create({ userId, challengeId: challenge._id, status: 'active', completedBooks: 0, joinedAt: now })
            }
            return response.json({ message: 'You joined the challenge.' })
        } catch (error) {
            return handleError(response, error)
        }
    })

    // LEAVE: Keep a membership record so the original join is auditable.
    router.post('/:id/leave', async (request, response) => {
        try {
            if (!isId(request.params.id)) throw new BadRequest('Invalid challenge ID.')
            const membership = await ChallengeParticipant.findOne({
                challengeId: request.params.id,
                userId: response.locals.userId,
                status: 'active'
            })
            if (!membership) return response.status(404).json({ error: { code: 'NOT_JOINED', message: 'No active membership found.' } })
            membership.status = 'left'
            membership.completedAt = null
            await membership.save()
            return response.json({ message: 'You left the challenge.' })
        } catch (error) {
            return handleError(response, error)
        }
    })

    // UPDATE progress: Explicitly tracked counts, not inferred automatically from shelf status.
    router.patch('/:id/progress', async (request, response) => {
        try {
            if (!isId(request.params.id)) throw new BadRequest('Invalid challenge ID.')
            const completedBooks = (request.body as { completedBooks?: unknown } | undefined)?.completedBooks
            if (typeof completedBooks !== 'number' || !Number.isInteger(completedBooks) || completedBooks < 0) {
                throw new BadRequest('Completed books must be a nonnegative whole number.')
            }
            const membership = await ChallengeParticipant.findOne({
                challengeId: request.params.id,
                userId: response.locals.userId,
                status: 'active'
            })
            if (!membership) return response.status(404).json({ error: { code: 'NOT_JOINED', message: 'Join the challenge first.' } })
            const challenge = await ReadingChallenge.findById(membership.challengeId).lean()
            if (!challenge) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Challenge not found.' } })
            if (completedBooks > challenge.targetBooks) throw new BadRequest('Progress cannot exceed the reading goal.')
            membership.completedBooks = completedBooks
            if (completedBooks === challenge.targetBooks) {
                membership.status = 'completed'
                membership.completedAt = new Date()
            }
            await membership.save()
            return response.json({ data: membership, message: 'Progress saved.' })
        } catch (error) {
            return handleError(response, error)
        }
    })

    return router
}
