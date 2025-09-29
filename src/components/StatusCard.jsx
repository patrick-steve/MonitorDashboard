import './StatusCard.css'

function StatusCard({ 
  serverStatus = 'ONLINE', 
  ftpStatus = 'ONLINE', 
  imageSrc = '/up.png',
  lastChecked = new Date().toLocaleString(),
  onClick
}) {

  const hasOfflineStatus = serverStatus.toLowerCase() === 'offline' || ftpStatus.toLowerCase() === 'offline';

  const handleCardClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (onClick) {
      onClick();
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return date.toLocaleString();
  };

  return (
    <div className={`status ${hasOfflineStatus ? 'status-offline' : 'status-online'}`} onClick={handleCardClick}>
      <div className="status-content">
        <div className="status-image">
          <img src={imageSrc} alt="Status indicator" />
        </div>
        <div className="status-info">
          <div className="status-text">
            <h2 className='status-title'>
              Server Status: <span className={`status-indicator ${serverStatus.toLowerCase()}`}>{serverStatus}</span>
            </h2>
            <p className='status-title'>
              FTP connection: <span className={`status-indicator ${ftpStatus.toLowerCase()}`}>{ftpStatus}</span>
            </p>
          </div>
          <div className="last-checked">
            <p className='last-checked-text'>Last checked on: {formatTime(lastChecked)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatusCard