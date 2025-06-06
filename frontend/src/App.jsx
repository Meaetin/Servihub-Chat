import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import CustomerDashboard from './components/CustomerDashboard'
import AgentDashboard from './components/AgentDashboard'
import Chat from './components/Chat'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (token && userData) {
      setUser(JSON.parse(userData))
    }
    setLoading(false)
  }, [])

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  if (loading) {
    return <div className="container">Loading...</div>
  }

  return (
    <Router>
      <div className="container">
        {user && (
          <div style={{ textAlign: 'right', marginBottom: '20px' }}>
            <span>Welcome, {user.email} ({user.role}) </span>
            <button className="btn btn-danger" onClick={logout}>Logout</button>
          </div>
        )}
        
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login setUser={setUser} />} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register setUser={setUser} />} />
          
          <Route path="/dashboard" element={
            user ? (
              user.role === 'CUSTOMER' ? <CustomerDashboard user={user} /> : <AgentDashboard user={user} />
            ) : (
              <Navigate to="/login" />
            )
          } />
          
          <Route path="/chat/:conversationId" element={
            user ? <Chat user={user} /> : <Navigate to="/login" />
          } />
          
          <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App 