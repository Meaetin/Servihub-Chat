// UserService.ts
import { PrismaClient, User, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

export interface CreateUserDTO {
  email?: string;
  name?: string;
  role: Role;
  password: string;
}

export interface UpdateUserDTO {
  email?: string;
  name?: string;
}

// User type without password for safe responses
export type SafeUser = Omit<User, 'password'>;

export class UserService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Create a new user
  async createUser(userData: CreateUserDTO): Promise<SafeUser> {
    // Validate email if provided
    if (userData.email && !this.validateEmail(userData.email)) {
      throw new Error('Invalid email format');
    }

    // Check if user already exists (if email provided)
    if (userData.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: userData.email }
      });
      
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    // Create user with explicit type assertion
    const user = await this.prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        password: hashedPassword
      } as any, // Type assertion to bypass TypeScript issue
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return user;
  }

  // Find user by ID 
  async findById(userId: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  // Find user by email 
  async findByEmail(email: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  // Private method to find user with password (for authentication)
  private async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email }
    }) as Promise<User | null>;
  }

  // Private method to find user by ID with password
  private async findByIdWithPassword(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId }
    }) as Promise<User | null>;
  }

  // Get all users with optional role filter
  async findMany(role?: Role): Promise<SafeUser[]> {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  // Update user
  async updateUser(userId: string, updateData: UpdateUserDTO): Promise<SafeUser> {
    // Validate email if being updated
    if (updateData.email && !this.validateEmail(updateData.email)) {
      throw new Error('Invalid email format');
    }

    // Check if email is already taken by another user
    if (updateData.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateData.email }
      });
      
      if (existingUser && existingUser.id !== userId) {
        throw new Error('Email is already taken by another user');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return updatedUser;
  }

  // Delete user
  async deleteUser(userId: string): Promise<SafeUser> {
    return this.prisma.user.delete({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  // Authenticate user
  async authenticateUser(email: string, password: string): Promise<SafeUser> {
    const user = await this.findByEmailWithPassword(email);
    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, (user as any).password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Return user without password
    const { password: _, ...safeUser } = user as any;
    return safeUser;
  }

  // Change password
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.findByIdWithPassword(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, (user as any).password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash and update new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword } as any // Type assertion to bypass TypeScript issue
    });
  }

  // Get user's conversations
  async getUserConversations(userId: string): Promise<any[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        conversationsAsCustomer: {
          include: {
            business: { select: { id: true, name: true, email: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1 // Take only the latest message
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        conversationsAsBusiness: {
          include: {
            customer: { select: { id: true, name: true, email: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1 // Take only the latest message
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Combine both conversation types
    const allConversations = [
      ...user.conversationsAsCustomer.map(conv => ({
        ...conv,
        otherParty: conv.business,
        userRole: 'customer' as const
      })),
      ...user.conversationsAsBusiness.map(conv => ({
        ...conv,
        otherParty: conv.customer,
        userRole: 'business' as const
      }))
    ];

    // Sort by latest message or creation date
    return allConversations.sort((a, b) => {
      const aDate = a.messages[0]?.createdAt || a.createdAt;
      const bDate = b.messages[0]?.createdAt || b.createdAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }

  // Private validation method
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}