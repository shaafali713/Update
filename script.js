// API Configuration
const GOOGLE_CLIENT_ID = "844845318549-fsca3orahnk4emg5oi6a8b1fjcfsu4qi.apps.googleusercontent.com";
const YOUTUBE_API_KEY = "AIzaSyChm0thF6dU-MW-2_INOGRDwcfsn0mjO7E";
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtubepartner',
  'https://www.googleapis.com/auth/userinfo.profile'
];
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const SERVER_BASE_URL = 'http://localhost:3000'; // Change this in production

// DOM Elements
const videoGrid = document.getElementById("video-grid");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");
const uploadForm = document.getElementById("upload-form");
const videoFileInput = document.getElementById("video-file");
const videoTitleInput = document.getElementById("video-title");
const videoDescriptionInput = document.getElementById("video-description");
const videoPlayerModal = document.getElementById("video-player-modal");
const videoPlayer = document.getElementById("video-player");
const videoPlayerTitle = document.getElementById("video-player-title");
const videoPlayerDescription = document.getElementById("video-player-description");
const likeButton = document.getElementById("like-button");
const subscribeButton = document.getElementById("subscribe-button");
const subscriptionList = document.getElementById("subscription-list");
const watchHistory = document.getElementById("watch-history");
const likedVideos = document.getElementById("liked-videos");
const yourVideos = document.getElementById("your-videos");
const analyticsContainer = document.getElementById("analytics-container");
const darkModeToggle = document.getElementById("dark-mode-toggle");
const navButtons = document.querySelectorAll(".nav-button");
const channelConnectModal = document.getElementById("channel-connect-modal");
const profilePicture = document.getElementById("profile-picture");
const profileName = document.getElementById("profile-name");
const subscriberCount = document.getElementById("subscriber-count");
const videoCount = document.getElementById("video-count");
const viewCount = document.getElementById("view-count");
const edirearChannelUrl = document.getElementById("edirear-channel-url");

// State Management
let currentUser = null;
let youtubeAccessToken = null;
let currentChannel = null;
let currentVideo = null;

// Initialize the application
function init() {
  loadUserState();
  setupEventListeners();
  fetchTrendingVideos();
  initializeAuth();
  handleOAuthCallback();
}

// Load user state from localStorage
function loadUserState() {
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('youtube_access_token');
  
  if (user) {
    currentUser = JSON.parse(user);
  }
  
  if (token) {
    youtubeAccessToken = token;
    fetchYouTubeChannelInfo();
  }
}

// Setup event listeners
function setupEventListeners() {
  // Navigation
  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const pageId = button.getAttribute('data-page');
      document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
      });
      document.getElementById(pageId).classList.add('active');
    });
  });
  
  // Search
  searchButton.addEventListener('click', handleSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  
  // Video Upload
  uploadForm.addEventListener('submit', handleVideoUpload);
  
  // Dark Mode Toggle
  darkModeToggle.addEventListener('click', toggleDarkMode);
  
  // Modal Close Buttons
  document.querySelectorAll('.close-modal').forEach(button => {
    button.addEventListener('click', () => {
      const modalId = button.getAttribute('data-modal');
      document.getElementById(modalId).style.display = 'none';
      if (modalId === 'video-player-modal') {
        videoPlayer.src = '';
      }
    });
  });
  
  // Like Button
  likeButton.addEventListener('click', handleLikeVideo);
  
  // Subscribe Button
  subscribeButton.addEventListener('click', handleSubscribe);
}

// Initialize authentication
function initializeAuth() {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleLogin,
  });
  
  google.accounts.id.renderButton(
    document.getElementById("google-login-button"), 
    { theme: "outline", size: "large" }
  );
  
  checkYouTubeConnection();
}

// Handle Google Login
function handleGoogleLogin(response) {
  const credential = response.credential;
  const userInfo = JSON.parse(atob(credential.split('.')[1]));
  
  currentUser = userInfo;
  localStorage.setItem('user', JSON.stringify(userInfo));
  
  showChannelConnectModal();
  
  console.log('User logged in:', userInfo.name);
}

// Check YouTube connection status
function checkYouTubeConnection() {
  if (currentUser && !youtubeAccessToken) {
    showChannelConnectModal();
  }
}

