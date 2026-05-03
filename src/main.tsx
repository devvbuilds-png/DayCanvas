import { createRoot } from 'react-dom/client'
import 'tldraw/tldraw.css'
import './index.css'
import App from './App.tsx'

// StrictMode removed in production for tldraw stability:
// React 19 strict effects can double-init the editor in dev,
// and we want dev parity with prod for the whiteboard.
createRoot(document.getElementById('root')!).render(<App />)
