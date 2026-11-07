import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import './index.css'
import App from './App.tsx'

// Compatibility shim: @iwer/devui (built against Three r165) calls material.onBuild(),
// which was removed from THREE.Material.prototype in Three r173+.
;(THREE.Material.prototype as unknown as { onBuild?: () => void }).onBuild ??= () => {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
