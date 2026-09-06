import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { AuthProvider } from '@/context/AuthContext'
import { BusinessProvider } from '@/context/BusinessContext'
import { ToastProvider } from '@/context/ToastContext'
import './index.css'

/**
 * Punto de entrada.
 * Orden de los proveedores:
 *   Router -> Toast -> Business -> Auth
 * (Auth va al final porque puede necesitar mostrar avisos y datos del
 * negocio, pero nadie por encima necesita el usuario.)
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <BusinessProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BusinessProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)
