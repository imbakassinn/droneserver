export interface User {
  id: string;
  username: string;
  workspaceId: string;
  workspaceName: string;
  role: 'admin' | 'operator' | 'viewer';
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: User['role'];
  workspaceName: string;
}  