// Show channel connection modal
function showChannelConnectModal() {
  document.getElementById('youtube-connect-button').innerHTML = `
    <button id="connect-youtube-btn" class="auth-button">Connect YouTube Channel</button>
  `;
  document.getElementById('connect-youtube-btn').addEventListener('click', handleYouTubeConnect);
  channelConnectModal.style.display = 'block';
}

// Handle YouTube connection
async function handleYouTubeConnect() {
  try {
    // Get authorization URL from server
    const response = await fetch(`${SERVER_BASE_URL}/auth/url`);
    const { url } = await response.json();
    
    // Redirect to Google OAuth
    window.location.href = url;
  } catch (error) {
    console.error('Error initiating YouTube connection:', error);
    alert('Failed to connect YouTube channel. Please try again.');
  }
}

// Handle OAuth callback
async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  
  if (code) {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/auth/callback?code=${code}`);
      const { access_token, refresh_token } = await response.json();
      
      // Store tokens
      localStorage.setItem('youtube_access_token', access_token);
      if (refresh_token) {
        localStorage.setItem('youtube_refresh_token', refresh_token);
      }
      
      youtubeAccessToken = access_token;
      
      // Fetch channel info
      await fetchYouTubeChannelInfo();
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Close the modal
      channelConnectModal.style.display = 'none';
    } catch (error) {
      console.error('Error completing OAuth flow:', error);
      alert('Failed to complete YouTube connection. Please try again.');
    }
  }
}

// Fetch YouTube channel info
async function fetchYouTubeChannelInfo() {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/api/youtube/channels?part=snippet,statistics&mine=true`);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      currentChannel = data.items[0];
      displayChannelInfo(currentChannel);
      generateEdirearChannelUrl(currentChannel);
      fetchUserYouTubeData();
    }
  } catch (error) {
    console.error('Error fetching channel info:', error);
  }
}

// Display channel info
function displayChannelInfo(channel) {
  profilePicture.src = channel.snippet.thumbnails.default.url;
  profileName.textContent = channel.snippet.title;
  subscriberCount.textContent = `${numberWithCommas(channel.statistics.subscriberCount)} subscribers`;
  videoCount.textContent = `${numberWithCommas(channel.statistics.videoCount)} videos`;
  viewCount.textContent = `${numberWithCommas(channel.statistics.viewCount)} views`;
  
  // Update channel info in modal
  const channelDetails = document.getElementById('channel-details');
  channelDetails.innerHTML = `
    <p><strong>Channel:</strong> ${channel.snippet.title}</p>
    <p><strong>Subscribers:</strong> ${numberWithCommas(channel.statistics.subscriberCount)}</p>
    <p><strong>Videos:</strong> ${numberWithCommas(channel.statistics.videoCount)}</p>
    <p><strong>Views:</strong> ${numberWithCommas(channel.statistics.viewCount)}</p>
  `;
  
  document.getElementById('channel-info').style.display = 'block';
}

// Generate Edirear channel URL
function generateEdirearChannelUrl(channel) {
  const channelName = channel.snippet.title.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const channelUrl = `${window.location.origin}/channel/${channelName}`;
  edirearChannelUrl.textContent = channelUrl;
  edirearChannelUrl.href = channelUrl;
  localStorage.setItem('edirear_channel_url', channelUrl);
}

// Fetch user's YouTube data
async function fetchUserYouTubeData() {
  try {
    // Get subscriptions
    const subsResponse = await fetch(`${SERVER_BASE_URL}/api/youtube/subscriptions?part=snippet&mine=true&maxResults=50`);
    const subsData = await subsResponse.json();
    displaySubscriptions(subsData.items);
    
    // Get watch history
    const historyResponse = await fetch(`${SERVER_BASE_URL}/api/youtube/activities?part=snippet,contentDetails&mine=true&maxResults=50`);
    const historyData = await historyResponse.json();
    displayWatchHistory(historyData.items);
    
    // Get liked videos
    const likedResponse = await fetch(`${SERVER_BASE_URL}/api/youtube/videos?part=snippet&myRating=like&maxResults=50`);
    const likedData = await likedResponse.json();
    displayLikedVideos(likedData.items);
    
    // Get user's uploaded videos
    const videosResponse = await fetch(`${SERVER_BASE_URL}/api/youtube/search?part=snippet&type=video&forMine=true&maxResults=50`);
    const videosData = await videosResponse.json();
    displayYourVideos(videosData.items);
  } catch (error) {
    console.error('Error fetching user YouTube data:', error);
  }
}

