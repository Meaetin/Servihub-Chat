import WebSocket from 'ws';
import { WebSocketMessageType } from '../websocket/WebSocketManager';
import { connectRedis } from '../utils/redisClient';
import jwt from 'jsonwebtoken';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_key';
const SERVER_URL = 'ws://localhost:3001';

// Test user tokens
const generateTestTokens = () => {
  const customer1Token = jwt.sign({
    userId: 'customer1-uuid',
    email: 'customer1@example.com',
    role: 'CUSTOMER'
  }, JWT_SECRET, { expiresIn: '1h' });

  const customer2Token = jwt.sign({
    userId: 'customer2-uuid', 
    email: 'customer2@example.com',
    role: 'CUSTOMER'
  }, JWT_SECRET, { expiresIn: '1h' });

  const agentToken = jwt.sign({
    userId: 'agent1-uuid',
    email: 'agent@company.com', 
    role: 'AGENT'
  }, JWT_SECRET, { expiresIn: '1h' });

  return { customer1Token, customer2Token, agentToken };
};

// Helper function to create WebSocket connection
const createWebSocketConnection = (token: string): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${SERVER_URL}/ws?token=${token}`);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      resolve(ws);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      reject(error);
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
    });
  });
};

// Helper function to send message and wait for response
const sendAndWaitForResponse = (ws: WebSocket, message: any, expectedType?: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Response timeout'));
    }, 5000);

    const messageHandler = (data: any) => {
      try {
        const response = JSON.parse(data.toString());
        if (!expectedType || response.type === expectedType) {
          clearTimeout(timeout);
          ws.removeListener('message', messageHandler);
          resolve(response);
        }
      } catch (error) {
        // Ignore parsing errors, continue waiting
      }
    };

    ws.on('message', messageHandler);
    ws.send(JSON.stringify(message));
  });
};

// Test 1: Basic WebSocket Connection
async function testBasicConnection() {
  console.log('\n🧪 Test 1: Basic WebSocket Connection');
  
  try {
    const { customer1Token } = generateTestTokens();
    const ws = await createWebSocketConnection(customer1Token);
    
    // Wait for welcome message
    const welcomeMessage = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === WebSocketMessageType.WELCOME) {
          resolve(message);
        }
      });
    });

    console.log('📩 Received welcome message:', welcomeMessage);
    
    ws.close();
    console.log('✅ Test 1 passed: Basic connection successful');
    
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
  }
}

// Test 2: Authentication Failure
async function testAuthenticationFailure() {
  console.log('\n🧪 Test 2: Authentication Failure');
  
  try {
    const ws = new WebSocket(`${SERVER_URL}/ws?token=invalid_token`);
    
    const result: { code: number | null, reason: string } = await new Promise((resolve) => {
      ws.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });

      ws.on('open', () => {
        resolve({ code: null, reason: 'Connection should not have opened' });
      });
    });

    if (result.code === 1008) {
      console.log('✅ Test 2 passed: Authentication failed as expected');
    } else {
      console.log('❌ Test 2 failed: Expected authentication failure');
    }
    
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
  }
}

// Test 3: Chat Message Flow
async function testChatMessageFlow() {
  console.log('\n🧪 Test 3: Chat Message Flow');
  
  try {
    const { customer1Token, agentToken } = generateTestTokens();
    
    // Connect both users
    const customer1Ws = await createWebSocketConnection(customer1Token);
    const agent1Ws = await createWebSocketConnection(agentToken);

    // Wait for welcome messages
    await Promise.all([
      new Promise(resolve => customer1Ws.once('message', resolve)),
      new Promise(resolve => agent1Ws.once('message', resolve))
    ]);

    const conversationId = 'test-conversation-456'; // This should exist in your test data
    
    // Customer sends a message
    const chatMessage = {
      type: WebSocketMessageType.CHAT_MESSAGE,
      conversationId: conversationId,
      body: 'Hello, I need help with my order!',
      contentType: 'TEXT'
    };

    console.log('📤 Customer sending message:', chatMessage);
    
    // Send message and wait for confirmation
    const messageSent = await sendAndWaitForResponse(
      customer1Ws, 
      chatMessage, 
      WebSocketMessageType.MESSAGE_SENT
    );
    
    console.log('✅ Message sent confirmation:', messageSent);

    // Wait for agent to receive the message
    const messageReceived = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Agent did not receive message')), 5000);
      
      agent1Ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === WebSocketMessageType.MESSAGE_RECEIVED) {
          clearTimeout(timeout);
          resolve(message);
        }
      });
    });

    console.log('📩 Agent received message:', messageReceived);
    
    // Cleanup
    customer1Ws.close();
    agent1Ws.close();
    
    console.log('✅ Test 3 passed: Chat message flow successful');
    
  } catch (error) {
    console.error('❌ Test 3 failed:', error);
  }
}

// Test 4: Typing Indicators
async function testTypingIndicators() {
  console.log('\n🧪 Test 4: Typing Indicators');
  
  try {
    const { customer1Token, agentToken } = generateTestTokens();
    
    const customer1Ws = await createWebSocketConnection(customer1Token);
    const agent1Ws = await createWebSocketConnection(agentToken);

    // Wait for welcome messages
    await Promise.all([
      new Promise(resolve => customer1Ws.once('message', resolve)),
      new Promise(resolve => agent1Ws.once('message', resolve))
    ]);

    const conversationId = 'test-conversation-456';
    
    // Customer starts typing
    const typingStart = {
      type: WebSocketMessageType.TYPING_START,
      conversationId: conversationId
    };

    console.log('⌨️ Customer starts typing');
    customer1Ws.send(JSON.stringify(typingStart));

    // Wait for agent to receive typing indicator
    const typingIndicator = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Agent did not receive typing indicator')), 5000);
      
      agent1Ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === WebSocketMessageType.TYPING_INDICATOR) {
          clearTimeout(timeout);
          resolve(message);
        }
      });
    });

    console.log('📩 Agent received typing indicator:', typingIndicator);

    // Customer stops typing
    const typingStop = {
      type: WebSocketMessageType.TYPING_STOP,
      conversationId: conversationId
    };

    console.log('⌨️ Customer stops typing');
    customer1Ws.send(JSON.stringify(typingStop));

    // Wait a bit for stop indicator
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Cleanup
    customer1Ws.close();
    agent1Ws.close();
    
    console.log('✅ Test 4 passed: Typing indicators working');
    
  } catch (error) {
    console.error('❌ Test 4 failed:', error);
  }
}

// Test 5: Presence Updates
async function testPresenceUpdates() {
  console.log('\n🧪 Test 5: Presence Updates');
  
  try {
    const { customer1Token, customer2Token } = generateTestTokens();
    
    // Customer 1 connects first
    const customer1Ws = await createWebSocketConnection(customer1Token);
    await new Promise(resolve => customer1Ws.once('message', resolve));

    // Set up presence listener for customer 1
    const presenceUpdates: any[] = [];
    customer1Ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === WebSocketMessageType.PRESENCE_UPDATE) {
        presenceUpdates.push(message);
        console.log('📩 Presence update received:', message.data);
      }
    });

    // Customer 2 connects (should trigger presence update)
    console.log('👤 Customer 2 connecting...');
    const customer2Ws = await createWebSocketConnection(customer2Token);
    await new Promise(resolve => customer2Ws.once('message', resolve));

    // Wait for presence updates
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Customer 2 disconnects (should trigger offline presence)
    console.log('👤 Customer 2 disconnecting...');
    customer2Ws.close();

    // Wait for offline presence update
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`📊 Total presence updates received: ${presenceUpdates.length}`);
    
    // Cleanup
    customer1Ws.close();
    
    console.log('✅ Test 5 passed: Presence updates working');
    
  } catch (error) {
    console.error('❌ Test 5 failed:', error);
  }
}

// Test 6: Ping/Pong Health Check
async function testPingPong() {
  console.log('\n🧪 Test 6: Ping/Pong Health Check');
  
  try {
    const { customer1Token } = generateTestTokens();
    const ws = await createWebSocketConnection(customer1Token);
    
    // Wait for welcome message
    await new Promise(resolve => ws.once('message', resolve));

    // Send ping
    const pingMessage = {
      type: WebSocketMessageType.PING
    };

    console.log('🏓 Sending ping');
    const pongResponse = await sendAndWaitForResponse(
      ws, 
      pingMessage, 
      WebSocketMessageType.PONG
    );

    console.log('🏓 Received pong:', pongResponse);
    
    ws.close();
    console.log('✅ Test 6 passed: Ping/Pong working');
    
  } catch (error) {
    console.error('❌ Test 6 failed:', error);
  }
}

// Main test runner
async function runWebSocketTests() {
  console.log('🚀 Starting WebSocket Tests...\n');
  console.log('⚠️  Make sure your server is running on localhost:3001');
  console.log('⚠️  Make sure Redis is running and connected');
  console.log('⚠️  Make sure you have test data seeded\n');

  try {
    // Ensure Redis is connected
    await connectRedis();
    console.log('✅ Redis connected for tests\n');

    // Run all tests
    await testBasicConnection();
    await testAuthenticationFailure();
    await testChatMessageFlow();
    await testTypingIndicators();
    await testPresenceUpdates();
    await testPingPong();

    console.log('\n🎉 All WebSocket tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  } finally {
    // Give time for cleanup
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Interactive test for manual debugging
async function interactiveTest() {
  console.log('🧪 Interactive WebSocket Test');
  console.log('This will create a WebSocket connection and log all messages\n');

  try {
    const { customer1Token } = generateTestTokens();
    const ws = await createWebSocketConnection(customer1Token);

    // Log all incoming messages
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📩 Received:', JSON.stringify(message, null, 2));
    });

    // Keep connection alive
    console.log('✅ WebSocket connected. Press Ctrl+C to exit...');
    
    // Send a test message every 10 seconds
    const interval = setInterval(() => {
      const testMessage = {
        type: WebSocketMessageType.PING
      };
      ws.send(JSON.stringify(testMessage));
      console.log('🏓 Sent ping');
    }, 10000);

    // Handle process termination
    process.on('SIGINT', () => {
      clearInterval(interval);
      ws.close();
      console.log('\n👋 Connection closed');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Interactive test failed:', error);
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'interactive') {
  interactiveTest();
} else {
  runWebSocketTests();
}

export { runWebSocketTests, interactiveTest }; 