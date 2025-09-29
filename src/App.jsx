import './App.css'
import { useState, useEffect } from 'react'
import StatusCard from './components/StatusCard'

import LoadingGif from '/loading.gif'

function App() {
  const [serverStatus, setServerStatus] = useState('OFFLINE');
  const [ftpStatus, setFtpStatus] = useState('OFFLINE');
  const [lastChecked, setLastChecked] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      console.log('Fetched status data:', data);
      if (data.success) {
        setServerStatus(data.serverStatus == 'up' ? 'ONLINE' : 'OFFLINE');
        setFtpStatus(data.sftpStatus == 'up' ? 'ONLINE' : 'OFFLINE');
        setLastChecked(data.lastCheck ? new Date(data.lastCheck).toLocaleString() : 'N/A');
      } else {
        setServerStatus('OFFLINE');
        setFtpStatus('OFFLINE');
        setLastChecked('N/A');
      }

    } catch (error) {
      console.error('Error fetching status:', error);
      setServerStatus('OFFLINE');
      setFtpStatus('OFFLINE');
      setLastChecked('N/A');  
    }
    finally {
      setLoading(false);
    }
  }

  const updateDB = async () => {
    console.log('Updating DB...');
    setLoading(true);

    try {
      console.log('Calling the serverless function ');
      const response = await fetch('/api/nas-status', { method: 'POST' });
      const data = await response.json();
      console.log('Update DB response:', data);

      if(response.ok && data.success) {
        console.log('DB updated successfully');
        await fetchStatus();
      }
    }
    catch (error) {
      console.log('Error updating DB:', error);
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="mainContainer">
        <header className='main-header'>
          <img src='/logo.png' className='main-logo'/>
          <h1 className='header-title'>NAS Server Monitor</h1>
        </header>
        
        {!loading && (
          <p className='refresh-instruction'>Click on the status card to refresh server status</p>
        )}
        
        { !loading ?
        <StatusCard 
          serverStatus={serverStatus} 
          ftpStatus={ftpStatus} 
          lastChecked={lastChecked}
          imageSrc={ (serverStatus === 'ONLINE' && ftpStatus === 'ONLINE') ? "/up.png" : "/down.png" } 
          onClick={updateDB}
        />
        : <div className='loading'>
          <img src={LoadingGif} alt="Loading..." />
        </div> }
      </div>
    </>
  )
}

export default App