// Display subscriptions
function displaySubscriptions(subscriptions) {
  subscriptionList.innerHTML = '';
  
  subscriptions.forEach(sub => {
    const subItem = document.createElement('div');
    subItem.className = 'subscription-item';
    subItem.innerHTML = `
      <img src="${sub.snippet.thumbnails.default.url}" alt="${sub.snippet.title}">
      <h4>${sub.snippet.title}</h4>
    `;
    subscriptionList.appendChild(subItem);
  });
}

// Display watch history
function displayWatchHistory(history) {
  watchHistory.innerHTML = '';
  
  history.forEach(item => {
    if (item.contentDetails.upload) {
      const videoId = item.contentDetails.upload.videoId;
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.innerHTML = `
        <img src="${item.snippet.thumbnails.default.url}" alt="${item.snippet.title}">
        <h4>${item.snippet.title}</h4>
      `;
      historyItem.addEventListener('click', () => {
        openVideoPlayer(videoId, item.snippet.title, item.snippet.description);
      });
      watchHistory.appendChild(historyItem);
    }
  });
}

// Display liked videos
function displayLikedVideos(videos) {
  likedVideos.innerHTML = '';
  
  videos.forEach(video => {
    const likedItem = document.createElement('div');
    likedItem.className = 'liked-item';
    likedItem.innerHTML = `
      <img src="${video.snippet.thumbnails.default.url}" alt="${video.snippet.title}">
      <h4>${video.snippet.title}</h4>
    `;
    likedItem.addEventListener('click', () => {
      openVideoPlayer(video.id, video.snippet.title, video.snippet.description);
    });
    likedVideos.appendChild(likedItem);
  });
}

// Display user's videos
function displayYourVideos(videos) {
  yourVideos.innerHTML = '';
  
  videos.forEach(video => {
    const videoItem = document.createElement('div');
    videoItem.className = 'your-video-item';
    videoItem.innerHTML = `
      <img src="${video.snippet.thumbnails.default.url}" alt="${video.snippet.title}">
      <h4>${video.snippet.title}</h4>
    `;
    videoItem.addEventListener('click', () => {
      openVideoPlayer(video.id.videoId, video.snippet.title, video.snippet.description);
    });
    yourVideos.appendChild(videoItem);
  });
}

// Handle search
function handleSearch() {
  const query = searchInput.value.trim();
  if (query) {
    searchVideos(query);
  }
}

// Search videos
async function searchVideos(query) {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/api/youtube/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=20`);
    const data = await response.json();
    displayVideos(data.items);
  } catch (error) {
    console.error('Error searching videos:', error);
  }
}

// Fetch trending videos
async function fetchTrendingVideos() {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/api/youtube/videos?part=snippet&chart=mostPopular&maxResults=20`);
    const data = await response.json();
    displayVideos(data.items);
  } catch (error) {
    console.error('Error fetching trending videos:', error);
  }
}

// Display videos
function displayVideos(videos) {
  videoGrid.innerHTML = '';
  
  videos.forEach(video => {
    const videoId = video.id.videoId || video.id;
    const videoCard = document.createElement('div');
    videoCard.className = 'video-card';
    videoCard.innerHTML = `
      <img src="${video.snippet.thumbnails.medium.url}" alt="${video.snippet.title}">
      <h3>${video.snippet.title}</h3>
    `;
    videoCard.addEventListener('click', () => {
      openVideoPlayer(videoId, video.snippet.title, video.snippet.description);
      currentVideo = video;
    });
    videoGrid.appendChild(videoCard);
  });
}

// Open video player
function openVideoPlayer(videoId, title, description) {
  videoPlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  videoPlayerTitle.textContent = title;
  videoPlayerDescription.textContent = description;
  videoPlayerModal.style.display = 'block';
  
  // Fetch analytics for the video
  fetchVideoAnalytics(videoId);
}

// Fetch video analytics
async function fetchVideoAnalytics(videoId) {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/api/youtube/videos?part=statistics&id=${videoId}`);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      displayVideoAnalytics(data.items[0].statistics);
    }
  } catch (error) {
    console.error('Error fetching video analytics:', error);
  }
}

// Display video analytics
function displayVideoAnalytics(statistics) {
  analyticsContainer.innerHTML = `
    <h3>Video Analytics</h3>
    <p>Views: ${numberWithCommas(statistics.viewCount)}</p>
    <p>Likes: ${numberWithCommas(statistics.likeCount)}</p>
    <p>Comments: ${numberWithCommas(statistics.commentCount)}</p>
  `;
}

// Handle video upload
async function handleVideoUpload(e) {
  e.preventDefault();
  
  const file = videoFileInput.files[0];
  const title = videoTitleInput.value;
  const description = videoDescriptionInput.value;
  
  if (!youtubeAccessToken) {
    alert('Please connect your YouTube channel first');
    return;
  }
  
  if (!file || !title || !description) {
    alert('Please fill all fields');
    return;
  }
  
  try {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    formData.append('description', description);
    
    const response = await fetch(`${SERVER_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${youtubeAccessToken}`
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('Video uploaded successfully to your YouTube channel!');
      uploadForm.reset();
      fetchUserYouTubeData(); // Refresh user's videos
    } else {
      alert('Failed to upload video: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error uploading video:', error);
    alert('Failed to upload video. Please try again.');
  }
}

// Handle like video
async function handleLikeVideo() {
  if (!currentVideo || !youtubeAccessToken) return;
  
  try {
    const videoId = currentVideo.id.videoId || currentVideo.id;
    const response = await fetch(`${SERVER_BASE_URL}/api/youtube/videos/rate?id=${videoId}&rating=like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${youtubeAccessToken}`
      }
    });
    
    if (response.ok) {
      alert('Video liked successfully!');
      fetchUserYouTubeData(); // Refresh liked videos
    } else {
      alert('Failed to like video');
    }
  } catch (error) {
    console.error('Error liking video:', error);
  }
}

// Handle subscribe
async function handleSubscribe() {
  if (!currentVideo || !youtubeAccessToken) return;
  
  try {
    const channelId = currentVideo.snippet.channelId;
    const response = await fetch(`${SERVER_BASE_URL}/api/youtube/subscriptions?part=snippet`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${youtubeAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        snippet: {
          resourceId: {
            channelId: channelId
          }
        }
      })
    });
    
    if (response.ok) {
      alert('Subscribed successfully!');
      fetchUserYouTubeData(); // Refresh subscriptions
    } else {
      alert('Failed to subscribe');
    }
  } catch (error) {
    console.error('Error subscribing:', error);
  }
}

// Toggle dark mode
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDarkMode = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDarkMode);
}

// Check for saved dark mode preference
function checkDarkModePreference() {
  const darkMode = localStorage.getItem('darkMode') === 'true';
  if (darkMode) {
    document.body.classList.add('dark-mode');
  }
}

// Format numbers with commas
function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  checkDarkModePreference();
  init();
});
// [Previous code remains the same until the search and fetch functions]

// Improved search functionality
async function searchVideos(query) {
  try {
    const response = await fetch(`${YOUTUBE_API_BASE}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=20&key=${YOUTUBE_API_KEY}`);
    const data = await response.json();
    
    // Extract video IDs from search results
    const videoIds = data.items.map(item => item.id.videoId).join(',');
    
    // Get detailed video information
    const videosResponse = await fetch(`${YOUTUBE_API_BASE}/videos?part=snippet,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
    const videosData = await videosResponse.json();
    
    displayVideos(videosData.items);
  } catch (error) {
    console.error('Error searching videos:', error);
    alert('Failed to search videos. Please try again.');
  }
}

// Improved home page trending videos
async function fetchTrendingVideos() {
  try {
    // Get trending videos for the user's region
    const response = await fetch(`${YOUTUBE_API_BASE}/videos?part=snippet,statistics&chart=mostPopular&maxResults=20&regionCode=US&key=${YOUTUBE_API_KEY}`);
    const data = await response.json();
    
    displayVideos(data.items);
  } catch (error) {
    console.error('Error fetching trending videos:', error);
    // Fallback to default videos if region-specific fails
    fetchDefaultVideos();
  }
}

// Fallback for trending videos
async function fetchDefaultVideos() {
  try {
    const response = await fetch(`${YOUTUBE_API_BASE}/videos?part=snippet,statistics&chart=mostPopular&maxResults=20&key=${YOUTUBE_API_KEY}`);
    const data = await response.json();
    
    displayVideos(data.items);
  } catch (error) {
    console.error('Error fetching default videos:', error);
    videoGrid.innerHTML = '<p>Failed to load videos. Please try again later.</p>';
  }
}

