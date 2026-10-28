
import 'dotenv/config'
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { User } from '../models/Usertemp'

// This function checks whether a reader is logged in
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {

  // Get the login token from the browser's cookie
  const token = req.cookies?.chapterly_session

  // Reject the request if no login cookie exists
  if (typeof token !== 'string' || !token) {
    res.status(401).json({
      error: {
        code: 'NOT_LOGGED_IN',
        message: 'Please log in first.'
      }
    })
    return
  }

  // Get the secret used to verify login tokens
  const secret = process.env.JWT_SECRET

  if (!secret) {
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Authentication is unavailable.'
      }
    })
    return
  }

  let userId: string

  try {

    // Verify that the token is valid and not expired
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256']
    })

    // Check that the token contains a valid user ID
    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      !mongoose.isObjectIdOrHexString(decoded.sub)
    ) {
      res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Please log in again.'
        }
      })
      return
    }

    // Save the user ID from the verified token
    userId = decoded.sub

  } catch {

    // Reject expired or modified tokens
    res.status(401).json({
      error: {
        code: 'INVALID_SESSION',
        message: 'Your session has expired. Please log in again.'
      }
    })
    return
  }

  try {

    // Make sure this user still exists in MongoDB
    const user = await User.findById(userId)

    // Suspended or deleted accounts cannot access private data
    if (!user || user.status !== 'active') {
      res.status(401).json({
        error: {
          code: 'ACCOUNT_UNAVAILABLE',
          message: 'Please log in again.'
        }
      })
      return
    }

    // Make the verified user ID available to the next function
    res.locals.userId = user._id.toString()

    // Authentication passed, so continue to the requested route
    next()

  } catch (error) {

    console.error('Authentication failed:', error)

    res.status(500).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Could not verify your account.'
      }
    })
  }
}
