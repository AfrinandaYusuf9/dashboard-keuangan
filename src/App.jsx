import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { RefreshProvider } from './contexts/RefreshContext'
import { MonthProvider } from './contexts/MonthContext'
import Layout from './components/Layout'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Budget from './pages/Budget'
import Assets from './pages/Assets'
import Settings from './pages/Settings'
import Planning from './pages/Planning'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-4 text-center mt-20">Loading...</div>
  if (!user) return <Navigate to="/login" />
  return children
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <RefreshProvider>
          <MonthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="budget" element={<Budget />} />
                <Route path="assets" element={<Assets />} />
                <Route path="planning" element={<Planning />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </MonthProvider>
        </RefreshProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