// Enhanced video display
function displayVideos(videos) {
  videoGrid.innerHTML = '';
  
  if (!videos || videos.length === 0) {
    videoGrid.innerHTML = '<p>No videos found. Try a different search.</p>';
    return;
  }
  
  videos.forEach(video => {
    const videoCard = document.createElement('div');
    videoCard.className = 'video-card';
    videoCard.innerHTML = `
      <img src="${video.snippet.thumbnails.medium.url}" alt="${video.snippet.title}">
      <div class="video-info">
        <h3>${video.snippet.title}</h3>
        <p class="channel-name">${video.snippet.channelTitle}</p>
        <div class="video-stats">
          <span>${formatViewCount(video.statistics.viewCount)} views</span>
          <span>•</span>
          <span>${formatTimeAgo(video.snippet.publishedAt)}</span>
        </div>
      </div>
    `;
    videoCard.addEventListener('click', () => {
      openVideoPlayer(video.id, video.snippet.title, video.snippet.description);
      currentVideo = video;
    });
    videoGrid.appendChild(videoCard);
  });
}

// Helper function to format view count
function formatViewCount(count) {
  if (!count) return '0 views';
  const num = parseInt(count);
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M views';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K views';
  }
  return num + ' views';
}

// Helper function to format time ago
function formatTimeAgo(publishedAt) {
  const publishedDate = new Date(publishedAt);
  const currentDate = new Date();
  const diffInSeconds = Math.floor((currentDate - publishedDate) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return Math.floor(diffInSeconds / 60) + ' minutes ago';
  if (diffInSeconds < 86400) return Math.floor(diffInSeconds / 3600) + ' hours ago';
  if (diffInSeconds < 2592000) return Math.floor(diffInSeconds / 86400) + ' days ago';
  if (diffInSeconds < 31536000) return Math.floor(diffInSeconds / 2592000) + ' months ago';
  return Math.floor(diffInSeconds / 31536000) + ' years ago';
}

// [Rest of your existing code remains the same]// =============================================
// ADVERTISEMENT IMPLEMENTATION (FULL SOLUTION)
// =============================================

// Ad configuration
const AD_CONFIG = {
    inFeedFrequency: 5, // Show ad after every 5 videos
    adScriptUrl: '//www.highperformanceformat.com/35a74394292de1223448a7b78d8a1944/invoke.js',
    adOptions: {
        'key': '35a74394292de1223448a7b78d8a1944',
        'format': 'iframe',
        'height': 250,
        'width': 300,
        'params': {}
    }
};

// Initialize all ads
function initializeAllAds() {
    // Create video player ad container if it doesn't exist
    if (!document.getElementById('video-player-ad')) {
        const adContainer = document.createElement('div');
        adContainer.id = 'video-player-ad';
        adContainer.className = 'video-ad-container';
        
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) {
            const videoDetails = document.querySelector('.video-details');
            if (videoDetails) {
                modalContent.insertBefore(adContainer, videoDetails);
            } else {
                modalContent.appendChild(adContainer);
            }
        }
    }
    
    // Load the ad script for video player
    loadAdScript('video-player-ad');
}

// Load ad script into a container
function loadAdScript(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create script element with ad options
    const configScript = document.createElement('script');
    configScript.type = 'text/javascript';
    configScript.text = `atOptions = ${JSON.stringify(AD_CONFIG.adOptions)};`;
    container.appendChild(configScript);
    
    // Create script element to load the ad
    const adScript = document.createElement('script');
    adScript.type = 'text/javascript';
    adScript.src = AD_CONFIG.adScriptUrl;
    
    // Add slight delay to ensure config is processed
    setTimeout(() => {
        container.appendChild(adScript);
    }, 50);
}

// Create an in-feed ad unit
function createInFeedAd() {
    const adContainer = document.createElement('div');
    adContainer.className = 'in-feed-ad';
    
    // Create unique ID for each ad container
    const adId = 'ad-' + Math.random().toString(36).substr(2, 9);
    adContainer.id = adId;
    
    // Load the ad script after a slight delay
    setTimeout(() => {
        loadAdScript(adId);
    }, 100);
    
    return adContainer;
}

// Modified displayVideos function with ads
function displayVideosWithAds(videos, containerId = 'video-grid') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!videos || videos.length === 0) {
        container.innerHTML = '<p>No videos found</p>';
        return;
    }
    
    videos.forEach((video, index) => {
        // Show ad after every X videos (except first position)
        if (index > 0 && index % AD_CONFIG.inFeedFrequency === 0) {
            container.appendChild(createInFeedAd());
        }
        
        // Create and append video card
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        videoCard.innerHTML = `
            <img src="${video.snippet.thumbnails.medium.url}" alt="${video.snippet.title}">
            <div class="video-info">
                <h3>${video.snippet.title}</h3>
                <p class="channel-name">${video.snippet.channelTitle}</p>
                <div class="video-stats">
                    <span>${formatViewCount(video.statistics?.viewCount)} views</span>
                    <span>•</span>
                    <span>${formatTimeAgo(video.snippet.publishedAt)}</span>
                </div>
            </div>
        `;
        videoCard.addEventListener('click', () => {
            openVideoPlayerWithAd(video.id.videoId || video.id, video.snippet.title, video.snippet.description);
        });
        container.appendChild(videoCard);
    });
}

// Modified video player function with ad
function openVideoPlayerWithAd(videoId, title, description) {
    const videoPlayer = document.getElementById('video-player');
    const videoPlayerTitle = document.getElementById('video-player-title');
    const videoPlayerDescription = document.getElementById('video-player-description');
    const videoPlayerModal = document.getElementById('video-player-modal');
    
    if (videoPlayer && videoPlayerTitle && videoPlayerDescription && videoPlayerModal) {
        videoPlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        videoPlayerTitle.textContent = title;
        videoPlayerDescription.textContent = description;
        
        // Show the video player ad
        const adContainer = document.getElementById('video-player-ad');
        if (adContainer) {
            adContainer.style.display = 'block';
            // Refresh the ad when opening a new video
            loadAdScript('video-player-ad');
        }
        
        videoPlayerModal.style.display = 'block';
    }
}

// Helper functions
function formatViewCount(count) {
    if (!count) return '0 views';
    const num = parseInt(count);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M views';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K views';
    return num + ' views';
}

function formatTimeAgo(publishedAt) {
    const publishedDate = new Date(publishedAt);
    const currentDate = new Date();
    const diffInSeconds = Math.floor((currentDate - publishedDate) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return Math.floor(diffInSeconds / 60) + 'm ago';
    if (diffInSeconds < 86400) return Math.floor(diffInSeconds / 3600) + 'h ago';
    if (diffInSeconds < 2592000) return Math.floor(diffInSeconds / 86400) + 'd ago';
    if (diffInSeconds < 31536000) return Math.floor(diffInSeconds / 2592000) + 'mo ago';
    return Math.floor(diffInSeconds / 31536000) + 'yr ago';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeAllAds();
    
    // Replace your existing displayVideos and openVideoPlayer functions
    window.displayVideos = displayVideosWithAds;
    window.openVideoPlayer = openVideoPlayerWithAd;
});

// =============================================
// INTEGRATION INSTRUCTIONS
// =============================================

/*
1. Add this ENTIRE code to your existing JavaScript file
2. Make sure you have these CSS classes in your stylesheet:
   .video-ad-container, .in-feed-ad
3. The code will automatically:
   - Replace your displayVideos function
   - Replace your openVideoPlayer function
   - Initialize all ad containers
4. Ads will now appear:
   - After every 5 videos in your feed
   - Below the video player when watching videos
*/
const API_KEY = "AIzaSyAMBF1xeNkSJgbgbFh_MG1UKIdX1zBm8y4"; // Replace with your actual API key
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const exitBtn = document.getElementById("exit-btn");

// Display Welcome Message
appendMessage("bot", "Welcome to Edirear Assistant! Ask me anything.");

// Event Listeners
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
exitBtn.addEventListener("click", () => {
  window.history.back(); // Go back to the previous page
});

// Send Message Function
function sendMessage() {
  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  appendMessage("user", userMessage);
  userInput.value = "";

  const loadingMessage = appendMessage("bot", "Edirear Assistant is typing...");

  fetch(`${API_URL}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }] }),
  })
    .then((response) => response.json())
    .then((data) => {
      chatBox.removeChild(loadingMessage);
      const botMessage = data.candidates[0].content.parts[0].text;
      appendMessage("bot", botMessage);
    })
    .catch((error) => {
      chatBox.removeChild(loadingMessage);
      console.error("Error:", error);
      appendMessage("bot", "Sorry, something went wrong.");
    });
}

// Append Message Function
function appendMessage(sender, message) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", sender);
  messageElement.innerHTML = `<p>${message}</p>`;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
  return messageElement;
}