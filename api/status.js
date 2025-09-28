import { kv } from '@vercel/kv';

const NAS_HOST = 'archive.rafflesrocks.com';

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
    const [serverStatus, sftpStatus, lastCheck] = await Promise.all([
      kv.get('nas:server_status'),
      kv.get('nas:sftp_status'), 
      kv.get('nas:last_check'),
    ]);

    const response = {
      success: true,
      serverStatus: serverStatus?.status || 'unknown',
      sftpStatus: sftpStatus?.status || 'unknown',
      lastCheck: lastCheck || null,
      nextCheck: lastCheck ? 
          new Date(new Date(lastCheck).getTime() + (2 * 60 * 60 * 1000)).toISOString() : 
          null
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Failed to get status:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}