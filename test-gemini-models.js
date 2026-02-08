/**
 * Test script to list available Gemini models
 * Run with: node test-gemini-models.js
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiModels() {
  console.log('🔍 Testing common Gemini models...\n');

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY not found in environment variables');
    console.log('Please set GEMINI_API_KEY in your .env file');
    process.exit(1);
  }

  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...\n');

  // Common Gemini model names to test (based on official API docs)
  const modelsToTest = [
    'gemini-2.5-flash',      // Latest fast model (from docs)
    'gemini-2.5-pro',        // Latest pro model
    'gemini-2.0-flash-exp',  // Experimental
    'gemini-1.5-flash',      // Stable 1.5
    'gemini-1.5-pro',        // Stable 1.5 pro
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
  ];

  console.log('📋 Testing models with a simple prompt...\n');
  console.log('='.repeat(80));

  const workingModels = [];
  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of modelsToTest) {
    try {
      console.log(`\n🧪 Testing: ${modelName}`);
      
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // Try a simple text prompt
      const result = await model.generateContent('Reply with just "OK" if you can read this.');
      const response = await result.response;
      const text = response.text();

      console.log(`   ✅ WORKING - Response: ${text.trim()}`);
      workingModels.push(modelName);

    } catch (error) {
      if (error.message.includes('404')) {
        console.log(`   ❌ NOT FOUND - Model doesn't exist`);
      } else if (error.message.includes('not supported')) {
        console.log(`   ⚠️  EXISTS but doesn't support generateContent`);
      } else {
        console.log(`   ❌ ERROR - ${error.message.substring(0, 60)}...`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📌 Working models:\n');

  if (workingModels.length === 0) {
    console.log('   ❌ No working models found');
  } else {
    workingModels.forEach(model => {
      console.log(`   ✅ ${model}`);
    });

    console.log('\n💡 Recommended model for your app:');
    console.log(`   ${workingModels[0]}`);
    console.log(`\n📝 Update your .env file with:`);
    console.log(`   GEMINI_MODEL=${workingModels[0]}`);
  }

  console.log('\n');
}

// Test a specific model
async function testModel(modelName) {
  console.log(`\n🧪 Testing model: ${modelName}\n`);

  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    
    // Try a simple text prompt
    const result = await model.generateContent('Say "Hello, I am working!" if you can read this.');
    const response = await result.response;
    const text = response.text();

    console.log(`✅ Model "${modelName}" is working!`);
    console.log(`Response: ${text}\n`);

  } catch (error) {
    console.error(`❌ Model "${modelName}" failed:`, error.message);
  }
}

// Quick test for current configuration
async function quickTest() {
  console.log('🚀 Quick Test - Testing current configuration\n');
  
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY not found in .env file');
    process.exit(1);
  }

  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');
  console.log('📦 Model to test:', modelName);
  console.log('='.repeat(80) + '\n');

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    console.log('🧪 Testing text generation...');
    const model = genAI.getGenerativeModel({ model: modelName });
    
    const result = await model.generateContent('Reply with just "OK" if you can read this.');
    const response = await result.response;
    const text = response.text();

    console.log(`✅ SUCCESS! Model is working!`);
    console.log(`Response: "${text.trim()}"\n`);

    // Now test with an image (base64 encoded 1x1 pixel)
    console.log('🧪 Testing image analysis...');
    const imageResult = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k='
        }
      },
      { text: 'What is this?' }
    ]);
    const imageResponse = await imageResult.response;
    const imageText = imageResponse.text();

    console.log(`✅ SUCCESS! Image analysis is working!`);
    console.log(`Response: "${imageText.substring(0, 100)}..."\n`);

    console.log('='.repeat(80));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('✅ Your Gemini configuration is correct');
    console.log('✅ Ready to deploy to Railway\n');

  } catch (error) {
    console.log('❌ TEST FAILED!\n');
    console.error('Error:', error.message);
    
    if (error.message.includes('404')) {
      console.log('\n💡 Model not found. Try one of these:');
      console.log('   - gemini-2.5-flash');
      console.log('   - gemini-1.5-flash');
      console.log('   - gemini-1.5-pro');
      console.log('\nUpdate GEMINI_MODEL in your .env file');
    } else if (error.message.includes('API key')) {
      console.log('\n💡 API key issue. Check:');
      console.log('   - GEMINI_API_KEY is set correctly in .env');
      console.log('   - Get a key at: https://makersuite.google.com/app/apikey');
    }
    
    console.log('\n');
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  GEMINI MODEL TESTER');
  console.log('='.repeat(80) + '\n');

  // Test specific model if provided as argument
  const testModelName = process.argv[2];
  
  if (testModelName === 'all') {
    // Test all common models
    await testGeminiModels();
  } else if (testModelName) {
    await testModel(testModelName);
  } else {
    // Quick test with current config
    await quickTest();
  }
}

main().catch(console.error);
