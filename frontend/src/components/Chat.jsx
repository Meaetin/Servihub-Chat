import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

function Chat({ user }) {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [ws, setWs] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('Connecting...')
  const [isTyping, setIsTyping] = useState(false)
  const [otherUserTyping, setOtherUserTyping] = useState(false)
  const [conversation, setConversation] = useState(null)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  useEffect(() => {
    fetchConversation()
    fetchMessages()
    setupWebSocket()

    return () => {
      if (ws) {
        ws.close()
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchConversation = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/chat/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        // Find the specific conversation
        const currentConversation = data.data?.conversations?.find(conv => conv.id === conversationId)
        setConversation(currentConversation)
      }
    } catch (err) {
      console.error('Error fetching conversation:', err)
    }
  }

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setMessages(data.data?.messages || [])
      }
    } catch (err) {
      console.error('Error fetching messages:', err)
    }
  }

  const setupWebSocket = () => {
    const token = localStorage.getItem('token')
    const wsUrl = `ws://localhost:3001/ws?token=${token}`
    
    const websocket = new WebSocket(wsUrl)
    
    websocket.onopen = () => {
      setConnectionStatus('Connected')
      setWs(websocket)
    }
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (data.type) {
        case 'welcome':
          console.log('WebSocket connected:', data)
          break
          
        case 'message_sent':
          console.log('Message sent confirmation:', data)
          // Message confirmation - the actual message will come via message_received
          break
          
        case 'message_received':
          // Add new message to the chat
          if (data.data && data.data.conversationId === conversationId) {
            const newMsg = {
              id: data.data.id || `${Date.now()}-${Math.random()}`,
              body: data.data.body,
              senderId: data.data.senderId,
              senderRole: data.data.senderRole || 'CUSTOMER',
              contentType: data.data.contentType || 'TEXT',
              createdAt: data.data.createdAt || new Date().toISOString()
            }
            
            setMessages(prev => {
              // If this is our own message, replace the optimistic one
              if (newMsg.senderId === user.id) {
                const optimisticIndex = prev.findIndex(msg => 
                  msg.isOptimistic && 
                  msg.body === newMsg.body && 
                  msg.senderId === newMsg.senderId
                )
                
                if (optimisticIndex !== -1) {
                  // Replace optimistic message with real one
                  const newMessages = [...prev]
                  newMessages[optimisticIndex] = newMsg
                  return newMessages
                }
              }
              
              // Prevent duplicates by checking if message already exists
              const exists = prev.some(msg => 
                msg.id === newMsg.id || 
                (msg.body === newMsg.body && 
                 msg.senderId === newMsg.senderId && 
                 Math.abs(new Date(msg.createdAt).getTime() - new Date(newMsg.createdAt).getTime()) < 1000)
              )
              
              return exists ? prev : [...prev, newMsg]
            })
          }
          break
          
        case 'typing_indicator':
          if (data.data && data.data.conversationId === conversationId && data.data.userId !== user.id) {
            setOtherUserTyping(data.data.isTyping)
            if (data.data.isTyping) {
              // Auto-stop typing indicator after 3 seconds
              setTimeout(() => setOtherUserTyping(false), 3000)
            }
          }
          break
          
        case 'presence_update':
          console.log('Presence update:', data)
          break
          
        case 'error':
          console.error('WebSocket error:', data.message)
          break
          
        default:
          console.log('Unknown message type:', data)
      }
    }
    
    websocket.onclose = () => {
      setConnectionStatus('Disconnected')
      setWs(null)
      // Attempt to reconnect after 3 seconds
      setTimeout(setupWebSocket, 3000)
    }
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnectionStatus('Error')
    }
  }

  const sendMessage = () => {
    if (!newMessage.trim() || !ws || ws.readyState !== WebSocket.OPEN) return

    const message = {
      type: 'chat_message',
      conversationId: conversationId,
      body: newMessage,
      contentType: 'TEXT'
    }

    // Optimistically add message to UI immediately
    const optimisticMessage = {
      id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID
      body: newMessage,
      senderId: user.id,
      senderRole: user.role,
      contentType: 'TEXT',
      createdAt: new Date().toISOString(),
      isOptimistic: true // Flag to identify optimistic messages
    }

    // Add message immediately to local state
    setMessages(prev => [...prev, optimisticMessage])

    // Send via WebSocket
    ws.send(JSON.stringify(message))

    // Clear the input immediately
    setNewMessage('')
    stopTyping()
  }

  const handleTyping = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    if (!isTyping) {
      setIsTyping(true)
      ws.send(JSON.stringify({
        type: 'typing_start',
        conversationId: conversationId
      }))
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(stopTyping, 2000)
  }

  const stopTyping = () => {
    if (isTyping && ws && ws.readyState === WebSocket.OPEN) {
      setIsTyping(false)
      ws.send(JSON.stringify({
        type: 'typing_stop',
        conversationId: conversationId
      }))
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    } else {
      handleTyping()
    }
  }

  const getOtherUser = () => {
    if (!conversation) return null
    return user.role === 'CUSTOMER' ? conversation.business : conversation.customer
  }

  const otherUser = getOtherUser()

  return (
    <div>
      {/* Header */}
      <div className="card">
        <div className="flex">
          <button className="btn" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h3>
              Chat with {otherUser?.name || otherUser?.email || 'Unknown User'}
            </h3>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Status: <span className={connectionStatus === 'Connected' ? 'status-online' : 'status-offline'}>
                {connectionStatus}
              </span>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Conversation ID: {conversationId?.substring(0, 8)}...
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="card">
        <div className="chat-container">
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.senderId === user.id ? 'sent' : 'received'}`}
              >
                {message.senderId !== user.id && (
                  <div className="message-sender">
                    {message.senderRole} • {new Date(message.createdAt).toLocaleTimeString()}
                  </div>
                )}
                <div>{message.body}</div>
                {message.senderId === user.id && (
                  <div style={{ fontSize: '10px', marginTop: '4px' }}>
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            ))
          )}
          
          {otherUserTyping && (
            <div className="message received" style={{ fontStyle: 'italic', opacity: 0.7 }}>
              {otherUser?.name || 'User'} is typing...
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="flex">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            rows="2"
            style={{ flex: 1, resize: 'none' }}
            disabled={connectionStatus !== 'Connected'}
          />
          <button
            className="btn btn-success"
            onClick={sendMessage}
            disabled={!newMessage.trim() || connectionStatus !== 'Connected'}
            style={{ marginLeft: '10px', height: 'fit-content' }}
          >
            Send
          </button>
        </div>
        
        {isTyping && (
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            You are typing...
          </div>
        )}
      </div>
    </div>
  )
}

export default Chat 