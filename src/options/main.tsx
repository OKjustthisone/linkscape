/** 设置页入口。 */

import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { OptionsPage } from './OptionsPage'
import '../styles/glass.css'
import '../styles/options.css'

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <StrictMode>
      <OptionsPage />
    </StrictMode>
  )
}
