// Test script to verify Upstash Redis connection
// Run with: node test-redis.js

import { updateServerStatus, getLatestStatus, getStatusHistory } from './src/lib/redis.js'

async function testRedisConnection() {
  console.log('🔍 Testing Upstash Redis connection...')
  
  try {
    console.log('📝 Updating server status...')
    await updateServerStatus('up', 'up')
    console.log('✅ Status updated successfully')
    
    console.log('📊 Fetching latest status...')
    const status = await getLatestStatus()
    console.log('✅ Latest status:', status)
    
    console.log('📜 Fetching status history...')
    const history = await getStatusHistory(5)
    console.log('✅ Status history:', history)
    
    console.log('🎉 Redis connection test completed successfully!')
  } catch (error) {
    console.error('❌ Redis connection test failed:', error)
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRedisConnection()
}