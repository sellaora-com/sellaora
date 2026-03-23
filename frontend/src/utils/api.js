const API_BASE_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:3001/api').replace(/\/+$/, '');

console.log('API Base URL:', API_BASE_URL);

export const getApiBaseUrl = () => API_BASE_URL;

// Helper function to get auth token
export const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Helper function to set auth token
export const setAuthToken = (token) => {
  localStorage.setItem('token', token);
};

// Helper function to remove auth token
export const removeAuthToken = () => {
  localStorage.removeItem('token');
};

// Helper function to make authenticated requests
const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = getAuthToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_BASE_URL}${url}`, config);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(errorData.message || 'Request failed');
  }

  return response.json();
};

// Auth API functions
export const authAPI = {
  register: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const responseText = await response.text();
    console.log('Registration response:', responseText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        throw new Error('Registration failed: ' + (responseText || 'No response from server'));
      }
      throw new Error(errorData.message || 'Registration failed');
    }

    try {
      return responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      throw new Error('Invalid response from server');
    }
  },

  login: async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Login failed');
    }

    return response.json();
  },

  getCurrentUser: async () => {
    return makeAuthenticatedRequest('/auth/me');
  },
};

// Store API functions
export const storeAPI = {
  createStore: async (storeData) => {
    return makeAuthenticatedRequest('/store', {
      method: 'POST',
      body: JSON.stringify(storeData),
    });
  },

  getUserStores: async () => {
    return makeAuthenticatedRequest('/store');
  },

  getStoreById: async (storeId) => {
    return makeAuthenticatedRequest(`/store/${storeId}`);
  },

  updateStore: async (storeId, updateData) => {
    return makeAuthenticatedRequest(`/store/${storeId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  deleteStore: async (storeId) => {
    return makeAuthenticatedRequest(`/store/${storeId}`, {
      method: 'DELETE',
    });
  },
  sendAIPrompt: async (storeId, prompt) => {
    return makeAuthenticatedRequest(`/store/${storeId}/ai-prompt`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },
  approveStore: async (storeId) => {
    return makeAuthenticatedRequest(`/store/${storeId}/approve`, {
      method: 'PUT',
    });
  },
  chooseTheme: async (storeId, themeId) => {
    return makeAuthenticatedRequest(`/store/themes/choose`, {
      method: 'POST',
      body: JSON.stringify({ storeId, themeId }),
    });
  },
  getEditorData: async (storeId) => {
    return makeAuthenticatedRequest(`/store/${storeId}/editor`);
  },
  saveEditorUpdate: async (storeId, payload) => {
    return makeAuthenticatedRequest(`/store/${storeId}/editor-update`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  publishStore: async (storeId, jsonLayout) => {
    return makeAuthenticatedRequest(`/store/${storeId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ jsonLayout }),
    });
  },
};

// Product API functions
export const productAPI = {
  create: async (productData) => {
    return makeAuthenticatedRequest('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  listByStore: async (storeId, params = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
    const query = new URLSearchParams(clean).toString();
    const qs = query ? `?${query}` : '';
    return makeAuthenticatedRequest(`/products/${storeId}${qs}`);
  },

  getById: async (id) => {
    return makeAuthenticatedRequest(`/products/item/${id}`);
  },

  update: async (id, updateData) => {
    return makeAuthenticatedRequest(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  remove: async (id) => {
    return makeAuthenticatedRequest(`/products/${id}`, {
      method: 'DELETE',
    });
  },
  bulkAction: async (action, ids) => {
    return makeAuthenticatedRequest('/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ action, ids }),
    });
  },
};

// Team API functions
export const teamAPI = {
  createTeam: async (name) => {
    return makeAuthenticatedRequest('/teams', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  myTeams: async () => {
    return makeAuthenticatedRequest('/teams/my');
  },
  getTeam: async (teamId) => {
    return makeAuthenticatedRequest(`/teams/${teamId}`);
  },
  updateTeam: async (teamId, payload) => {
    return makeAuthenticatedRequest(`/teams/${teamId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  listMembers: async (teamId) => {
    return makeAuthenticatedRequest(`/teams/${teamId}/members`);
  },
  invite: async (teamId, { email, role }) => {
    return makeAuthenticatedRequest(`/teams/${teamId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  },
  acceptInvite: async (token) => {
    return makeAuthenticatedRequest('/teams/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
  updateMember: async (teamId, userId, payload) => {
    return makeAuthenticatedRequest(`/teams/${teamId}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  removeMember: async (teamId, userId) => {
    return makeAuthenticatedRequest(`/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    });
  },
};


// Image upload API functions
export const uploadAPI = {
  uploadImages: async (files) => {
    const formData = new FormData();
    
    // Add multiple files to FormData
    if (Array.isArray(files)) {
      files.forEach(file => {
        formData.append('images', file);
      });
    } else {
      formData.append('images', files);
    }

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/upload/images`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
        // Don't set Content-Type for FormData, let browser handle it
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(errorData.message || 'Upload failed');
    }
    
    return response.json();
  },
  
  uploadSingleImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/upload/single-image`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(errorData.message || 'Upload failed');
    }
    
    return response.json();
  },
  
  deleteImages: async (imageUrls = [], publicIds = []) => {
    return makeAuthenticatedRequest('/upload/images', {
      method: 'DELETE',
      body: JSON.stringify({ imageUrls, publicIds }),
    });
  },
  
  checkHealth: async () => {
    const response = await fetch(`${API_BASE_URL}/upload/health`);
    if (!response.ok) {
      throw new Error('Health check failed');
    }
    return response.json();
  },
};

export default { authAPI, storeAPI, productAPI, uploadAPI, teamAPI };
