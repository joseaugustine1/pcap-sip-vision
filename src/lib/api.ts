// API Client to replace Supabase client

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_URL}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Authentication
  async signUp(email: string, password: string, displayName?: string) {
    const data = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    
    this.token = data.token;
    localStorage.setItem('auth_token', data.token);
    
    return { data: { user: data.user, session: { access_token: data.token } }, error: null };
  }

  async signIn(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    this.token = data.token;
    localStorage.setItem('auth_token', data.token);
    
    return { data: { user: data.user, session: { access_token: data.token } }, error: null };
  }

  async signOut() {
    this.token = null;
    localStorage.removeItem('auth_token');
    return { error: null };
  }

  async getUser() {
    try {
      const data = await this.request('/auth/user');
      return { data: { user: data.user }, error: null };
    } catch (error) {
      return { data: { user: null }, error };
    }
  }

  // Sessions
  async getSessions() {
    return this.request('/sessions');
  }

  async getSession(id: string) {
    return this.request(`/sessions/${id}`);
  }

  async createSession(name: string) {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteSession(id: string) {
    return this.request(`/sessions/${id}`, {
      method: 'DELETE',
    });
  }

  async getCallMetrics(sessionId: string) {
    return this.request(`/sessions/${sessionId}/metrics`);
  }

  async getSipMessages(sessionId: string) {
    return this.request(`/sessions/${sessionId}/sip-messages`);
  }

  async getIntervalMetrics(callId: string) {
    return this.request(`/sessions/call/${callId}/intervals`);
  }

  // PCAP Upload
  async uploadPcap(sessionId: string, files: File[]) {
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_URL}/pcap/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    return data;
  }

  // IP Lookup
  async lookupIp(ip: string) {
    return this.request('/ip-lookup', {
      method: 'POST',
      body: JSON.stringify({ ip }),
    });
  }

  // Auth state change subscription (compatibility with Supabase)
  onAuthStateChange(callback: (event: string, session: any) => void) {
    // Check initial state
    this.getUser().then(({ data }) => {
      if (data.user) {
        callback('SIGNED_IN', { user: data.user, access_token: this.token });
      } else {
        callback('SIGNED_OUT', null);
      }
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    };
  }
}

export const apiClient = new ApiClient();

// Export a Supabase-like interface for easier migration
export const auth = {
  signUp: (data: { email: string; password: string; options?: { data?: { displayName?: string } } }) =>
    apiClient.signUp(data.email, data.password, data.options?.data?.displayName),
  signInWithPassword: (data: { email: string; password: string }) =>
    apiClient.signIn(data.email, data.password),
  signOut: () => apiClient.signOut(),
  getUser: () => apiClient.getUser(),
  onAuthStateChange: (callback: (event: string, session: any) => void) =>
    apiClient.onAuthStateChange(callback),
};
