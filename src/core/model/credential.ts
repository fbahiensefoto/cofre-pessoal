export interface Credential {
  id: string;
  owner: string;
  serviceName: string;
  category: string;
  url?: string;
  username?: string;
  password: string;
  notes?: string;
  tags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}
