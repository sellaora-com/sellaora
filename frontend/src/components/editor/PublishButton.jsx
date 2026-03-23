import { useState } from 'react';
import { storeAPI } from '../../utils/api';

const PublishButton = ({ storeId, jsonLayout, onPublishSuccess, onPublishError }) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const handlePublish = async () => {
    if (!storeId) {
      onPublishError?.('Store ID not found. Please save your store first.');
      return;
    }
    
    setIsPublishing(true);
    try {
      const data = await storeAPI.publishStore(storeId, jsonLayout);
      
      setPublishedUrl(data.data.url);
      setShowSuccess(true);
      onPublishSuccess?.(data.data);
      
      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccess(false), 5000);
      
    } catch (error) {
      console.error('Publishing failed:', error);
      
      let errorMessage = error.message;
      
      // Provide more user-friendly error messages
      if (error.message.includes('Store layout not found')) {
        errorMessage = 'Please save your store design first, then try publishing again.';
      } else if (error.message.includes('invalid_project_name')) {
        errorMessage = 'There was an issue with your store name format. Please try again.';
      } else if (error.message.includes('VERCEL_TOKEN')) {
        errorMessage = 'Publishing service is temporarily unavailable. Please contact support.';
      } else if (error.message.includes('Build failed')) {
        errorMessage = 'There was an issue building your store. Please check your design and try again.';
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Connection error. Please check your internet connection and try again.';
      }
      
      onPublishError?.(errorMessage);
    } finally {
      setIsPublishing(false);
    }
  };
  
  const copyUrl = () => {
    if (publishedUrl) {
      navigator.clipboard.writeText(publishedUrl);
      // You could add a toast notification here
      alert('URL copied to clipboard!');
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePublish}
        disabled={isPublishing}
        className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
          isPublishing
            ? 'bg-blue-400 text-white cursor-wait'
            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
        }`}
        title="Publish your store to Vercel"
      >
        {isPublishing ? (
          <>
            <span className="animate-spin">🔄</span>
            Publishing...
          </>
        ) : (
          <>
            <span>🚀</span>
            Publish
          </>
        )}
      </button>
      
      {/* Success message */}
      {showSuccess && publishedUrl && (
        <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-50 max-w-md">
          <div className="flex">
            <div className="flex-1">
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✅</span>
                <strong className="font-medium">Store Published Successfully!</strong>
              </div>
              <div className="mt-2">
                <p className="text-sm">Your store is now live at:</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-green-50 px-2 py-1 rounded text-xs break-all">
                    {publishedUrl}
                  </code>
                  <button
                    onClick={copyUrl}
                    className="text-green-600 hover:text-green-800 text-xs"
                    title="Copy URL"
                  >
                    📋
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-800 text-sm font-medium"
                  >
                    View Site →
                  </a>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="ml-4 text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishButton;
