/** 管理页入口。 */

import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { ManagerPage } from './ManagerPage'
import '../styles/glass.css'
import '../styles/panel.css'
import '../styles/manager.css'

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ManagerPage />
    </StrictMode>
  )
}
