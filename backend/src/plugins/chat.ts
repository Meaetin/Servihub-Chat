import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ConversationService, MessageService, UserService } from '../services';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import getRawBody from 'raw-body';


// Supabase client
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  max: 20, // 20 requests
  timeWindow: '5 seconds' // per 5 seconds
};

// File upload configuration
const FILE_UPLOAD_CONFIG = {
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
};

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_key';

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
  file?: () => Promise<{
    filename: string;
    mimetype: string;
    encoding: string;
    file: {
      bytesRead: number;
      toBuffer: () => Promise<Buffer>;
    };
  } | undefined>;
}

// Request schemas for validation
const conversationListSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 }, // page number
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 } // number of items per page
    }
  }
};

const conversationMessagesSchema = {
  params: {
    type: 'object', 
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' } // conversation id
    } 
  },
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 }, // page number
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 } // number of items per page
    }
  }
};

const createConversationSchema = {
  body: {
    type: 'object',
    required: ['businessId'],
    properties: {
      businessId: { type: 'string', format: 'uuid' }
    }
  }
};

// Authentication Helper Functions
class AuthService {
  static verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      return null;
    }
  }
}

// Authentication Middleware
async function authMiddleware(request: AuthenticatedRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ 
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header' 
    });
  }

  const token = authHeader.substring(7);
  const payload = AuthService.verifyToken(token);

  if (!payload) {
    return reply.status(401).send({ 
      error: 'Unauthorized',
      message: 'Invalid or expired token' 
    });
  }

  request.user = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role
  };
}

// Save file to storage
async function saveFileToStorage(buffer: Buffer, filename: string, mimetype: string) {
  try {
    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`; // generate a unique file id

    const {error} = await supabase.storage.from(process.env.SUPABASE_BUCKET_NAME!).upload(fileId, buffer, { // upload the file to the storage service
      contentType: mimetype, // set the content type
      upsert: false // do not overwrite the file if it already exists
    });

      if (error) {
        console.error('Supabase Upload Error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }

      const fileUrl = supabase.storage.from(process.env.SUPABASE_BUCKET_NAME!).getPublicUrl(fileId).data.publicUrl;

      return { fileId, fileUrl };
  } catch (error) {
    console.error('File Storage Error:', error);
    throw error;
  }
}

const chatPlugin: FastifyPluginAsync = async (fastify, options) => {
  // Initialize services
  const prisma = new PrismaClient();
  const conversationService = new ConversationService(prisma);
  const messageService = new MessageService(prisma);
  const userService = new UserService(prisma);

  // Register rate limiting plugin
  await fastify.register(require('@fastify/rate-limit'), {
    max: RATE_LIMIT_CONFIG.max, // 20 requests
    timeWindow: RATE_LIMIT_CONFIG.timeWindow, // per 5 seconds
    errorResponseBuilder: (request: FastifyRequest, context: { max: number; timeWindow: string; ttl: number }) => {
      return {
        error: 'Rate Limit Exceeded',
        message: `Too many requests. Limit: ${context.max} requests per ${context.timeWindow}`,
        retryAfter: context.ttl
      };
    }
  });

  // Register multipart support for file uploads
  await fastify.register(require('@fastify/multipart'), FILE_UPLOAD_CONFIG);

  // Add authentication hook for all routes in this plugin
  fastify.addHook('preHandler', authMiddleware);

  // GET /conversations - List user conversations
  fastify.get('/conversations', {
    schema: conversationListSchema,
    handler: async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number }; // load default values if not provided
        const userId = request.user!.userId;

        const result = await conversationService.findManyWithPagination(userId, page, limit); // get the conversations

        return reply.send({
          success: true,
          data: {
            conversations: result.conversations, // return the conversations
            pagination: {
              currentPage: result.currentPage, // return the current page
              totalPages: result.totalPages, // return the total number of pages
              totalCount: result.totalCount, // return the total number of items
              limit: limit, // return the limit
              hasNext: result.currentPage < result.totalPages, // return true if there is a next page
              hasPrev: result.currentPage > 1 // return true if there is a previous page
            }
          }
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ // return a 500 error if the conversations cannot be retrieved
          error: 'Internal Server Error',
          message: 'Failed to retrieve conversations'
        });
      }
    }
  });

  // GET /conversations/:id/messages - Get conversation history
  fastify.get('/conversations/:id/messages', {
    schema: conversationMessagesSchema,
    handler: async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const { id: conversationId } = request.params as { id: string }; // get the conversation id
        const { page = 1, limit = 50 } = request.query as { page?: number; limit?: number }; // get the page and limit
        const userId = request.user!.userId;

        // Check if user is participant in the conversation
        const isParticipant = await conversationService.isUserParticipant(conversationId, userId);
        if (!isParticipant) {
          return reply.status(403).send({ // return a 403 error if the user is not a participant in the conversation
            error: 'Forbidden',
            message: 'You are not a participant in this conversation'
          });
        }

        const result = await messageService.findByConversationId(conversationId, page, limit); // get the messages

        return reply.send({
          success: true,
          data: {
            messages: result.messages.reverse(), // Reverse to show oldest first
            pagination: {
              currentPage: result.currentPage, // return the current page
              totalPages: result.totalPages, // return the total number of pages
              totalCount: result.totalCount, // return the total number of items
              limit: limit, // return the limit
              hasNext: result.currentPage < result.totalPages, // return true if there is a next page
              hasPrev: result.currentPage > 1 // return true if there is a previous page
            }
          }
        });
      } catch (error) {
        fastify.log.error(error);
        
        if (error instanceof Error && error.message === 'Conversation not found') {
          return reply.status(404).send({ // return a 404 error if the conversation is not found
            error: 'Not Found',
            message: 'Conversation not found'
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to retrieve conversation messages'
        });
      }
    }
  });

  // POST /conversations - Create new conversation
  fastify.post('/conversations', {
    schema: createConversationSchema,
    handler: async (request: AuthenticatedRequest, reply: FastifyReply) => { // create a new conversation
      try {
        const { businessId } = request.body as { businessId: string }; // get the business id
        const customerId = request.user!.userId; // get the customer id

        // Validate that the business user exists and has the correct role
        const businessUser = await userService.findById(businessId); // get the business user
        if (!businessUser) {
          return reply.status(404).send({ // return a 404 error if the business user is not found
            error: 'Not Found',
            message: 'Business user not found'
          });
        }

        if (businessUser.role !== 'AGENT') {
          return reply.status(400).send({ // return a 400 error if the business user is not an agent
            error: 'Bad Request',
            message: 'Target user must be an agent'
          });
        }

        // Only customers can create conversations with agents
        if (request.user!.role !== 'CUSTOMER') {
          return reply.status(403).send({ // return a 403 error if the user is not a customer
            error: 'Forbidden',
            message: 'Only customers can create conversations with agents'
          });
        }

        const conversation = await conversationService.createConversation({ // create the conversation
          customerId,
          businessId
        });

        // Get conversation with details
        const conversationWithDetails = await conversationService.findByIdWithDetails(conversation.id);

        return reply.status(201).send({ // return a 201 created status
          success: true,
          data: conversationWithDetails
        });
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error) {
          if (error.message === 'Customer not found') {
            return reply.status(404).send({ // return a 404 error if the customer is not found
              error: 'Not Found',
              message: 'Customer not found'
            });
          }
          if (error.message === 'Business user not found') {
            return reply.status(404).send({ // return a 404 error if the business user is not found
              error: 'Not Found',
              message: 'Business user not found'
            });
          }
        }

        return reply.status(500).send({ // return a 500 error if the conversation cannot be created
          error: 'Internal Server Error',
          message: 'Failed to create conversation'
        });
      }
    }
  });

  // POST /upload - File upload endpoint
  fastify.post('/upload', {
    schema: {
      querystring: {
        type: 'object',
        required: ['conversationId'],
        properties: {
          conversationId: { type: 'string', format: 'uuid' }
        }
      }
    },
    handler: async (request: AuthenticatedRequest, reply: FastifyReply) => { // upload a file
      try {
        const data = await request.file?.(); // get the file
        
        if (!data) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'No file uploaded'
          });
        }

        // Validate file size (already handled by multipart config, but double-check)
        if (data.file.bytesRead > FILE_UPLOAD_CONFIG.limits.fileSize) {
          return reply.status(413).send({ // return a 413 error if the file size exceeds the limit
            error: 'Payload Too Large',
            message: `File size exceeds limit of ${FILE_UPLOAD_CONFIG.limits.fileSize / (1024 * 1024)}MB`
          });
        }


        // Get file info
        const filename = data.filename; // get the filename
        const mimetype = data.mimetype; // get the mimetype
        const encoding = data.encoding; // get the encoding
        
        // Get conversationId from query parameters
        const { conversationId } = request.query as { conversationId?: string };
        
        if (!conversationId) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'conversationId is required as a query parameter'
          });
        }
        
        const buffer = await getRawBody(data.file as any); // get the full file memory as buffer

        const {fileId, fileUrl} = await saveFileToStorage(buffer, filename, mimetype); // save the file to the storage service and get the file id and url

        // Determine content type based on mimetype
        let contentType: 'FILE' | 'IMAGE' = 'FILE';
        if (mimetype.startsWith('image/')) {
          contentType = 'IMAGE';
        }

        // Get user info
        const userId = request.user?.userId;
        const userRole = request.user?.role;

        // Verify conversation exists and user has access
        if (userId) { // if the user is authenticated
          const isParticipant = await conversationService.isUserParticipant(conversationId, userId);
          if (!isParticipant) { // if the user is not a participant in the conversation
            return reply.status(403).send({
              error: 'Forbidden', 
              message: 'You are not a participant in this conversation'
            });
          }
        }

        // Save file to database as a message
        const message = await messageService.createMessage({
          conversationId: conversationId,
          senderId: userId!,
          senderRole: userRole as 'CUSTOMER' | 'AGENT',
          contentType: contentType,
          body: fileUrl // Store the file URL as the message body
        });

        return reply.send({
          success: true,
          data: {
            fileId,
            filename,
            mimetype,
            encoding,
            url: fileUrl,
            uploadedAt: new Date().toISOString(),
            uploadedBy: userId,
            contentType,
            message: {
              id: message.id,
              conversationId: message.conversationId,
              createdAt: message.createdAt
            }
          }
        });
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error && error.message.includes('Request entity too large')) {
          return reply.status(413).send({ // return a 413 error if the file size exceeds the limit
            error: 'Payload Too Large',
            message: `File size exceeds limit of ${FILE_UPLOAD_CONFIG.limits.fileSize / (1024 * 1024)}MB`
          });
        }

        return reply.status(500).send({ // return a 500 error if the file upload fails
          error: 'Internal Server Error',
          message: 'File upload failed'
        });
      }
    }
  });

  // Health check endpoint for the chat plugin
  fastify.get('/health', {
    handler: async (request: AuthenticatedRequest, reply: FastifyReply) => { // check the health of the chat plugin
      return reply.send({
        success: true,
        message: 'Chat plugin is healthy',
        timestamp: new Date().toISOString(),
        user: request.user
      });
    }
  });
};

export default chatPlugin; 