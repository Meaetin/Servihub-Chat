import { PrismaClient, Conversation, Role } from '@prisma/client';

export interface CreateConversationDTO {
  customerId: string;
  businessId: string;
}

export interface ConversationWithDetails {
  id: string;
  customerId: string;
  businessId: string;
  createdAt: Date;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
  };
  business: {
    id: string;
    name: string | null;
    email: string | null;
  };
  lastMessage?: {
    id: string;
    body: string;
    contentType: string;
    createdAt: Date;
    sender: {
      id: string;
      name: string | null;
      role: Role;
    };
  };
  messageCount: number;
}

export class ConversationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Create a new conversation
  async createConversation(data: CreateConversationDTO): Promise<Conversation> {
    // Validate that both users exist
    const [customer, business] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: data.customerId } }),
      this.prisma.user.findUnique({ where: { id: data.businessId } })
    ]);

    if (!customer) {
      throw new Error('Customer not found');
    }
    if (!business) {
      throw new Error('Business user not found');
    }

    // Check if conversation already exists between these users
    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        customerId: data.customerId,
        businessId: data.businessId
      }
    });

    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    return this.prisma.conversation.create({
      data: {
        customerId: data.customerId,
        businessId: data.businessId
      }
    });
  }

  // Get conversation by ID
  async findById(conversationId: string): Promise<Conversation | null> {
    return this.prisma.conversation.findUnique({
      where: { id: conversationId }
    });
  }

  // Get conversation with details (users and last message)
  async findByIdWithDetails(conversationId: string): Promise<ConversationWithDetails | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: {
          select: { id: true, name: true, email: true }
        },
        business: {
          select: { id: true, name: true, email: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true, role: true }
            }
          }
        },
        _count: {
          select: { messages: true }
        }
      }
    });

    if (!conversation) {
      return null;
    }

    return {
      id: conversation.id,
      customerId: conversation.customerId,
      businessId: conversation.businessId,
      createdAt: conversation.createdAt,
      customer: conversation.customer,
      business: conversation.business,
      lastMessage: conversation.messages[0] ? {
        id: conversation.messages[0].id,
        body: conversation.messages[0].body,
        contentType: conversation.messages[0].contentType,
        createdAt: conversation.messages[0].createdAt,
        sender: conversation.messages[0].sender
      } : undefined,
      messageCount: conversation._count.messages
    };
  }

  // Get all conversations for a user
  async findByUserId(userId: string): Promise<ConversationWithDetails[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [
          { customerId: userId },
          { businessId: userId }
        ]
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true }
        },
        business: {
          select: { id: true, name: true, email: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true, role: true }
            }
          }
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return conversations.map(conversation => ({
      id: conversation.id,
      customerId: conversation.customerId,
      businessId: conversation.businessId,
      createdAt: conversation.createdAt,
      customer: conversation.customer,
      business: conversation.business,
      lastMessage: conversation.messages[0] ? {
        id: conversation.messages[0].id,
        body: conversation.messages[0].body,
        contentType: conversation.messages[0].contentType,
        createdAt: conversation.messages[0].createdAt,
        sender: conversation.messages[0].sender
      } : undefined,
      messageCount: conversation._count.messages
    }));
  }

  // Get conversations with pagination
  async findManyWithPagination(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    conversations: ConversationWithDetails[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const skip = (page - 1) * limit; // calculate the number of items to skip

    const [conversations, totalCount] = await Promise.all([ 
      this.prisma.conversation.findMany({ // find all conversations
        where: {
          OR: [
            { customerId: userId }, // find conversations where the customer is the user
            { businessId: userId } // find conversations where the business is the user
          ]
        },
        include: {
          customer: {
            select: { id: true, name: true, email: true } // select the id, name, and email of the customer
          },
          business: {
            select: { id: true, name: true, email: true } // select the id, name, and email of the business
          },
          messages: {
            orderBy: { createdAt: 'desc' }, // order by creation date in descending order
            take: 1, // take the most recent message
            include: {
              sender: {
                select: { id: true, name: true, role: true } // select the id, name, and role of the sender
              }
            }
          },
          _count: {
            select: { messages: true } // count the number of messages in the conversation
          }
        },
        orderBy: { createdAt: 'desc' }, // order by creation date in descending order
        skip, // skip the number of items specified by the page and limit
        take: limit // take the number of items specified by the limit
      }),
      this.prisma.conversation.count({ // count the number of conversations
        where: {
          OR: [
            { customerId: userId }, // count conversations where the customer is the user
            { businessId: userId } // count conversations where the business is the user
          ]
        }
      })
    ]);

    const mappedConversations = conversations.map(conversation => ({
      id: conversation.id,
      customerId: conversation.customerId,
      businessId: conversation.businessId,
      createdAt: conversation.createdAt,
      customer: conversation.customer,
      business: conversation.business,
      lastMessage: conversation.messages[0] ? {
        id: conversation.messages[0].id,
        body: conversation.messages[0].body,
        contentType: conversation.messages[0].contentType,
        createdAt: conversation.messages[0].createdAt,
        sender: conversation.messages[0].sender
      } : undefined,
      messageCount: conversation._count.messages
    }));

    return {
      conversations: mappedConversations,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  }

  // Delete conversation
  async deleteConversation(conversationId: string): Promise<Conversation> {
    // First delete all messages in the conversation
    await this.prisma.message.deleteMany({
      where: { conversationId }
    });

    // Then delete the conversation
    return this.prisma.conversation.delete({
      where: { id: conversationId }
    });
  }

  // Check if user is participant in conversation
  async isUserParticipant(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { customerId: true, businessId: true }
    });

    if (!conversation) {
      return false;
    }

    return conversation.customerId === userId || conversation.businessId === userId;
  }

  // Get conversation between two specific users
  async findByParticipants(customerId: string, businessId: string): Promise<Conversation | null> {
    return this.prisma.conversation.findFirst({
      where: {
        customerId,
        businessId
      }
    });
  }

  // Get conversation statistics
  async getConversationStats(conversationId: string): Promise<{
    messageCount: number;
    firstMessageDate: Date | null;
    lastMessageDate: Date | null;
  }> {
    const stats = await this.prisma.message.aggregate({
      where: { conversationId },
      _count: { id: true },
      _min: { createdAt: true },
      _max: { createdAt: true }
    });

    return {
      messageCount: stats._count.id,
      firstMessageDate: stats._min.createdAt,
      lastMessageDate: stats._max.createdAt
    };
  }
} 