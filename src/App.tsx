import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ProtectedRoute, PublicOnlyRoute } from '@/components/layout/ProtectedRoute'
import { LandingPage }     from '@/pages/LandingPage'
import { AuthPage }        from '@/features/auth/AuthPage'
import { NoteListPage }    from '@/features/notes/NoteListPage'
import { NoteEditorPage }  from '@/features/notes/NoteEditorPage'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { SearchOverlay }   from '@/components/ui/SearchOverlay'

function AppRoutes() {
  // Initialize auth listener at the app root
  const { loading } = useAuth()

  if (loading) return <FullPageSpinner />

  return (
    <>
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth (redirect to /notlar if already logged in) */}
      <Route
        path="/giris"
        element={
          <PublicOnlyRoute>
            <AuthPage />
          </PublicOnlyRoute>
        }
      />

      {/* Protected app routes */}
      <Route
        path="/notlar"
        element={
          <ProtectedRoute>
            <NoteListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notlar/:id"
        element={
          <ProtectedRoute>
            <NoteEditorPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <SearchOverlay />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
