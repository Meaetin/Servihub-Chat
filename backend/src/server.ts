// ESM
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fastifyWebsocket from '@fastify/websocket';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { webSocketManager } from './websocket/WebSocketManager';

// Import services
import { UserService, ConversationService, MessageService } from './services';
import type { CreateUserDTO } from './services';

// Import plugins
import { chatPlugin } from './plugins';

// Initialize Fastify
const fastify = Fastify({
  logger: true
});

// Register CORS plugin
fastify.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// Register static file serving
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'public'),
  prefix: '/',
});

// Initialize Prisma and Services
const prisma = new PrismaClient();
const userService = new UserService(prisma);
const conversationService = new ConversationService(prisma);
const messageService = new MessageService(prisma);

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_key';
const JWT_EXPIRES_IN = '24h';

// Types for authentication
interface TokenPayload {
  userId: string;
  email: string;
  role: 'CUSTOMER' | 'AGENT';
  iat: number;
  exp: number;
}

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    userId: string;
    email: string;
    role: 'CUSTOMER' | 'AGENT';
  };
}

// Authentication Helper Functions
class AuthService {
  static generateToken(user: { id: string, email: string, role: string }): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }
  // Verify token and return payload info
  static verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      return null;
    }
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
  
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

// HTTP Authentication Middleware
async function authMiddleware(request: AuthenticatedRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization; // Get authorization header
  
  // Check if authorization header is missing or invalid
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7); // Remove "Bearer "
  const payload = AuthService.verifyToken(token); // Verify token and return payload info

  if (!payload) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }

  request.user = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role
  };
}

// Role-based Authorization Middleware
function requireRole(allowedRoles: ('CUSTOMER' | 'AGENT')[]) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) { // No request found
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(request.user.role)) { // Request is found but user is not customer or agent
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}

// WebSocket Authentication Helper
function authenticateWebSocket(request: FastifyRequest): { user: any } | { error: string } {
  const token = (request.query as { token?: string }).token; // Retrieve token from query parameters
  
  if (!token) {
    return { error: 'No authentication token provided' };
  }
  
  const payload = AuthService.verifyToken(token); // Verify token and return payload info
  if (!payload) {
    return { error: 'Invalid or expired token' };
  }

  return {
    user: {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    }
  };
}

// Initialize WebSocket
fastify.register(fastifyWebsocket);

// Register chat plugin with API prefix
fastify.register(chatPlugin, { prefix: '/api/chat' });

fastify.register(async function (fastify) {
  // ==================== AUTHENTICATION ROUTES ====================
  
  // User Registration
  fastify.post('/auth/register', async (request, reply) => {
    try {
      const { email, name, password, role } = request.body as CreateUserDTO;

      // Validate input
      if (!email || !name || !password) {
        return reply.status(400).send({ error: 'Email, name, and password are required' });
      }

      // Check if user already exists
      const existingUser = await userService.findByEmail(email);
      if (existingUser) {
        return reply.status(409).send({ error: 'User already exists' });
      }

      // Create user using service
      const user = await userService.createUser({
        email,
        name,
        password,
        role: role || 'CUSTOMER'
      });

      // Generate token
      const token = AuthService.generateToken({
        id: user.id,
        email: user.email || '',
        role: user.role
      });

      reply.send({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Registration failed' });
    }
  });

  // User Login
  fastify.post('/auth/login', async (request, reply) => {
    try {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      // Authenticate user using service
      const user = await userService.authenticateUser(email, password);
      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = AuthService.generateToken({
        id: user.id,
        email: user.email || '',
        role: user.role
      });

      reply.send({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Login failed' });
    }
  });

  // ==================== PROTECTED ROUTES ====================

  // Get all users (Agents only)
  fastify.get('/users', {
    preHandler: [authMiddleware, requireRole(['AGENT'])] // Pre-handler middleware to check if user is an agent
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const users = await userService.findMany();
      reply.send({ users });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch users' });
    }
  });

  // Get current user profile
  fastify.get('/auth/me', {
    preHandler: [authMiddleware]
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const user = await userService.findById(request.user!.userId);
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      reply.send({ user });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch user profile' });
    }
  });

  // ==================== PUBLIC ROUTES ====================

  // Root route
  fastify.get('/api', async (request, reply) => {
    reply.send({ 
      message: 'ServiHub Chat API is running!',
      endpoints: {
        auth: {
          register: 'POST /auth/register',
          login: 'POST /auth/login',
          profile: 'GET /auth/me (requires auth)'
        },
        chat: {
          conversations: 'GET /api/chat/conversations (requires auth)',
          conversationMessages: 'GET /api/chat/conversations/:id/messages (requires auth)',
          createConversation: 'POST /api/chat/conversations (requires auth)',
          uploadFile: 'POST /api/chat/upload (requires auth)',
          health: 'GET /api/chat/health (requires auth)'
        },
        websocket: 'ws://localhost:3001/ws?token=YOUR_JWT_TOKEN'
      }
    });
  });

  // ==================== WEBSOCKET ROUTES ====================

  // Authenticated WebSocket endpoint
  fastify.get('/ws', { websocket: true }, async (socket, request) => {
    const user = webSocketManager.authenticateConnection(request);
    
    if (!user) {
      fastify.log.warn('WebSocket authentication failed');
      socket.close(1008, 'Authentication failed');
      return;
    }

    // Handle connection with the WebSocket manager
    await webSocketManager.handleConnection(socket, user);
  });

  // WebSocket stats endpoint
  fastify.get('/ws/stats', {
    preHandler: [authMiddleware]
  }, async (request: AuthenticatedRequest, reply) => {
    const stats = webSocketManager.getStats();
    reply.send({ stats });
  });
});

// Gracefully close Prisma connection on shutdown
fastify.addHook('onClose', async () => {
  await prisma.$disconnect();
});

// Run the server
fastify.listen({ 
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  host: '0.0.0.0'
}, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server listening on ${address}`);
  console.log(`📚 API Documentation available at ${address}`);
});
