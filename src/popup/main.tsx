/** 弹窗入口。 */

import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { Popup } from './Popup'
import '../styles/glass.css'
import '../styles/popup.css'

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Popup />
    </StrictMode>
  )
}
