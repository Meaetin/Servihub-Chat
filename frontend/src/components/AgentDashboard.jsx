import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function AgentDashboard({ user }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchConversations()
    // Refresh every 10 seconds to see new conversations
    const interval = setInterval(fetchConversations, 10000)
    return () => clearInterval(interval)
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

  // Filter conversations - show agent's own conversations and unassigned ones
  const myConversations = conversations.filter(conv => conv.businessId === user.id)
  const availableConversations = conversations.filter(conv => 
    conv.businessId !== user.id && conv.business
  )

  return (
    <div>
      <h1>Agent Dashboard</h1>
      
      {/* My Active Conversations */}
      <div className="card">
        <h3>My Active Conversations ({myConversations.length})</h3>
        
        {myConversations.length === 0 ? (
          <p>No active conversations. Check available conversations below.</p>
        ) : (
          <div>
            {myConversations.map(conversation => (
              <div key={conversation.id} className="flex" style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                <div style={{ flex: 1 }}>
                  <strong>Chat with {conversation.customer?.name || conversation.customer?.email}</strong>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Started: {new Date(conversation.createdAt).toLocaleDateString()}
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
                  Continue Chat
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Conversations from Other Agents */}
      <div className="card">
        <h3>All Conversations ({availableConversations.length})</h3>
        <p style={{ fontSize: '14px', color: '#666' }}>Other agents' conversations - you can view but may not be able to participate</p>
        
        {availableConversations.length === 0 ? (
          <p>No other conversations available.</p>
        ) : (
          <div>
            {availableConversations.map(conversation => (
              <div key={conversation.id} className="flex" style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                <div style={{ flex: 1 }}>
                  <strong>
                    {conversation.customer?.name || conversation.customer?.email} 
                    ↔ 
                    {conversation.business?.name || conversation.business?.email}
                  </strong>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Started: {new Date(conversation.createdAt).toLocaleDateString()}
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
                  style={{ background: '#6c757d' }}
                >
                  View Chat
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="card">
        <h3>Quick Stats</h3>
        <div className="flex">
          <div style={{ flex: 1, textAlign: 'center', padding: '20px', border: '1px solid #ddd', borderRadius: '4px', margin: '0 5px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>{myConversations.length}</div>
            <div>My Active Chats</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '20px', border: '1px solid #ddd', borderRadius: '4px', margin: '0 5px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>{conversations.length}</div>
            <div>Total Conversations</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '20px', border: '1px solid #ddd', borderRadius: '4px', margin: '0 5px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
              {conversations.filter(c => c.lastMessage && 
                new Date(c.lastMessage.createdAt) > new Date(Date.now() - 24*60*60*1000)
              ).length}
            </div>
            <div>Active Today</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentDashboard 