export interface AdobeStockMetadata {
  title: string;
  title_id: string;
  category_id: number;
  category_name: string;
  keywords: string[];
}

export interface StockFile {
  id: string;
  filename: string;
  previewUrl: string;
  base64Data: string;
  mimeType: string;
  size: number;
  status: "pending" | "analyzing" | "completed" | "failed";
  error?: string;
  metadata?: AdobeStockMetadata;
  uploadStatus?: "idle" | "uploading" | "success" | "error";
}

export interface SftpConfig {
  username: string;
  password?: string;
}

export interface SocialSyncConfig {
  instagram: boolean;
  youtube: boolean;
  facebook: boolean;
  tiktok: boolean;
  twitter: boolean;
  linkedin: boolean;
  pinterest: boolean;
}

export interface MicrostockSyncConfig {
  shutterstock: boolean;
  gettyImages: boolean;
  alamy: boolean;
  freepik: boolean;
}

export interface CloudSyncConfig {
  googleDrive: boolean;
  dropbox: boolean;
  notion: boolean;
  wordpress: boolean;
  googleSheets: boolean;
}

export interface SocialCredentialsConfig {
  youtubeToken?: string;
  instagramToken?: string;
  tiktokToken?: string;
  facebookToken?: string;
}

export interface UploadLog {
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
}

export const ADOBE_STOCK_CATEGORIES = [
  { id: 1, name: "Animals (Hewan)" },
  { id: 2, name: "Buildings & Architecture (Bangunan & Arsitektur)" },
  { id: 3, name: "Business (Bisnis)" },
  { id: 4, name: "Drinks (Minuman)" },
  { id: 5, name: "Environment (Lingkungan)" },
  { id: 6, name: "States of Mind (Suasana Hati/Psikologi)" },
  { id: 7, name: "Food (Makanan)" },
  { id: 8, name: "Graphic Resources (Aset Grafis/Background/Pattern)" },
  { id: 9, name: "Hobbies and Leisure (Hobi & Rekreasi)" },
  { id: 10, name: "Industry (Industri/Pabrik)" },
  { id: 11, name: "Landscapes (Pemandangan Alam)" },
  { id: 12, name: "Lifestyle (Gaya Hidup/Aktivitas Manusia)" },
  { id: 13, name: "Multicultural (Keragaman Budaya)" },
  { id: 14, name: "People (Manusia/Karakter)" },
  { id: 15, name: "Plants and Flowers (Tumbuhan & Bunga)" },
  { id: 16, name: "Culture and Religion (Budaya & Agama)" },
  { id: 17, name: "Science (Sains)" },
  { id: 18, name: "Social Issues (Isu Sosial)" },
  { id: 19, name: "Sports (Olahraga)" },
  { id: 20, name: "Technology (Teknologi)" },
  { id: 21, name: "Transport (Transportasi)" },
  { id: 22, name: "Travel (Wisata)" },
];
