import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import SignIn from './pages/SignIn.tsx'
import AdminProvidersPage from './pages/AdminProviders.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/admin/providers" element={<AdminProvidersPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
