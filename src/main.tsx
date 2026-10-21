import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import FaultBoundary from './FaultBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FaultBoundary><App /></FaultBoundary>
  </React.StrictMode>,
)
