import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Safari pinch-zoom — viewport user-scalable=no is often ignored.
document.addEventListener('gesturestart', (e) => e.preventDefault())
document.addEventListener('gesturechange', (e) => e.preventDefault())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
