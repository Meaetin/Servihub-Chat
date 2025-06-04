# ServiHub Chat

A real-time chat application built with Node.js, TypeScript, Fastify, and Prisma. Designed for customer support scenarios with role-based access control.

## 🚀 Features

- **Real-time messaging** with WebSocket support
- **Role-based authentication** (Customer & Agent)
- **JWT-based security** with middleware protection
- **Service-oriented architecture** with clean separation of concerns
- **Type-safe development** with TypeScript
- **Database management** with Prisma ORM
- **RESTful API** for conversation and message management
- **CORS support** for cross-origin requests

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Fastify
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **Real-time**: WebSocket
- **Development**: ts-node

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn package manager

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd servihub-chat/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Configure your `.env` file**
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/servihub_chat"
   JWT_SECRET="your-secret-key-here"
   PORT=3001
   ```

5. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # Seed the database with test data
   npm run db:seed
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

## 📊 Database Schema

The application uses the following main entities:

- **User**: Stores user information with roles (CUSTOMER/AGENT)
- **Conversation**: Links customers with business agents
- **Message**: Stores chat messages with content types

## 🔐 Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 🧪 Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload
npm run build           # Build TypeScript to JavaScript
npm run start           # Start production server

# Database
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Run database migrations
npm run db:seed         # Seed database with test data
npm run db:studio       # Open Prisma Studio
npm run db:reset        # Reset database and reseed

# Testing
npm run test:services   # Test service layer functionality
```

## 🔄 Development Workflow

1. **Make code changes**
2. **Database changes**: Update `prisma/schema.prisma` if needed
3. **Generate migration**: `npm run db:migrate`
4. **Update seed data**: Modify `prisma/seed.ts` if needed
5. **Test services**: `npm run test:services`

## 🌐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | Secret key for JWT signing | `development_secret_key` |
| `PORT` | Server port | `3001` |

## 🔍 Service Layer

The application follows a service-oriented architecture:

- **UserService**: User management, authentication, profile operations
- **ConversationService**: Conversation creation, retrieval, participant management
- **MessageService**: Message creation, pagination, real-time operations

Each service provides:
- Type-safe operations
- Input validation
- Error handling
- Database abstraction


## 🛡 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Role-based Access Control**: Customer and Agent permissions
- **Input Validation**: Request body and parameter validation
- **CORS Configuration**: Cross-origin request handling
- **Private Data Protection**: Safe user data exposure

## 📝 License

This project is licensed under the MIT License.

---

**Happy coding! 🚀** 