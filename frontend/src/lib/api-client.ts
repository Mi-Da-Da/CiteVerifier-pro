const API_BASE = "/api";

export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TitleSearchRequest {
  title: string;
  max_candidates?: number;
}

export interface SearchResult {
  found: boolean;
  query_title: string;
  dblp_id?: number;
  dblp_title?: string;
  dblp_title_similarity?: number;
  year?: number;
  venue?: string;
  pub_type?: string;
}

export interface PdfParseResult {
  success: boolean;
  references?: Array<{
    title?: string;
    [key: string]: any;
  }>;
  titles?: string[];
  error?: string;
}

export interface PdfBatchSearchResult {
  summary: {
    run_id: string | null;
    total_input: number;
    total_processed: number;
    found_count: number;
    not_found_count: number;
    max_candidates: number;
    duration_ms: number;
  };
  items: Array<{
    index: number;
    found: boolean;
    query_title: string;
    dblp_id?: number;
    dblp_title?: string;
    dblp_title_similarity?: number;
    year?: number;
    venue?: string;
    pub_type?: string;
    duration_ms: number;
    error_message?: string;
  }>;
  references?: Array<{
    title?: string;
    [key: string]: any;
  }>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: any; // 允许额外的属性
}

export interface LoginResponse extends ApiResponse {
  user_id?: number;
  username?: string;
}

export interface RegisterResponse extends ApiResponse {
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async register(data: RegisterRequest): Promise<ApiResponse> {
    return this.request<ApiResponse>("/user/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginRequest): Promise<ApiResponse> {
    return this.request<ApiResponse>("/user/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async searchTitle(data: TitleSearchRequest): Promise<SearchResult> {
    return this.request<SearchResult>("/search/title", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getHealth(): Promise<{ status: string; detail?: string }> {
    return this.request("/health");
  }

  async getProgress(): Promise<any> {
    return this.request("/progress");
  }

  /**
   * Parse PDF file to extract references
   * @param file - PDF file (File object from input)
   */
  async parsePdf(file: File): Promise<PdfParseResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/parse/pdf`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Parse PDF and search all extracted titles in DBLP
   * @param file - PDF file (File object from input)
   */
  async searchPdfBatch(file: File): Promise<PdfBatchSearchResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/search/pdf/batch`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();
