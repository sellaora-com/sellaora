import { useEffect, useState } from 'react';
import { storeAPI } from '../../utils/api';

const PUBLISHING_STEPS = [
  'Preparing your storefront',
  'Building optimized assets',
  'Deploying your site',
  'Finalizing your live URL',
];

const PublishButton = ({ storeId, jsonLayout, onPublishSuccess, onPublishError }) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isPublishing) {
      setCurrentStep(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCurrentStep((step) => (step + 1) % PUBLISHING_STEPS.length);
    }, 1800);

    return () => window.clearInterval(intervalId);
  }, [isPublishing]);
  
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
      {isPublishing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/88 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-neutral-800 bg-neutral-900/95 p-8 text-neutral-100 shadow-2xl shadow-black/40">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
                <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-300/80">
                  Publishing
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  Your site is going live
                </h2>
              </div>
            </div>

            <p className="text-sm leading-6 text-neutral-300">
              We&apos;re packaging your storefront, deploying it, and preparing the live URL. This can take a little time, so keep this tab open.
            </p>

            <div className="mt-6 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${((currentStep + 1) / PUBLISHING_STEPS.length) * 100}%` }}
              />
            </div>

            <div className="mt-6 space-y-3">
              {PUBLISHING_STEPS.map((step, index) => {
                const isActive = index === currentStep;
                const isComplete = index < currentStep;

                return (
                  <div
                    key={step}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                      isActive
                        ? 'border-blue-500/40 bg-blue-500/10 text-white'
                        : isComplete
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-neutral-100'
                          : 'border-neutral-800 bg-neutral-950/40 text-neutral-400'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                        isActive
                          ? 'bg-blue-400/20 text-blue-200'
                          : isComplete
                            ? 'bg-emerald-400/20 text-emerald-200'
                            : 'bg-neutral-800 text-neutral-500'
                      }`}
                    >
                      {isComplete ? '✓' : index + 1}
                    </div>
                    <span className="text-sm font-medium">{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
