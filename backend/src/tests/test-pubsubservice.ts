    import { pubSubService } from '../services/PubSubService';
    import { MessageEvent } from '../types/pubsub';
    import { connectRedis } from '../utils/redisClient';

    async function testPubSubService() {
    console.log('🧪 Testing PubSubService manually...\n');

    const conversationId = 'test-conversation-123';

    try {
        // STEP 0: Connect to Redis 
        console.log('0️⃣ Connecting to Redis...');
        await connectRedis();
        console.log('✅ Redis connected successfully\n');

        // Test 1: Subscribe to conversation
        console.log('1️⃣ Setting up subscription...');
        
        // Add a promise to wait for subscription to be ready
        const subscriptionReady = new Promise<void>((resolve) => {
            setTimeout(() => {
                console.log('✅ Subscription setup complete\n');
                resolve();
            }, 500); // Give Redis time to set up subscription
        });

        await pubSubService.subscribeToConversation(conversationId, (message) => {
            console.log('📩 Received message:', {
                from: message.senderId,
                body: message.body,
                conversation: message.conversationId,
                timestamp: new Date(message.timestamp).toISOString()
            });
        });

        // Wait for subscription to be ready
        await subscriptionReady;

        // Test 2: Publish a message
        console.log('2️⃣ Publishing test message...');
        const testMessage: MessageEvent = {
            conversationId,
            senderId: 'test-user-123',
            body: 'Hello from PubSub test!',
            timestamp: Date.now(),
            contentType: 'TEXT'
        };

        await pubSubService.publishToConversation(conversationId, testMessage);
        console.log('✅ Message published\n');

        // Test 3: Publish multiple messages with delay
        console.log('3️⃣ Publishing multiple messages...');
        for (let i = 1; i <= 3; i++) {
            await pubSubService.publishToConversation(conversationId, {
                ...testMessage,
                body: `Test message ${i}`,
                timestamp: Date.now()
            });
            
            console.log(`   Published message ${i}`);
            
            // Small delay between messages
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('\n✅ PubSub test completed! Check the received messages above.');
        
        // Keep the process alive for a bit to see all messages
        console.log('⏳ Waiting 3 seconds to see all messages...');
        await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error) {
        console.error('❌ PubSub test failed:', error);
        
        // More detailed error info
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
    } finally {
        console.log('🔄 Cleaning up...');
        await pubSubService.unsubscribeAll();
        process.exit(0);
    }
    }

    // Run the test if this file is executed directly
    if (require.main === module) {
    testPubSubService();
    }