import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Trophy, Plus, UsersRound, CalendarDays, Pencil, Trash2,
  ArrowRight, X, CheckCircle2, BookOpen
} from 'lucide-react'
import './ReadingChallenges.css'

type Membership = {
  id: string
  status: 'active' | 'completed' | 'left'
  completedBooks: number
}

type Challenge = {
  id: string
  title: string
  description: string
  targetBooks: number
  startDate: string
  endDate: string
  visibility: 'public' | 'private'
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  isOwner: boolean
  isDemo: boolean
  participantCount: number
  myParticipation: Membership | null
}

type ChallengeForm = {
  title: string
  description: string
  targetBooks: string
  startDate: string
  endDate: string
  visibility: 'public' | 'private'
  status: 'draft' | 'active' | 'completed' | 'cancelled'
}

type Tab = 'all' | 'joined' | 'created'

const API = 'http://localhost:5050/api/challenges'

function dateValue(date: string) {
  return date.slice(0, 10)
}

function formatDate(date: string) {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  })
}

function emptyForm(): ChallengeForm {
  const today = new Date().toISOString().slice(0, 10)
  const later = new Date()
  later.setUTCMonth(later.getUTCMonth() + 2)
  return {
    title: '', description: '', targetBooks: '3',
    startDate: today,
    endDate: later.toISOString().slice(0, 10),
    visibility: 'public', status: 'active'
  }
}

async function apiRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers }
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error?.message || `Request failed (${response.status}).`)
  }
  return body
}

export default function ReadingChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [tab, setTab] = useState<Tab>('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<ChallengeForm>(emptyForm)
  const [progressInputs, setProgressInputs] = useState<Record<string, string>>({})

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(API, { credentials: 'include', signal })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(body?.error?.message || `Could not load challenges (${response.status}).`)
    }
    if (!signal?.aborted) setChallenges(body.data as Challenge[])
  }, [])

//   useEffect(() => {
//     const controller = new AbortController()
//     void refresh(controller.signal)
//       .catch(e => {
//         if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load challenges.')
//       })
//       .finally(() => {
//         if (!controller.signal.aborted) setLoading(false)
//       })
//     return () => controller.abort()
//   }, [refresh])

   
useEffect(() => {
  const controller = new AbortController()

  async function loadChallenges() {
    try {
      const response = await fetch(
        'http://localhost:5050/api/challenges',
        {
          credentials: 'include',
          signal: controller.signal
        }
      )

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          body?.error?.message ||
          `Could not load challenges (${response.status}).`
        )
      }

      if (!controller.signal.aborted) {
        setChallenges(
          Array.isArray(body?.data)
            ? body.data as Challenge[]
            : []
        )
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(
          error instanceof Error
            ? error.message
            : 'Unable to load challenges.'
        )
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }

  void loadChallenges()

  return () => {
    controller.abort()
  }
}, [])


