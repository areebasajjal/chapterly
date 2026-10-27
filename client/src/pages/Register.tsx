
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import './Login.css'

// Sign Up page for new Chapterly readers
function Register() {

  // Store the information entered by the reader
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Track loading, errors and successful registration
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Runs when the reader submits the Sign Up form
  async function handleRegister(event: FormEvent<HTMLFormElement>) {

    // Prevent the browser from refreshing
    event.preventDefault()

    setError('')

    // Make sure both passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    // Require a password of at least 8 characters
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }

    setLoading(true)

    try {

      // Send the registration details to Express
      const response = await fetch(
        'http://localhost:5050/api/auth/register',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            displayName,
            email,
            password
          })
        }
      )

      // Read the response from the backend
      const result = await response.json()

      // Display an error if registration fails
      if (!response.ok) {
        setError(
          result.error?.message || 'Could not create your account.'
        )
        return
      }

      // Registration was successful
      setSuccess(true)

      // Clear the password fields
      setPassword('')
      setConfirmPassword('')

    } catch (error) {

      // Handle problems connecting to Express
      console.error('Registration error:', error)

      setError('Could not connect to the server. Please try again.')

    } finally {

      // Stop showing the loading message
      setLoading(false)
    }
  }

  return (
    <main className="login-page">

      <div className="login-card">

        {/* Page heading */}
        <div className="login-heading">

          <p className="login-eyebrow">
            BEGIN YOUR READING JOURNEY
          </p>

        </div>

        {/* Show this message after successful registration */}
        {success ? (

          <div className="register-success">

            <h2>You're all set!</h2>

            <p>
              Your Chapterly account has been created.
              Log in to start your reading journey.
            </p>

            <Link to="/login" className="login-button register-login-button">
              Continue to Log In
            </Link>

          </div>

        ) : (

          /* Registration form */
          <form onSubmit={handleRegister} className="login-form">

            {/* Display name */}
            <div className="login-field">

              <label htmlFor="register-name">
                Display name
              </label>

              <input
                id="register-name"
                type="text"
                placeholder="What should we call you?"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
                minLength={2}
                maxLength={60}
                required
              />

            </div>

            {/* Email address */}
            <div className="login-field">

              <label htmlFor="register-email">
                Email address
              </label>

              <input
                id="register-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />

            </div>

            {/* Password */}
            <div className="login-field">

              <label htmlFor="register-password">
                Password
              </label>

              <input
                id="register-password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />

            </div>

            {/* Confirm password */}
            <div className="login-field">

              <label htmlFor="register-confirm-password">
                Confirm password
              </label>

              <input
                id="register-confirm-password"
                type="password"
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />

            </div>

            {/* Show registration errors */}
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            {/* Create account button */}
            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

          </form>

        )}

        {/* Link to existing accounts */}
        {!success && (
          <p className="login-footer">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Log In
            </Link>
          </p>
        )}

      </div>

    </main>
  )
}

export default Register
