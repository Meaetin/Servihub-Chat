import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_key';
const API_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const API_HOST = process.env.HOST || 'localhost';
const API_BASE_URL = `http://${API_HOST}:${API_PORT}/api/chat`;

// Test user token (you'll need to replace this with actual tokens from your test)
const TEST_TOKEN = jwt.sign(
  { 
    userId: 'test-user-id', 
    email: 'test@example.com', 
    role: 'CUSTOMER' 
  },
  JWT_SECRET,
  { expiresIn: '24h' }
);

async function testFileUpload() {
  console.log('🧪 Testing File Upload Endpoint...\n');

  // Check if server is running
  try {
    const healthCheck = await axios.get(`${API_BASE_URL}/health`, {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
      timeout: 5000
    });
    console.log('✅ Server is running and accessible\n');
  } catch (error: any) {
    console.log('❌ Server is not running or not accessible');
    console.log('   Please start the server with: npm run dev');
    console.log('   Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log(`   Make sure the server is running on http://${API_HOST}:${API_PORT}`);
    }
    return;
  }

  try {
    // Create test files directory
    const testFilesDir = path.join(__dirname, '../test-files');
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Test Case 1: Valid text file upload
    console.log('1. Testing valid text file upload...');
    const textFilePath = path.join(testFilesDir, 'test-document.txt');
    fs.writeFileSync(textFilePath, 'This is a test document for file upload testing.');

    const textFormData = new FormData();
    textFormData.append('file', fs.createReadStream(textFilePath));

    try {
      const textResponse = await axios.post(`${API_BASE_URL}/upload`, textFormData, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          ...textFormData.getHeaders()
        }
      });

      console.log('✅ Text file upload successful');
      console.log('   Response:', JSON.stringify(textResponse.data, null, 2));
    } catch (error: any) {
      console.log('❌ Text file upload failed:', error.response?.data || error.message);
    }

    // Test Case 2: Valid image file upload
    console.log('\n2. Testing valid image file upload...');
    const imageFilePath = path.join(testFilesDir, 'test-image.jpg');
    
    // Create a minimal valid JPEG file
    const jpegBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
    ]);
    fs.writeFileSync(imageFilePath, jpegBuffer);

    const imageFormData = new FormData();
    imageFormData.append('file', fs.createReadStream(imageFilePath));

    try {
      const imageResponse = await axios.post(`${API_BASE_URL}/upload`, imageFormData, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          ...imageFormData.getHeaders()
        }
      });

      console.log('✅ Image file upload successful');
      console.log('   Response:', JSON.stringify(imageResponse.data, null, 2));
    } catch (error: any) {
      console.log('❌ Image file upload failed:', error.response?.data || error.message);
    }

    // Test Case 3: No file provided
    console.log('\n3. Testing upload with no file...');
    const emptyFormData = new FormData();

    try {
      const emptyResponse = await axios.post(`${API_BASE_URL}/upload`, emptyFormData, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          ...emptyFormData.getHeaders()
        }
      });

      console.log('❌ Should have failed but succeeded:', emptyResponse.data);
    } catch (error: any) {
      if (error.response?.status === 400) {
        console.log('✅ Correctly rejected empty upload');
        console.log('   Error:', error.response.data);
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    // Test Case 4: Large file (simulated)
    console.log('\n4. Testing large file upload...');
    const largeFilePath = path.join(testFilesDir, 'large-file.txt');
    
    // Create a file larger than 10MB
    const largeContent = 'A'.repeat(11 * 1024 * 1024); // 11MB
    fs.writeFileSync(largeFilePath, largeContent);

    const largeFormData = new FormData();
    largeFormData.append('file', fs.createReadStream(largeFilePath));

    try {
      const largeResponse = await axios.post(`${API_BASE_URL}/upload`, largeFormData, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          ...largeFormData.getHeaders()
        }
      });

      console.log('❌ Should have failed but succeeded:', largeResponse.data);
    } catch (error: any) {
      if (error.response?.status === 413) {
        console.log('✅ Correctly rejected large file');
        console.log('   Error:', error.response.data);
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    // Test Case 5: Invalid token
    console.log('\n5. Testing upload with invalid token...');
    const invalidFormData = new FormData();
    invalidFormData.append('file', fs.createReadStream(textFilePath));

    try {
      const invalidTokenResponse = await axios.post(`${API_BASE_URL}/upload`, invalidFormData, {
        headers: {
          'Authorization': 'Bearer invalid-token',
          ...invalidFormData.getHeaders()
        }
      });

      console.log('❌ Should have failed but succeeded:', invalidTokenResponse.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly rejected invalid token');
        console.log('   Error:', error.response.data);
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    // Test Case 6: No token
    console.log('\n6. Testing upload with no token...');
    const noTokenFormData = new FormData();
    noTokenFormData.append('file', fs.createReadStream(textFilePath));

    try {
      const noTokenResponse = await axios.post(`${API_BASE_URL}/upload`, noTokenFormData, {
        headers: {
          ...noTokenFormData.getHeaders()
        }
      });

      console.log('❌ Should have failed but succeeded:', noTokenResponse.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly rejected missing token');
        console.log('   Error:', error.response.data);
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    console.log('\n🎉 File upload testing completed!\n');

  } catch (error) {
    console.error('💥 Test setup failed:', error);
  } finally {
    // Cleanup test files
    const testFilesDir = path.join(__dirname, '../test-files');
    if (fs.existsSync(testFilesDir)) {
      try {
        fs.rmSync(testFilesDir, { recursive: true, force: true });
        console.log('🧹 Test files cleaned up');
      } catch (cleanupError: any) {
        console.log('⚠️ Cleanup warning:', cleanupError.message);
        // Try alternative cleanup method for Windows
        try {
          const files = fs.readdirSync(testFilesDir);
          for (const file of files) {
            fs.unlinkSync(path.join(testFilesDir, file));
          }
          fs.rmdirSync(testFilesDir);
          console.log('🧹 Test files cleaned up (alternative method)');
        } catch (altError) {
          console.log('⚠️ Could not clean up test files, please remove manually:', testFilesDir);
        }
      }
    }
  }
}

// CURL Examples for manual testing
function printCurlExamples() {
  console.log('\n📋 Manual Testing with CURL:\n');
  
  console.log('1. Upload a text file:');
  console.log(`curl -X POST "${API_BASE_URL}/upload" \\`);
  console.log(`  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\`);
  console.log(`  -F "file=@/path/to/your/file.txt"`);
  
  console.log('\n2. Upload an image file:');
  console.log(`curl -X POST "${API_BASE_URL}/upload" \\`);
  console.log(`  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\`);
  console.log(`  -F "file=@/path/to/your/image.jpg"`);
  
  console.log('\n3. Test with invalid token:');
  console.log(`curl -X POST "${API_BASE_URL}/upload" \\`);
  console.log(`  -H "Authorization: Bearer invalid-token" \\`);
  console.log(`  -F "file=@/path/to/your/file.txt"`);
  
  console.log('\n4. Test without token:');
  console.log(`curl -X POST "${API_BASE_URL}/upload" \\`);
  console.log(`  -F "file=@/path/to/your/file.txt"`);

  console.log('\n🔑 Replace YOUR_TOKEN_HERE with actual JWT tokens from running the main test suite.');
}

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('🚀 Starting File Upload Tests...\n');
  console.log(`📡 API Base URL: ${API_BASE_URL}`);
  console.log(`🔑 Test Token: ${TEST_TOKEN.substring(0, 50)}...\n`);
  
  testFileUpload()
    .then(() => {
      printCurlExamples();
    })
    .catch(console.error);
}

export { testFileUpload }; 