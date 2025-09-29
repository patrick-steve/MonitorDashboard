import { updateServerStatus, getLatestStatus, redis } from '../src/lib/redis.js';

const NAS_HOST = 'archive.rafflesrocks.com';
const SFTP_PORT = 5022;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO;
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM;

async function checkServerStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`https://${NAS_HOST}`, {
      signal: controller.signal,
      method: 'HEAD'
    });

    console.log()
    
    clearTimeout(timeoutId);
    return {
      status: response.ok ? 'up' : 'down',
      statusCode: response.status,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'down',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkSftpStatus() {
  const Client = require('ssh2-sftp-client');
  const sftp = new Client();
  
  try {
    console.log(`Connecting to SFTP at ${NAS_HOST}:${SFTP_PORT}`);
    
    await sftp.connect({
      host: NAS_HOST,
      port: SFTP_PORT,
      username: process.env.SFTP_USERNAME,
      password: process.env.SFTP_PASSWORD,
      readyTimeout: 10000,
      strictVendor: false,
      retries: 1
    });
    
    console.log('SFTP connection established');
    
    const testFilePath = process.env.SFTP_TEST_FILE_PATH || '/test.txt';
    const fileBuffer = await sftp.get(testFilePath);
    
    const fileStats = await sftp.stat(testFilePath);
    const fileSize = fileBuffer.length;
    
    console.log(`Successfully downloaded test file: ${testFilePath} (${fileSize} bytes)`);
    
    await sftp.end();
    
    return {
      status: 'up',
      port: SFTP_PORT,
      timestamp: new Date().toISOString(),
      testFile: {
        path: testFilePath,
        size: fileSize,
        downloadTime: new Date().toISOString(),
        lastModified: fileStats.modifyTime ? new Date(fileStats.modifyTime).toISOString() : null
      }
    };
    
  } catch (error) {
    console.error('SFTP check failed:', error.message);
    
    try {
      await sftp.end();
    } catch (closeError) {
      // Ignore close errors
    }
    
    return {
      status: 'down',
      port: SFTP_PORT,
      error: error.message,
      timestamp: new Date().toISOString(),
      testFile: {
        path: process.env.SFTP_TEST_FILE_PATH || '/test.txt',
        downloadFailed: true
      }
    };
  }
}

async function sendAlert(serverStatus, sftpStatus) {
  if (!BREVO_API_KEY || !ALERT_EMAIL_TO || !ALERT_EMAIL_FROM) {
    console.log('Email configuration missing, skipping alert');
    return;
  }

  const subject = `🚨 NAS Server Alert - ${NAS_HOST}`;
  let alertMessage = `NAS Server Monitoring Alert\n\n`;
  
  if (serverStatus.status === 'down') {
    alertMessage += `❌ Server Status: DOWN\n`;
    alertMessage += `   Error: ${serverStatus.error || 'Server not responding'}\n`;
  }
  
  if (sftpStatus.status === 'down') {
    alertMessage += `❌ SFTP Status: DOWN (Port ${SFTP_PORT})\n`;
    alertMessage += `   Error: ${sftpStatus.error || 'SFTP connection failed'}\n`;
    if (sftpStatus.testFile?.downloadFailed) {
      alertMessage += `   Failed to download test file: ${sftpStatus.testFile.path}\n`;
    }
  }
  
  alertMessage += `\nTimestamp: ${new Date().toISOString()}\n`;
  alertMessage += `Server: ${NAS_HOST}\n`;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: 'NAS Monitor',
          email: ALERT_EMAIL_FROM
        },
        to: [{
          email: ALERT_EMAIL_TO
        }],
        subject: subject,
        textContent: alertMessage
      })
    });

    if (response.ok) {
      console.log('Alert email sent successfully');
    } else {
      console.error('Failed to send alert email:', await response.text());
    }
  } catch (error) {
    console.error('Error sending alert email:', error.message);
  }
}

async function shouldSendAlert(currentServerStatus, currentSftpStatus) {
  try {
    const [lastAlert, latestStatus] = await Promise.all([
      redis.get('nas:last_alert'),
      getLatestStatus()
    ]);
    
    const lastServerStatus = latestStatus ? { status: latestStatus.serverStatus } : null;
    const lastSftpStatus = latestStatus ? { status: latestStatus.sftpStatus } : null;
    
    // Send alert if:
    // 1. No previous alert sent, OR
    // 2. Status changed from up to down, OR  
    // 3. Last alert was more than 4 hours ago and still down
    
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - (4 * 60 * 60 * 1000));
    
    const statusChanged = (
      (lastServerStatus?.status === 'up' && currentServerStatus.status === 'down') ||
      (lastSftpStatus?.status === 'up' && currentSftpStatus.status === 'down')
    );
    
    const shouldAlert = (
      !lastAlert ||
      statusChanged ||
      (
        (currentServerStatus.status === 'down' || currentSftpStatus.status === 'down') &&
        new Date(lastAlert) < fourHoursAgo
      )
    );
    
    return shouldAlert;
  } catch (error) {
    console.error('Error checking alert conditions:', error);
    return false;
  }
}

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    console.log(`Starting NAS monitoring check for ${NAS_HOST}`);
    
    const [serverStatus, sftpStatus] = await Promise.all([
      checkServerStatus(),
      checkSftpStatus()
    ]);
    
    console.log('Server Status:', serverStatus);
    console.log('SFTP Status:', sftpStatus);
    
    await updateServerStatus(
      serverStatus.status === 'up' ? 'up' : 'down',
      sftpStatus.status === 'up' ? 'up' : 'down'
    );
    
    await Promise.all([
      redis.set('nas:server_details', JSON.stringify(serverStatus)),
      redis.set('nas:sftp_details', JSON.stringify(sftpStatus)),
      redis.set('nas:last_check', new Date().toISOString())
    ]);
    
    const needsAlert = await shouldSendAlert(serverStatus, sftpStatus);
    
    if (needsAlert && (serverStatus.status === 'down' || sftpStatus.status === 'down')) {
      console.log('Sending alert email...');
      await sendAlert(serverStatus, sftpStatus);
      await redis.set('nas:last_alert', new Date().toISOString());
    }
    
    const historyKey = `nas:history:${Date.now()}`;
    await redis.set(historyKey, JSON.stringify({
      server: serverStatus,
      sftp: sftpStatus,
      timestamp: new Date().toISOString()
    }));
    
    await redis.expire(historyKey, 24 * 60 * 60);
    
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        server: serverStatus,
        sftp: sftpStatus
      },
      alertSent: needsAlert && (serverStatus.status === 'down' || sftpStatus.status === 'down')
    });
    
  } catch (error) {
    console.error('Monitoring check failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export async function getStatus() {
  try {
    const [serverDetails, sftpDetails, lastCheck] = await Promise.all([
      redis.get('nas:server_details'),
      redis.get('nas:sftp_details'),
      redis.get('nas:last_check')
    ]);
    
    const serverStatus = serverDetails ? JSON.parse(serverDetails) : { status: 'unknown', timestamp: null };
    const sftpStatus = sftpDetails ? JSON.parse(sftpDetails) : { status: 'unknown', timestamp: null };
    
    return {
      server: serverStatus,
      sftp: sftpStatus,
      lastCheck: lastCheck,
    };
  } catch (error) {
    throw new Error(`Failed to get status: ${error.message}`);
  }
}