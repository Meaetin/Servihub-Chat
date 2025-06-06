import { FastifyRequest } from 'fastify';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { pubSubService } from '../services/PubSubService';
import { MessageService, ConversationService } from '../services';
import { MessageEvent, TypingEvent, PresenceEvent } from '../types/pubsub';
import { PrismaClient, ContentType } from '@prisma/client';
import { connectRedis } from '../utils/redisClient';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_key';

// WebSocket Message Types
export enum WebSocketMessageType {
  WELCOME = 'welcome',
  CHAT_MESSAGE = 'chat_message',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_RECEIVED = 'message_received',
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  TYPING_INDICATOR = 'typing_indicator',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  PRESENCE_UPDATE = 'presence_update',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong'
}

// Client Message Interface
export interface ClientMessage {
  type: WebSocketMessageType;
  conversationId?: string;
  body?: string;
  contentType?: string;
  data?: any;
}

// Server Message Interface
export interface ServerMessage {
  type: WebSocketMessageType;
  message?: any;
  data?: any;
  timestamp: string;
  from?: string;
  conversationId?: string;
}

// User Interface
interface AuthenticatedUser {
  userId: string;
  email: string;
  role: 'CUSTOMER' | 'AGENT';
}

// WebSocket Connection Interface
interface WebSocketConnection {
  socket: WebSocket;
  user: AuthenticatedUser;
  conversationIds: Set<string>;
  lastSeen: Date;
  isAlive: boolean;
}

export class WebSocketManager {
  private connections = new Map<string, WebSocketConnection>();
  private conversationSubscriptions = new Map<string, Set<string>>(); // conversationId -> Set of userIds
  private messageService: MessageService;
  private conversationService: ConversationService;
  private isRedisConnected = false;

  constructor() {
    const prisma = new PrismaClient();
    this.messageService = new MessageService(prisma);
    this.conversationService = new ConversationService(prisma);
    this.initializeRedis();
  }

  // Initialize Redis connection and subscriptions
  private async initializeRedis() {
    try {
      await connectRedis();
      this.isRedisConnected = true;
      console.log('✅ WebSocket Manager: Redis connected');

      // Subscribe to Redis channels for message broadcasting
      await this.setupRedisSubscriptions();
    } catch (error) {
      console.error('❌ WebSocket Manager: Redis connection failed:', error);
      this.isRedisConnected = false;
    }
  }

  // Set up Redis pub/sub subscriptions
  private async setupRedisSubscriptions() {
    // Subscribe to all conversation-specific message channels
    // We'll use pattern subscription for conversation channels
    try {
      // Subscribe to typing indicators
      await pubSubService.subscribeToTyping((typingEvent: TypingEvent) => {
        this.broadcastToConversation(typingEvent.conversationId, {
          type: WebSocketMessageType.TYPING_INDICATOR,
          data: {
            userId: typingEvent.userId,
            isTyping: typingEvent.isTyping,
            conversationId: typingEvent.conversationId
          },
          timestamp: new Date().toISOString()
        }, typingEvent.userId); // Exclude the sender
      });

      // Subscribe to presence updates
      await pubSubService.subscribeToPresence((presenceEvent: PresenceEvent) => {
        this.broadcastPresenceUpdate(presenceEvent);
      });

      console.log('✅ Redis subscriptions set up successfully');
    } catch (error) {
      console.error('❌ Failed to set up Redis subscriptions:', error);
    }
  }

