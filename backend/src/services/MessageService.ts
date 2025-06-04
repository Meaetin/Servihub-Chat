import { PrismaClient, Message, ContentType, Role } from '@prisma/client';

export interface CreateMessageDTO {
  conversationId: string;
  senderId: string;
  senderRole: Role;
  contentType: ContentType;
  body: string;
}

export interface MessageWithSender {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: Role;
  contentType: ContentType;
  body: string;
  createdAt: Date;
  sender: {
    id: string;
    name: string | null;
    email: string | null;
    role: Role;
  };
}

export interface MessageSearchFilters {
  conversationId?: string;
  senderId?: string;
  contentType?: ContentType;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}

export class MessageService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Create a new message
  async createMessage(data: CreateMessageDTO): Promise<MessageWithSender> {
    // Validate that conversation exists and sender is a participant
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
      select: { customerId: true, businessId: true }
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Check if sender is a participant in the conversation
    const isParticipant = conversation.customerId === data.senderId || 
                         conversation.businessId === data.senderId;

    if (!isParticipant) {
      throw new Error('Sender is not a participant in this conversation');
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        senderRole: data.senderRole,
        contentType: data.contentType,
        body: data.body
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      contentType: message.contentType,
      body: message.body,
      createdAt: message.createdAt,
      sender: message.sender
    };
  }

  // Get message by ID
  async findById(messageId: string): Promise<MessageWithSender | null> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    if (!message) {
      return null;
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      contentType: message.contentType,
      body: message.body,
      createdAt: message.createdAt,
      sender: message.sender
    };
  }

  // Get messages for a conversation with pagination
  async findByConversationId(
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    messages: MessageWithSender[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const skip = (page - 1) * limit;

    const [messages, totalCount] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: { id: true, name: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.message.count({
        where: { conversationId }
      })
    ]);

    const mappedMessages = messages.map(message => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      contentType: message.contentType,
      body: message.body,
      createdAt: message.createdAt,
      sender: message.sender
    }));

    return {
      messages: mappedMessages,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  }

  // Get recent messages for a conversation (for real-time chat)
  async getRecentMessages(
    conversationId: string,
    limit: number = 50
  ): Promise<MessageWithSender[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    });

    return messages.map(message => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      contentType: message.contentType,
      body: message.body,
      createdAt: message.createdAt,
      sender: message.sender
    }));
  }

  // Get messages after a specific timestamp (for real-time updates)
  async getMessagesAfterTimestamp(
    conversationId: string,
    timestamp: Date
  ): Promise<MessageWithSender[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        createdAt: { gt: timestamp }
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return messages.map(message => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      contentType: message.contentType,
      body: message.body,
      createdAt: message.createdAt,
      sender: message.sender
    }));
  }

  // Search messages with filters
  async searchMessages(
    filters: MessageSearchFilters,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    messages: MessageWithSender[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (filters.conversationId) {
      where.conversationId = filters.conversationId;
    }

    if (filters.senderId) {
      where.senderId = filters.senderId;
    }

    if (filters.contentType) {
      where.contentType = filters.contentType;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    if (filters.searchTerm) {
      where.body = {
        contains: filters.searchTerm,
        mode: 'insensitive'
      };
    }

    const [messages, totalCount] = await Promise.all([
      this.prisma.message.findMany({
        where,
        include: {
          sender: {
            select: { id: true, name: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.message.count({ where })
    ]);

    const mappedMessages = messages.map(message => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      contentType: message.contentType,
      body: message.body,
      createdAt: message.createdAt,
      sender: message.sender
    }));

    return {
      messages: mappedMessages,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  }

  // Update message (for editing)
  async updateMessage(messageId: string, body: string): Promise<MessageWithSender> {
    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: { body },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    return {
      id: updatedMessage.id,
      conversationId: updatedMessage.conversationId,
      senderId: updatedMessage.senderId,
      senderRole: updatedMessage.senderRole,
      contentType: updatedMessage.contentType,
      body: updatedMessage.body,
      createdAt: updatedMessage.createdAt,
      sender: updatedMessage.sender
    };
  }

  // Delete message
  async deleteMessage(messageId: string): Promise<Message> {
    return this.prisma.message.delete({
      where: { id: messageId }
    });
  }

  // Get message count for a conversation
  async getMessageCount(conversationId: string): Promise<number> {
    return this.prisma.message.count({
      where: { conversationId }
    });
  }

  // Get messages by sender
  async findBySenderId(
    senderId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    messages: MessageWithSender[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const skip = (page - 1) * limit;

    const [messages, totalCount] = await Promise.all([
      this.prisma.message.findMany({
        where: { senderId },
        include: {
          sender: {
            select: { id: true, name: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.message.count({
        where: { senderId }
      })
    ]);

    const mappedMessages = messages.map(message => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      contentType: message.contentType,
      body: message.body,
      createdAt: message.createdAt,
      sender: message.sender
    }));

    return {
      messages: mappedMessages,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  }

  // Get latest message for each conversation (for chat list)
  async getLatestMessagesByConversations(conversationIds: string[]): Promise<MessageWithSender[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: { in: conversationIds }
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['conversationId']
    });

    return messages.map(message => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      contentType: message.contentType,
      body: message.body,
      createdAt: message.createdAt,
      sender: message.sender
    }));
  }

  // Bulk delete messages for a conversation
  async deleteMessagesByConversationId(conversationId: string): Promise<{ count: number }> {
    return this.prisma.message.deleteMany({
      where: { conversationId }
    });
  }

  // Get message statistics for a conversation
  async getMessageStats(conversationId: string): Promise<{
    totalMessages: number;
    messagesByContentType: { [key in ContentType]: number };
    messagesByRole: { [key in Role]: number };
    firstMessageDate: Date | null;
    lastMessageDate: Date | null;
  }> {
    const [
      totalMessages,
      messagesByContentType,
      messagesByRole,
      dateStats
    ] = await Promise.all([
      this.prisma.message.count({ where: { conversationId } }),
      this.prisma.message.groupBy({
        by: ['contentType'],
        where: { conversationId },
        _count: { id: true }
      }),
      this.prisma.message.groupBy({
        by: ['senderRole'],
        where: { conversationId },
        _count: { id: true }
      }),
      this.prisma.message.aggregate({
        where: { conversationId },
        _min: { createdAt: true },
        _max: { createdAt: true }
      })
    ]);

    const contentTypeStats = messagesByContentType.reduce((acc, curr) => {
      acc[curr.contentType] = curr._count.id;
      return acc;
    }, {} as { [key in ContentType]: number });

    const roleStats = messagesByRole.reduce((acc, curr) => {
      acc[curr.senderRole] = curr._count.id;
      return acc;
    }, {} as { [key in Role]: number });

    return {
      totalMessages,
      messagesByContentType: contentTypeStats,
      messagesByRole: roleStats,
      firstMessageDate: dateStats._min.createdAt,
      lastMessageDate: dateStats._max.createdAt
    };
  }
} 