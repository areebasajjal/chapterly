
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import './login.css'

function Login() {

  // Store the email and password entered by the reader
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Track whether the login request is running
  const [loading, setLoading] = useState(false)

  // Store any login error message
  const [error, setError] = useState('')

  // Allows us to move to another page after login
  const navigate = useNavigate()

  // Runs when the reader submits the login form
  async function handleLogin(event: FormEvent<HTMLFormElement>) {

    // Stop the browser from refreshing the page
    event.preventDefault()

    setLoading(true)
    setError('')

    try {

      // Send the entered credentials to our Express backend
      const response = await fetch(
        'http://localhost:5050/api/auth/login',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          // Allow the browser to receive the login cookie
          credentials: 'include',

          body: JSON.stringify({
            email,
            password
          })
        }
      )

      // Read the response sent by Express
      const result = await response.json()

      // Show an error if the credentials are incorrect
      if (!response.ok) {
        setError(
          result.error?.message || 'Unable to log in.'
        )
        return
      }

      // Login successful!
      // Move the reader to the Discover page
      navigate('/discover')

    } catch (error) {

      // This happens if the server cannot be reached
      console.error('Login error:', error)

      setError(
        'Could not connect to the server. Please try again.'
      )

    } finally {

      // Stop showing the loading state
      setLoading(false)
    }
  }

  return (
    <main className="login-page">

      <div className="login-card">

        {/* Small heading above the form */}
        <div className="login-heading">

          <p className="login-eyebrow">
            YOUR READING SPACE
          </p>

          <h1>Welcome back.</h1>

          <p className="login-description">
            Log in to continue your reading journey.
            Your next chapter is waiting.
          </p>

        </div>

        {/* Reader login form */}
        <form onSubmit={handleLogin} className="login-form">

          {/* Email input */}
          <div className="login-field">

            <label htmlFor="login-email">
              Email address
            </label>

            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

          </div>

          {/* Password input */}
          <div className="login-field">

            <label htmlFor="login-password">
              Password
            </label>

            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />

          </div>

          {/* Display an error if login fails */}
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          {/* Submit the form */}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>

        </form>

        {/* Decorative message */}
                <p className="login-footer">
        Don't have an account?{' '}
        <Link to="/register" className="auth-link">
            Sign Up
        </Link>
        </p>

      </div>

    </main>
  )
}

export default Login