//   async function reload() {
//     setError('')
//     try {
//       await refresh()
//     } catch (e) {
//       setError(e instanceof Error ? e.message : 'Could not refresh challenges.')
//     }
//   }

  async function action(path: string, method: 'POST' | 'PATCH' | 'DELETE', data?: unknown) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await apiRequest(path, {
        method,
        ...(data === undefined ? {} : { body: JSON.stringify(data) })
      })
      await refresh()
      setNotice(response.message || 'Changes saved.')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your changes.')
      return false
    } finally {
      setBusy(false)
    }
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setFormOpen(true)
    setError('')
  }

  function openEdit(challenge: Challenge) {
    setEditingId(challenge.id)
    setForm({
      title: challenge.title,
      description: challenge.description,
      targetBooks: String(challenge.targetBooks),
      startDate: dateValue(challenge.startDate),
      endDate: dateValue(challenge.endDate),
      visibility: challenge.visibility,
      status: challenge.status
    })
    setFormOpen(true)
    setError('')
  }

  async function saveForm() {
    const target = Number(form.targetBooks)
    if (!Number.isInteger(target) || target < 1 || target > 1000) {
      setError('The target must be a whole number between 1 and 1000.')
      return
    }
    if (form.endDate < form.startDate) {
      setError('The end date must be on or after the start date.')
      return
    }
    const payload = {
      title: form.title,
      description: form.description,
      targetBooks: target,
      startDate: form.startDate,
      endDate: form.endDate,
      visibility: form.visibility,
      status: form.status
    }
    const succeeded = await action(
      editingId ? `/${editingId}` : '/',
      editingId ? 'PATCH' : 'POST', payload
    )
    if (succeeded) setFormOpen(false)
  }

  async function deleteChallenge(challenge: Challenge) {
    if (!window.confirm(`Permanently delete "${challenge.title}"? Challenges with participant history cannot be deleted.`)) return
    await action(`/${challenge.id}`, 'DELETE')
  }

  async function saveProgress(challenge: Challenge) {
    const value = Number(progressInputs[challenge.id] ?? challenge.myParticipation?.completedBooks ?? 0)
    if (!Number.isInteger(value) || value < 0 || value > challenge.targetBooks) {
      setError(`Enter a whole number between 0 and ${challenge.targetBooks}.`)
      return
    }
    const saved = await action(`/${challenge.id}/progress`, 'PATCH', { completedBooks: value })
    if (saved) setProgressInputs(previous => {
      const next = { ...previous }
      delete next[challenge.id]
      return next
    })
  }

  const joined = challenges.filter(c => c.myParticipation && c.myParticipation.status !== 'left')
  const created = challenges.filter(c => c.isOwner)
  const visible = challenges.filter(c =>
    tab === 'all' || (tab === 'joined' && c.myParticipation && c.myParticipation.status !== 'left') ||
    (tab === 'created' && c.isOwner)
  )

  const [now] = useState(() => Date.now())

  return (
    <div className="rc-page">
      <section className="rc-hero">
        <div>
          <p className="rc-eyebrow">YOUR READING JOURNEY</p>
          <h1>Reading Challenges</h1>
          <p>Set a reading goal, explore challenges, and keep track of the books you've finished.</p>
        </div>
        <button className="rc-primary" type="button" onClick={openCreate}>
          <Plus size={18} /> Create Challenge
        </button>
      </section>

      <section className="rc-stats" aria-label="Challenge overview">
        <div className="rc-stat"><Trophy size={20}/><strong>{challenges.length}</strong><span>Visible challenges</span></div>
        <div className="rc-stat"><BookOpen size={20}/><strong>{joined.length}</strong><span>My challenges</span></div>
        <div className="rc-stat"><UsersRound size={20}/><strong>{created.length}</strong><span>Created by me</span></div>
      </section>

      <div className="rc-toolbar">
        <div className="rc-tabs" role="group" aria-label="Filter challenges">
          {([
            ['all', 'Explore'],
            ['joined', 'Joined'],
            ['created', 'Created by me']
          ] as const).map(([key, label]) => (
            <button key={key} type="button" className={tab === key ? 'rc-tab active' : 'rc-tab'} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
      </div>

      {error && <p className="rc-error" role="alert">{error}</p>}
      {notice && <p className="rc-success" role="status">{notice}</p>}

      {loading ? (
        <div className="rc-empty">Loading reading challenges…</div>
      ) : visible.length === 0 ? (
        <div className="rc-empty">
          <Trophy size={34}/>
          <h3>No challenges here yet</h3>
          <p>{tab === 'joined' ? 'Explore challenges and join one to get started.' : 'Create a challenge or explore the available reading goals.'}</p>
          {tab !== 'all' && <button type="button" onClick={() => setTab('all')}>Explore challenges <ArrowRight size={15}/></button>}
        </div>
      ) : (
        <div className="rc-grid">
          {visible.map(challenge => {
            const membership = challenge.myParticipation
            const activeMembership = membership?.status === 'active'
            const completedMembership = membership?.status === 'completed'
            const percent = membership ? Math.min(100, Math.round(membership.completedBooks / challenge.targetBooks * 100)) : 0
            const isOpen = challenge.status === 'active' &&
              new Date(challenge.startDate).getTime() <= now &&
              new Date(challenge.endDate).getTime() >= now
            const canJoin = isOpen && (challenge.visibility === 'public' || challenge.isOwner)
            const displayDescription = challenge.description.replace(/^\[DEMO DATA\]\s*/, '')
            return (
              <article className="rc-card" key={challenge.id}>
                <div className="rc-card-heading">
                  <span className={`rc-status rc-${challenge.status}`}>{challenge.status}</span>
                 
                  {challenge.visibility === 'private' && <span className="rc-private">Private</span>}
                </div>
                <h2>{challenge.title}</h2>
                <p className="rc-description">{displayDescription || 'A reading goal worth working toward.'}</p>
                <div className="rc-detail"><Trophy size={16}/><strong>{challenge.targetBooks}</strong> {challenge.targetBooks === 1 ? 'book' : 'books'} to finish</div>
                <div className="rc-detail"><CalendarDays size={16}/>{formatDate(challenge.startDate)} – {formatDate(challenge.endDate)}</div>
                <div className="rc-detail"><UsersRound size={16}/>{challenge.participantCount} participating</div>

                {membership && membership.status !== 'left' && (
                  <div className="rc-progress-panel">
                    <div className="rc-progress-label">
                      <strong>My progress</strong>
                      <span>{membership.completedBooks} / {challenge.targetBooks} books</span>
                    </div>
                    <div className="rc-progress-track"><div style={{ width: `${percent}%` }}/></div>
                    {activeMembership && (
                      <div className="rc-progress-edit">
                        <label htmlFor={`progress-${challenge.id}`}>Books completed</label>
                        <input id={`progress-${challenge.id}`} type="number" min="0" max={challenge.targetBooks} step="1"
                          value={progressInputs[challenge.id] ?? String(membership.completedBooks)}
                          onChange={event => setProgressInputs(prev => ({ ...prev, [challenge.id]: event.target.value }))} />
                        <button type="button" disabled={busy} onClick={() => void saveProgress(challenge)}>Save</button>
                      </div>
                    )}
                    {completedMembership && <p className="rc-completed"><CheckCircle2 size={16}/> Challenge completed!</p>}
                  </div>
                )}

                <div className="rc-actions">
                  {(!membership || membership.status === 'left') && canJoin && (
                    <button type="button" className="rc-join" disabled={busy} onClick={() => void action(`/${challenge.id}/join`, 'POST')}>
                      {membership?.status === 'left' ? 'Rejoin challenge' : 'Join challenge'} <ArrowRight size={16}/>
                    </button>
                  )}
                  {activeMembership && (
                    <button type="button" className="rc-secondary" disabled={busy} onClick={() => void action(`/${challenge.id}/leave`, 'POST')}>Leave challenge</button>
                  )}
                  {!membership && !canJoin && <span className="rc-unavailable">{challenge.status === 'draft' ? 'Draft challenge' : isOpen ? 'Private challenge' : 'Not open for joining'}</span>}
                  {challenge.isOwner && (
                    <div className="rc-owner-actions">
                      <button type="button" title="Edit challenge" aria-label={`Edit ${challenge.title}`} onClick={() => openEdit(challenge)}><Pencil size={17}/></button>
                      <button type="button" title="Delete challenge" aria-label={`Delete ${challenge.title}`} disabled={busy} onClick={() => void deleteChallenge(challenge)}><Trash2 size={17}/></button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="rc-footer-note">
        <Trophy size={20}/>
        <p>Progress is currently entered manually; it is not calculated from your bookshelf yet. <Link to="/library">Open My Library</Link> or <Link to="/journal">log reading time</Link>.</p>
      </div>

      {formOpen && (
        <div className="rc-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setFormOpen(false) }}>
          <div className="rc-modal" role="dialog" aria-modal="true" aria-labelledby="rc-modal-title">
            <div className="rc-modal-heading">
              <div><p className="rc-eyebrow">READING GOAL</p><h2 id="rc-modal-title">{editingId ? 'Edit Challenge' : 'Create a Challenge'}</h2></div>
              <button type="button" aria-label="Close" onClick={() => setFormOpen(false)}><X size={20}/></button>
            </div>
            <form onSubmit={event => { event.preventDefault(); void saveForm() }}>
              <label>Challenge title
                <input required maxLength={100} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Read 5 classics"/>
              </label>
              <label>Description
                <textarea maxLength={500} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is your reading goal?"/>
              </label>
              <label>Number of books
                <input required type="number" min={1} max={1000} step={1} value={form.targetBooks} onChange={e => setForm(f => ({ ...f, targetBooks: e.target.value }))}/>
              </label>
              <div className="rc-form-columns">
                <label>Start date
                  <input required type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}/>
                </label>
                <label>End date
                  <input required type="date" min={form.startDate} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}/>
                </label>
              </div>
              <div className="rc-form-columns">
                <label>Visibility
                  <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value as ChallengeForm['visibility'] }))}>
                    <option value="public">Public</option><option value="private">Private</option>
                  </select>
                </label>
                <label>Status
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ChallengeForm['status'] }))}>
                    <option value="draft">Draft</option><option value="active">Active</option>
                    {editingId && <option value="completed">Completed</option>}
                    {editingId && <option value="cancelled">Cancelled</option>}
                  </select>
                </label>
              </div>
              {error && <p className="rc-error" role="alert">{error}</p>}
              <div className="rc-form-actions">
                <button type="button" className="rc-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" className="rc-primary" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create challenge'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
