import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const root = document.getElementById('root')

try {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
} catch (e) {
  root.innerHTML = `
    <div style="font-family:sans-serif;padding:40px;max-width:500px;margin:auto">
      <h2 style="color:#dc2626">App failed to load</h2>
      <pre style="background:#f5f5f5;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap">${e.message}</pre>
    </div>
  `
}
