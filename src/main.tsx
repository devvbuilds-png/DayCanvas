import { createRoot } from 'react-dom/client'
import 'tldraw/tldraw.css'
import './index.css'
import App from './App.tsx'

// Request persistent storage so the browser doesn't silently evict
// IndexedDB (Dexie todos/lanes/days + tldraw's whiteboard store) under
// storage pressure or after a period of inactivity. This is a best-effort
// browser permission request, not a guarantee — it does not protect
// against the user manually clearing browsing data/cookies.
if (navigator.storage?.persist) {
  navigator.storage.persisted().then((isPersisted) => {
    if (!isPersisted) {
      navigator.storage.persist().then((granted) => {
        console.log(`Persistent storage ${granted ? 'granted' : 'denied'}`)
      })
    }
  })
}

// StrictMode removed in production for tldraw stability:
// React 19 strict effects can double-init the editor in dev,
// and we want dev parity with prod for the whiteboard.
createRoot(document.getElementById('root')!).render(<App />)
