import { getLatestStatus } from '../src/lib/redis.js'

const NAS_HOST = 'archive.rafflesrocks.com';

async function checkServerStatus() {
  try {
    console.log('Reading server status from Redis database...')
    
    const latestStatus = await getLatestStatus()
    
    if (latestStatus) {
      return {
        serverStatus: latestStatus.serverStatus || 'down',
        sftpStatus: latestStatus.sftpStatus || 'down',
        lastCheck: latestStatus.lastCheck || new Date().toISOString()
      }
    } else {
      // If no status found in database, return default offline status
      console.log('No status found in database, returning default offline status')
      return {
        serverStatus: 'down',
        sftpStatus: 'down',
        lastCheck: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('Error reading server status from database:', error)
    return {
      serverStatus: 'down',
      sftpStatus: 'down',
      lastCheck: new Date().toISOString()
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('API: Getting server status from database...')
    
    const statusData = await checkServerStatus()
    
    console.log('API: Retrieved status data:', statusData)

    const response = {
      success: true,
      serverStatus: statusData.serverStatus,
      sftpStatus: statusData.sftpStatus,
      lastCheck: statusData.lastCheck,
      nextCheck: statusData.lastCheck ? 
          new Date(new Date(statusData.lastCheck).getTime() + (5 * 60 * 1000)).toISOString() : 
          null
    };

    console.log('API: Sending response:', response)
    return res.status(200).json(response);

  } catch (error) {
    console.error('API: Failed to get status:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      serverStatus: 'down',
      sftpStatus: 'down',
      lastCheck: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });
  }
}