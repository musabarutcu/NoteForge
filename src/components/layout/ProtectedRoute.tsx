import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { FullPageSpinner } from '@/components/ui/Spinner'
import type { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading } = useAuthStore()
  const location = useLocation()

  if (loading) return <FullPageSpinner />

  if (!session) {
    // Redirect to login, preserving the intended destination
    return <Navigate to="/giris" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// Redirect to /notlar if already authenticated (for login page)
export function PublicOnlyRoute({ children }: ProtectedRouteProps) {
  const { session, loading } = useAuthStore()

  if (loading) return <FullPageSpinner />
  if (session)  return <Navigate to="/notlar" replace />

  return <>{children}</>
}