  // Authenticate WebSocket connection
  public authenticateConnection(request: FastifyRequest): AuthenticatedUser | null {
    try {
      const queryParam = request.query as any;
      const queryToken = Array.isArray(queryParam?.token) 
        ? queryParam.token[0] 
        : queryParam?.token as string;
      const token = queryToken || request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return null;
      }

      const payload = jwt.verify(token, JWT_SECRET) as any;
      return {
        userId: payload.userId,
        email: payload.email,
        role: payload.role
      };
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      return null;
    }
  }

  // Handle new WebSocket connection
  public async handleConnection(socket: WebSocket, user: AuthenticatedUser) {
    const connectionId = `${user.userId}_${Date.now()}`;
    
    // Create connection record
    const connection: WebSocketConnection = {
      socket,
      user,
      conversationIds: new Set(),
      lastSeen: new Date(),
      isAlive: true
    };

    this.connections.set(connectionId, connection);
    console.log(`✅ WebSocket connected: ${user.email} (${connectionId})`);

    // Send welcome message
    this.sendToClient(socket, {
      type: WebSocketMessageType.WELCOME,
      message: `Welcome ${user.email}!`,
      data: {
        userId: user.userId,
        email: user.email,
        role: user.role
      },
      timestamp: new Date().toISOString()
    });

    // Subscribe to user's conversations
    await this.subscribeToUserConversations(connectionId, user.userId);

    // Update user presence
    await this.updateUserPresence(user.userId, 'online');

    // Set up message handlers
    socket.on('message', (data) => this.handleMessage(connectionId, data));
    socket.on('close', () => this.handleDisconnection(connectionId));
    socket.on('error', (error) => this.handleError(connectionId, error));

    // Set up ping/pong for connection health
    socket.on('pong', () => {
      const conn = this.connections.get(connectionId);
      if (conn) {
        conn.isAlive = true;
        conn.lastSeen = new Date();
      }
    });
  }

  // Handle incoming WebSocket messages
  private async handleMessage(connectionId: string, data: WebSocket.Data) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const message: ClientMessage = JSON.parse(data.toString());
      console.log(`📩 Message from ${connection.user.email}:`, message);

      switch (message.type) {
        case WebSocketMessageType.CHAT_MESSAGE:
          await this.handleChatMessage(connection, message);
          break;

        case WebSocketMessageType.TYPING_START:
          await this.handleTypingIndicator(connection, message, true);
          break;

        case WebSocketMessageType.TYPING_STOP:
          await this.handleTypingIndicator(connection, message, false);
          break;

        case WebSocketMessageType.PING:
          this.sendToClient(connection.socket, {
            type: WebSocketMessageType.PONG,
            timestamp: new Date().toISOString()
          });
          break;

        default:
          this.sendToClient(connection.socket, {
            type: WebSocketMessageType.ERROR,
            message: 'Unknown message type',
            timestamp: new Date().toISOString()
          });
      }

      // Update last seen
      connection.lastSeen = new Date();

    } catch (error) {
      console.error(`❌ Error handling message from ${connection.user.email}:`, error);
      this.sendToClient(connection.socket, {
        type: WebSocketMessageType.ERROR,
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Handle chat message
  private async handleChatMessage(connection: WebSocketConnection, message: ClientMessage) {
    if (!message.conversationId || !message.body) {
      this.sendToClient(connection.socket, {
        type: WebSocketMessageType.ERROR,
        message: 'Missing conversationId or body',
        timestamp: new Date().toISOString()
      });
      return;
    }

    try {
      // Verify user is participant in conversation
      const isParticipant = await this.conversationService.isUserParticipant(
        message.conversationId, 
        connection.user.userId
      );

      if (!isParticipant) {
        this.sendToClient(connection.socket, {
          type: WebSocketMessageType.ERROR,
          message: 'You are not a participant in this conversation',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Save message to database
      const newMessage = await this.messageService.createMessage({
        conversationId: message.conversationId,
        senderId: connection.user.userId,
        senderRole: connection.user.role,
        contentType: (message.contentType as ContentType) || ContentType.TEXT,
        body: message.body
      });

      // Confirm message sent to sender
      this.sendToClient(connection.socket, {
        type: WebSocketMessageType.MESSAGE_SENT,
        message: newMessage,
        timestamp: new Date().toISOString()
      });

      // Broadcast message to all conversation participants via Redis
      if (this.isRedisConnected) {
        const messageEvent: MessageEvent = {
          conversationId: message.conversationId,
          senderId: connection.user.userId,
          body: message.body,
          timestamp: Date.now(),
          contentType: message.contentType || 'TEXT'
        };

        await pubSubService.publishToConversation(message.conversationId, messageEvent);
      }
    } catch (error) {
      console.error('❌ Error handling chat message:', error);
      this.sendToClient(connection.socket, {
        type: WebSocketMessageType.ERROR,
        message: 'Failed to send message',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Handle typing indicator
  private async handleTypingIndicator(connection: WebSocketConnection, message: ClientMessage, isTyping: boolean) {
    if (!message.conversationId) return;

    try {
      const typingEvent: TypingEvent = {
        conversationId: message.conversationId,
        userId: connection.user.userId,
        isTyping
      };

      if (this.isRedisConnected) {
        await pubSubService.publishTypingIndicator(typingEvent);
      } else {
        // Fallback: direct broadcast
        this.broadcastToConversation(message.conversationId, {
          type: WebSocketMessageType.TYPING_INDICATOR,
          data: typingEvent,
          timestamp: new Date().toISOString()
        }, connection.user.userId);
      }
    } catch (error) {
      console.error('❌ Error handling typing indicator:', error);
    }
  }

  // Subscribe connection to user's conversations
  private async subscribeToUserConversations(connectionId: string, userId: string) {
    try {
      const conversations = await this.conversationService.findByUserId(userId);
      const connection = this.connections.get(connectionId);
      
      if (!connection) return;

      for (const conversation of conversations) {
        connection.conversationIds.add(conversation.id);
        
        // Add to conversation subscription map
        if (!this.conversationSubscriptions.has(conversation.id)) {
          this.conversationSubscriptions.set(conversation.id, new Set());
        }
        this.conversationSubscriptions.get(conversation.id)!.add(userId);

        // Subscribe to Redis channel for this conversation
        if (this.isRedisConnected) {
          await pubSubService.subscribeToConversation(conversation.id, (messageEvent: MessageEvent) => {
            this.broadcastToConversation(conversation.id, {
              type: WebSocketMessageType.MESSAGE_RECEIVED,
              data: messageEvent,
              timestamp: new Date().toISOString()
            }, messageEvent.senderId); // Exclude sender
          });
        }
      }

      console.log(`✅ Subscribed ${userId} to ${conversations.length} conversations`);
    } catch (error) {
      console.error('❌ Error subscribing to conversations:', error);
    }
  }

  // Update user presence
  private async updateUserPresence(userId: string, status: 'online' | 'offline') {
    try {
      const presenceEvent: PresenceEvent = {
        userId,
        status,
        lastSeen: Date.now()
      };

      if (this.isRedisConnected) {
        await pubSubService.publishPresence(presenceEvent);
      } else {
        this.broadcastPresenceUpdate(presenceEvent);
      }
    } catch (error) {
      console.error('❌ Error updating user presence:', error);
    }
  }

  // Broadcast message to all participants in a conversation
  private broadcastToConversation(conversationId: string, message: ServerMessage, excludeUserId?: string) {
    const participants = this.conversationSubscriptions.get(conversationId);
    if (!participants) return;

    for (const [connectionId, connection] of this.connections) {
      if (connection.conversationIds.has(conversationId) && 
          connection.user.userId !== excludeUserId &&
          connection.socket.readyState === WebSocket.OPEN) {
        
        this.sendToClient(connection.socket, message);
      }
    }
  }

  // Broadcast presence update to all connected users
  private broadcastPresenceUpdate(presenceEvent: PresenceEvent) {
    const message: ServerMessage = {
      type: WebSocketMessageType.PRESENCE_UPDATE,
      data: presenceEvent,
      timestamp: new Date().toISOString()
    };

    for (const [_, connection] of this.connections) {
      if (connection.socket.readyState === WebSocket.OPEN) {
        this.sendToClient(connection.socket, message);
      }
    }
  }

  // Send message to specific client
  private sendToClient(socket: WebSocket, message: ServerMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  // Handle WebSocket disconnection
  private async handleDisconnection(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    console.log(`❌ WebSocket disconnected: ${connection.user.email}`);

    // Update user presence to offline
    await this.updateUserPresence(connection.user.userId, 'offline');

    // Remove from conversation subscriptions
    for (const conversationId of connection.conversationIds) {
      const participants = this.conversationSubscriptions.get(conversationId);
      if (participants) {
        participants.delete(connection.user.userId);
        if (participants.size === 0) {
          this.conversationSubscriptions.delete(conversationId);
        }
      }
    }

    // Remove connection
    this.connections.delete(connectionId);
  }

  // Handle WebSocket errors
  private handleError(connectionId: string, error: Error) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      console.error(`❌ WebSocket error for ${connection.user.email}:`, error);
    }
  }

  // Health check - ping all connections
  public pingConnections() {
    for (const [connectionId, connection] of this.connections) {
      if (!connection.isAlive) {
        // Connection is dead, terminate it
        connection.socket.terminate();
        this.handleDisconnection(connectionId);
      } else {
        // Mark as not alive and send ping
        connection.isAlive = false;
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.ping();
        }
      }
    }
  }

  // Get connection stats
  public getStats() {
    return {
      totalConnections: this.connections.size,
      conversationSubscriptions: this.conversationSubscriptions.size,
      redisConnected: this.isRedisConnected,
      connections: Array.from(this.connections.values()).map(conn => ({
        userId: conn.user.userId,
        email: conn.user.email,
        role: conn.user.role,
        conversationCount: conn.conversationIds.size,
        lastSeen: conn.lastSeen,
        isAlive: conn.isAlive
      }))
    };
  }
}

// Singleton instance
export const webSocketManager = new WebSocketManager();

// Health check interval (ping every 30 seconds)
setInterval(() => {
  webSocketManager.pingConnections();
}, 30000); 