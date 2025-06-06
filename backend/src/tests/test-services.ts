import { PrismaClient } from '@prisma/client';
import { UserService, ConversationService, MessageService } from '../services';

const prisma = new PrismaClient();

async function testServices() {
  console.log('🧪 Testing Services...\n');

  // Initialize services
  const userService = new UserService(prisma);
  const conversationService = new ConversationService(prisma);
  const messageService = new MessageService(prisma);

  try {
    // Test UserService
    console.log('1️⃣ Testing UserService...');
    const users = await userService.findMany();
    console.log(`   Found ${users.length} users`);
    
    const customer = await userService.findByEmail('customer1@example.com');
    if (customer) {
      console.log(`   Customer: ${customer.name} (${customer.role})`);
    }

    // Test ConversationService
    console.log('\n2️⃣ Testing ConversationService...');
    if (customer) {
      const conversations = await conversationService.findByUserId(customer.id);
      console.log(`   Found ${conversations.length} conversations for ${customer.name}`);
      
      if (conversations.length > 0) {
        const conv = conversations[0];
        console.log(`   Latest conversation with: ${conv.customer.id === customer.id ? conv.business.name : conv.customer.name}`);
        console.log(`   Message count: ${conv.messageCount}`);
      }
    }

    // Test MessageService
    console.log('\n3️⃣ Testing MessageService...');
    if (customer) {
      const conversations = await conversationService.findByUserId(customer.id);
      if (conversations.length > 0) {
        const messages = await messageService.findByConversationId(conversations[0].id, 1, 5);
        console.log(`   Found ${messages.messages.length} messages in conversation`);
        console.log(`   Latest message: "${messages.messages[0]?.body.substring(0, 50)}..."`);
      }
    }

    // Test authentication
    console.log('\n4️⃣ Testing Authentication...');
    const authResult = await userService.authenticateUser('customer1@example.com', 'password123');
    console.log(`   Authentication successful for: ${authResult.name}`);

    console.log('\n✅ All service tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Service test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testServices(); 