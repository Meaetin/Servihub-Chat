# ServiHub Chat Frontend

A minimal React frontend for the ServiHub Chat System with corrected API endpoints.

## ✅ Features

**🔐 Authentication**
- Login/Register with email and password
- Customer and Agent role selection
- JWT token authentication

**📊 Customer Dashboard**
- View available agents
- Start new conversations
- View existing conversations

**👩‍💼 Agent Dashboard**
- View all conversations
- See active customer chats
- Quick stats and metrics

**💬 Real-time Chat**
- WebSocket-powered real-time messaging
- Typing indicators
- Auto-reconnection
- Message persistence

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Open Browser
Navigate to `http://localhost:3000`

## 🔧 API Endpoints (Fixed)

The frontend now correctly calls these backend endpoints:

- `POST /auth/login` - User login ✅
- `POST /auth/register` - User registration ✅
- `GET /users` - Get all users (filtered for agents in frontend) ✅
- `GET /api/chat/conversations` - List conversations ✅
- `POST /api/chat/conversations` - Create conversation ✅
- `GET /api/chat/conversations/:id/messages` - Get messages ✅
- `WS /ws?token=<jwt>` - WebSocket connection ✅

## 👥 Default Test Users

After running `npm run db:seed` in the backend:

**Customers:**
- customer1@example.com / password123
- customer2@example.com / password123

**Agents:**
- agent1@servihub.com / password123
- agent2@servihub.com / password123

## 🏗️ Architecture

- **React 18** - UI framework
- **React Router** - Client-side routing
- **Vite** - Fast development server with proxy
- **WebSocket API** - Real-time communication
- **REST API** - Data fetching
- **Minimal CSS** - Clean, responsive design

## 📁 Components

1. **App.jsx** - Main router and authentication
2. **Login.jsx** - Login form
3. **Register.jsx** - Registration form  
4. **CustomerDashboard.jsx** - Customer interface
5. **AgentDashboard.jsx** - Agent interface
6. **Chat.jsx** - Real-time chat interface

## 🔌 WebSocket Events

**Outgoing:**
- `chat_message` - Send a message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator

**Incoming:**
- `welcome` - Connection established
- `message_received` - New message
- `message_sent` - Message delivery confirmation
- `typing_indicator` - Other user typing
- `presence_update` - User online/offline
- `error` - Error messages

## 🔧 Configuration

The Vite proxy is configured to forward:
- `/api/*` → `http://localhost:3001/api/*`
- `/auth/*` → `http://localhost:3001/auth/*`  
- `/users/*` → `http://localhost:3001/users/*`

## 📱 Usage Flow

1. **Register/Login** → Choose Customer or Agent role
2. **Customer:** View agents → Start chat → Real-time messaging
3. **Agent:** View conversations → Join chats → Real-time messaging
4. **Both:** Enjoy typing indicators, auto-reconnection, and message persistence

Perfect for testing your full-stack real-time chat system! 🎯 