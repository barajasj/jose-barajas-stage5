require('dotenv').config();

console.log('Key loaded:', !!process.env.AI_API_KEY);

console.log(
  'First 8 chars:',
  process.env.AI_API_KEY?.substring(0, 8)
);