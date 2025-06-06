import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function CustomerDashboard({ user }) {
  const [conversations, setConversations] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchConversations()
    fetchAgents()
  }, [])

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/chat/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setConversations(data.data?.conversations || [])
      }
    } catch (err) {
      console.error('Error fetching conversations:', err)
    }
  }

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        // Filter only agents
        const agentUsers = data.users?.filter(user => user.role === 'AGENT') || []
        setAgents(agentUsers)
      }
    } catch (err) {
      console.error('Error fetching agents:', err)
    }
  }

  const startChat = async (agentId) => {
    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          businessId: agentId
        })
      })

      const data = await response.json()

      if (response.ok) {
        navigate(`/chat/${data.data.id}`)
      } else {
        setError(data.message || 'Failed to start chat')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Customer Dashboard</h1>
      
      {error && <div className="error">{error}</div>}

      {/* Start New Chat */}
      <div className="card">
        <h3>Start New Chat</h3>
        <p>Choose an agent to start a conversation:</p>
        
        {agents.length === 0 ? (
          <p>No agents available at the moment.</p>
        ) : (
          <div>
            {agents.map(agent => (
              <div key={agent.id} className="flex" style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                <div style={{ flex: 1 }}>
                  <strong>{agent.name || agent.email}</strong>
                  <div style={{ fontSize: '12px', color: '#666' }}>{agent.email}</div>
                </div>
                <button 
                  className="btn btn-success" 
                  onClick={() => startChat(agent.id)}
                  disabled={loading}
                >
                  Start Chat
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Existing Conversations */}
      <div className="card">
        <h3>Your Conversations</h3>
        
        {conversations.length === 0 ? (
          <p>No conversations yet. Start a chat with an agent above!</p>
        ) : (
          <div>
            {conversations.map(conversation => (
              <div key={conversation.id} className="flex" style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                <div style={{ flex: 1 }}>
                  <strong>Chat with {conversation.business?.name || conversation.business?.email}</strong>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Created: {new Date(conversation.createdAt).toLocaleDateString()}
                  </div>
                  {conversation.lastMessage && (
                    <div style={{ fontSize: '14px', color: '#333', marginTop: '4px' }}>
                      Last: {conversation.lastMessage.body.substring(0, 50)}...
                    </div>
                  )}
                </div>
                <button 
                  className="btn" 
                  onClick={() => navigate(`/chat/${conversation.id}`)}
                >
                  Open Chat
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomerDashboard 