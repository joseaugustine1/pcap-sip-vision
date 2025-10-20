// src/lib/api.ts
// API Client to replace Supabase client

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

class ApiClient {
  private authCallbacks: Array<(event: string, session: any) => void> = [];

  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data;
  }

  // ---------------- AUTH ----------------
  async signUp(email: string, password: string, displayName?: string) {
    const data = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    localStorage.setItem('auth_token', data.token);
    
    // Trigger auth state change callbacks
    const session = { user: data.user, access_token: data.token };
    this.authCallbacks.forEach(callback => callback('SIGNED_IN', session));
    
    return { data: { user: data.user, session }, error: null };
  }

  async signIn(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('auth_token', data.token);
    
    // Trigger auth state change callbacks
    const session = { user: data.user, access_token: data.token };
    this.authCallbacks.forEach(callback => callback('SIGNED_IN', session));
    
    return { data: { user: data.user, session }, error: null };
  }

  async signOut() {
    localStorage.removeItem('auth_token');
    
    // Trigger auth state change callbacks
    this.authCallbacks.forEach(callback => callback('SIGNED_OUT', null));
    
    return { error: null };
  }

  async getUser() {
    try {
      console.log('[API] getUser called, token exists:', !!this.getToken());
      const data = await this.request('/auth/user');
      console.log('[API] getUser success:', data.user);
      return { data: { user: data.user }, error: null };
    } catch (error: any) {
      console.log('[API] getUser failed:', error.message);
      return { data: { user: null }, error };
    }
  }

  // ---------------- PROFILES ----------------
  async getProfile(userId: string) {
    return this.request(`/profiles/${userId}`);
  }

  // ---------------- SESSIONS ----------------
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
    // fixed: your backend route is usually /calls not /metrics
    return this.request(`/sessions/${sessionId}/calls`);
  }

  async getSipMessages(sessionId: string) {
    return this.request(`/sessions/${sessionId}/sip-messages`);
  }

  async getIntervalMetrics(callId: string) {
    return this.request(`/sessions/call/${callId}/intervals`);
  }

  // ---------------- PCAP UPLOAD ----------------
  async uploadPcap(sessionId: string, files: File[]) {
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    files.forEach(file => formData.append('files', file));

    const response = await fetch(`${API_URL}/pcap/upload`, {
      method: 'POST',
      headers: this.getToken() ? { Authorization: `Bearer ${this.getToken()}` } : undefined,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    return data;
  }

  // ---------------- IP LOOKUP ----------------
  async lookupIp(ip: string) {
    return this.request('/ip-lookup', {
      method: 'POST',
      body: JSON.stringify({ ip }),
    });
  }

  // ---------------- AUTH STATE (supabase-like) ----------------
  onAuthStateChange(callback: (event: string, session: any) => void) {
    // Store the callback for future auth state changes
    this.authCallbacks.push(callback);
    
    // Immediately check current auth state
    this.getUser().then(({ data }) => {
      if (data.user) {
        callback('SIGNED_IN', { user: data.user, access_token: this.getToken() });
      } else {
        callback('SIGNED_OUT', null);
      }
    });

    return {
      data: { 
        subscription: { 
          unsubscribe: () => {
            // Remove callback when unsubscribing
            const index = this.authCallbacks.indexOf(callback);
            if (index > -1) {
              this.authCallbacks.splice(index, 1);
            }
          } 
        } 
      },
    };
  }
}

// Export instance
export const apiClient = new ApiClient();

// Supabase-like shim so you don’t have to change all code at once
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
