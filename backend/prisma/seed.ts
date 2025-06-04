/// <reference types="node" />

import { PrismaClient, Role, ContentType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';


const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 12);

  const customer1 = await prisma.user.create({
    data: {
      email: 'customer1@example.com',
      name: 'John Customer',
      role: Role.CUSTOMER,
      password: hashedPassword
    } as any // Type assertion to bypass TypeScript issue
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'customer2@example.com',
      name: 'Jane Customer',
      role: Role.CUSTOMER,
      password: hashedPassword
    } as any // Type assertion to bypass TypeScript issue
  });

  const agent1 = await prisma.user.create({
    data: {
      email: 'agent1@servihub.com',
      name: 'Mike Agent',
      role: Role.AGENT,
      password: hashedPassword
    } as any // Type assertion to bypass TypeScript issue
  });

  const agent2 = await prisma.user.create({
    data: {
      email: 'agent2@servihub.com',
      name: 'Sarah Agent',
      role: Role.AGENT,
      password: hashedPassword
    } as any // Type assertion to bypass TypeScript issue
  });

  console.log('✅ Created 4 users');

  // Create conversations
  const conversation1 = await prisma.conversation.create({
    data: {
      customerId: customer1.id,
      businessId: agent1.id
    }
  });

  const conversation2 = await prisma.conversation.create({
    data: {
      customerId: customer2.id,
      businessId: agent2.id
    }
  });

  const conversation3 = await prisma.conversation.create({
    data: {
      customerId: customer1.id,
      businessId: agent2.id
    }
  });

  console.log('✅ Created 3 conversations');

  // Create messages for conversation 1
  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation1.id,
        senderId: customer1.id,
        senderRole: Role.CUSTOMER,
        contentType: ContentType.TEXT,
        body: 'Hello, I need help with my account setup.',
        createdAt: new Date('2024-01-15T10:00:00Z')
      },
      {
        conversationId: conversation1.id,
        senderId: agent1.id,
        senderRole: Role.AGENT,
        contentType: ContentType.TEXT,
        body: 'Hi John! I\'d be happy to help you with your account setup. What specific area do you need assistance with?',
        createdAt: new Date('2024-01-15T10:02:00Z')
      },
      {
        conversationId: conversation1.id,
        senderId: customer1.id,
        senderRole: Role.CUSTOMER,
        contentType: ContentType.TEXT,
        body: 'I\'m having trouble connecting my payment method.',
        createdAt: new Date('2024-01-15T10:05:00Z')
      },
      {
        conversationId: conversation1.id,
        senderId: agent1.id,
        senderRole: Role.AGENT,
        contentType: ContentType.TEXT,
        body: 'I can guide you through that process. First, please navigate to your account settings and look for the "Payment Methods" section.',
        createdAt: new Date('2024-01-15T10:07:00Z')
      },
      {
        conversationId: conversation1.id,
        senderId: customer1.id,
        senderRole: Role.CUSTOMER,
        contentType: ContentType.TEXT,
        body: 'Found it! What should I do next?',
        createdAt: new Date('2024-01-15T10:10:00Z')
      }
    ]
  });

  // Create messages for conversation 2
  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation2.id,
        senderId: customer2.id,
        senderRole: Role.CUSTOMER,
        contentType: ContentType.TEXT,
        body: 'Hi there! I have a question about billing.',
        createdAt: new Date('2024-01-16T14:30:00Z')
      },
      {
        conversationId: conversation2.id,
        senderId: agent2.id,
        senderRole: Role.AGENT,
        contentType: ContentType.TEXT,
        body: 'Hello Jane! I\'m here to help with any billing questions you have. What would you like to know?',
        createdAt: new Date('2024-01-16T14:32:00Z')
      },
      {
        conversationId: conversation2.id,
        senderId: customer2.id,
        senderRole: Role.CUSTOMER,
        contentType: ContentType.TEXT,
        body: 'I was charged twice for last month\'s subscription. Can you check that?',
        createdAt: new Date('2024-01-16T14:35:00Z')
      },
      {
        conversationId: conversation2.id,
        senderId: agent2.id,
        senderRole: Role.AGENT,
        contentType: ContentType.TEXT,
        body: 'I\'ll look into that right away. Can you provide me with your account email and the approximate dates of the charges?',
        createdAt: new Date('2024-01-16T14:37:00Z')
      }
    ]
  });

  // Create messages for conversation 3 (recent conversation)
  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation3.id,
        senderId: customer1.id,
        senderRole: Role.CUSTOMER,
        contentType: ContentType.TEXT,
        body: 'Quick question about the new features.',
        createdAt: new Date('2024-01-17T09:15:00Z')
      },
      {
        conversationId: conversation3.id,
        senderId: agent2.id,
        senderRole: Role.AGENT,
        contentType: ContentType.TEXT,
        body: 'Of course! What would you like to know about the new features?',
        createdAt: new Date('2024-01-17T09:17:00Z')
      },
      {
        conversationId: conversation3.id,
        senderId: customer1.id,
        senderRole: Role.CUSTOMER,
        contentType: ContentType.TEXT,
        body: 'How do I access the new dashboard?',
        createdAt: new Date('2024-01-17T09:20:00Z')
      }
    ]
  });

  console.log('✅ Created sample messages');

  // Create some file/image messages for testing
  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation1.id,
        senderId: customer1.id,
        senderRole: Role.CUSTOMER,
        contentType: ContentType.IMAGE,
        body: 'https://example.com/uploads/screenshot.png',
        createdAt: new Date('2024-01-15T10:15:00Z')
      },
      {
        conversationId: conversation2.id,
        senderId: customer2.id,
        senderRole: Role.CUSTOMER,
        contentType: ContentType.FILE,
        body: 'https://example.com/uploads/invoice.pdf',
        createdAt: new Date('2024-01-16T14:40:00Z')
      }
    ]
  });

  console.log('✅ Created file/image messages');

  // Summary
  const userCount = await prisma.user.count();
  const conversationCount = await prisma.conversation.count();
  const messageCount = await prisma.message.count();

  console.log('\n📊 Seeding Summary:');
  console.log(`   Users: ${userCount}`);
  console.log(`   Conversations: ${conversationCount}`);
  console.log(`   Messages: ${messageCount}`);

  console.log('\n🔑 Test Credentials:');
  console.log('   Customer 1: customer1@example.com / password123');
  console.log('   Customer 2: customer2@example.com / password123');
  console.log('   Agent 1: agent1@servihub.com / password123');
  console.log('   Agent 2: agent2@servihub.com / password123');

  console.log('\n🌱 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 