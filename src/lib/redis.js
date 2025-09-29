import { Redis } from '@upstash/redis'

// Initialize Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Status storage functions
export async function updateServerStatus(serverStatus, sftpStatus) {
  try {
    const statusData = {
      serverStatus,
      sftpStatus,
      lastCheck: new Date().toISOString(),
      timestamp: Date.now()
    }
    
    // Store current status
    await redis.hset('server:status', statusData)
    
    // Store in history (keep last 50 entries)
    await redis.lpush('server:history', JSON.stringify(statusData))
    await redis.ltrim('server:history', 0, 49) // Keep only last 50 entries
    
    console.log('Status updated in Redis:', statusData)
    return statusData
  } catch (error) {
    console.error('Error updating server status in Redis:', error)
    throw error
  }
}

export async function getLatestStatus() {
  try {
    const status = await redis.hgetall('server:status')
    
    if (status && Object.keys(status).length > 0) {
      return {
        serverStatus: status.serverStatus,
        sftpStatus: status.sftpStatus,
        lastCheck: status.lastCheck,
        timestamp: status.timestamp
      }
    }
    
    return null
  } catch (error) {
    console.error('Error fetching latest status from Redis:', error)
    return null
  }
}

export async function getStatusHistory(limit = 10) {
  try {
    const history = await redis.lrange('server:history', 0, limit - 1)
    
    return history.map(item => {
      try {
        return JSON.parse(item)
      } catch (e) {
        console.error('Error parsing history item:', item)
        return null
      }
    }).filter(item => item !== null)
  } catch (error) {
    console.error('Error fetching status history from Redis:', error)
    return []
  }
}

export async function setServerOnline() {
  return updateServerStatus('up', 'up')
}

export async function setServerOffline() {
  return updateServerStatus('down', 'down')
}

export async function getRedisInfo() {
  try {
    const info = await redis.info()
    return info
  } catch (error) {
    console.error('Error getting Redis info:', error)
    return null
  }
}