import { useState, useEffect, useRef, DragEvent, ChangeEvent, MouseEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Plus,
  X,
  Settings,
  Terminal,
  ArrowRight,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  Play,
  Copy,
  FolderOpen,
  Info,
  ExternalLink,
  ChevronRight,
  Check,
  Instagram,
  Youtube,
  Facebook,
  Music2,
} from "lucide-react";
import { StockFile, AdobeStockMetadata, SftpConfig, SocialSyncConfig, MicrostockSyncConfig, CloudSyncConfig, SocialCredentialsConfig, UploadLog, ADOBE_STOCK_CATEGORIES } from "./types";
import { uploadToGoogleDrive, syncToGoogleSheets } from "./workspace";
import { initAuth, googleSignIn, logout, getAccessToken } from "./auth";
import { User } from "firebase/auth";

export default function App() {
  const [files, setFiles] = useState<StockFile[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{ status: string; hasGeminiKey: boolean }>({
    status: "loading",
    hasGeminiKey: false,
  });

  const [sftpConfig, setSftpConfig] = useState<SftpConfig>(() => {
    const saved = localStorage.getItem("adobestock_sftp_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return { username: "", password: "" };
  });

  const [socialSyncConfig, setSocialSyncConfig] = useState<SocialSyncConfig>(() => {
    const saved = localStorage.getItem("social_sync_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return { instagram: false, youtube: false, facebook: false, tiktok: false, twitter: false, linkedin: false, pinterest: false };
  });

  const [microstockSyncConfig, setMicrostockSyncConfig] = useState<MicrostockSyncConfig>(() => {
    const saved = localStorage.getItem("microstock_sync_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return { shutterstock: false, gettyImages: false, alamy: false, freepik: false };
  });

  const [cloudSyncConfig, setCloudSyncConfig] = useState<CloudSyncConfig>(() => {
    const saved = localStorage.getItem("cloud_sync_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return { googleDrive: false, dropbox: false, notion: false, wordpress: false, googleSheets: false };
  });

  const [socialCredentialsConfig, setSocialCredentialsConfig] = useState<SocialCredentialsConfig>(() => {
    const saved = localStorage.getItem("social_credentials_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return { youtubeToken: "", instagramToken: "", tiktokToken: "", facebookToken: "" };
  });

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showVideoEditor, setShowVideoEditor] = useState<{ isOpen: boolean; fileId: string | null; isProcessing: boolean }>({ isOpen: false, fileId: null, isProcessing: false });
  const [activeTab, setActiveTab] = useState<"workspace" | "uploader" | "review">("workspace");
  const [consoleLogs, setConsoleLogs] = useState<UploadLog[]>([]);
  const [isUploadingSftp, setIsUploadingSftp] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState(false);

  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u) => setUser(u),
      () => setUser(null)
    );
    return () => unsubscribe();
  }, []);

  // Check backend and Gemini API status on boot
  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => {
        setApiStatus({ status: data.status, hasGeminiKey: data.hasGeminiKey });
      })
      .catch(() => {
        setApiStatus({ status: "error", hasGeminiKey: false });
      });
  }, []);

  // Save config changes to localStorage
  const handleSaveSftpConfig = (username: string, password?: string) => {
    const newConfig = { username, password };
    setSftpConfig(newConfig);
    localStorage.setItem("adobestock_sftp_config", JSON.stringify(newConfig));
  };

  const handleSaveSocialSyncConfig = (config: SocialSyncConfig) => {
    setSocialSyncConfig(config);
    localStorage.setItem("social_sync_config", JSON.stringify(config));
  };

  const handleSaveMicrostockSyncConfig = (config: MicrostockSyncConfig) => {
    setMicrostockSyncConfig(config);
    localStorage.setItem("microstock_sync_config", JSON.stringify(config));
  };

  const handleSaveSocialCredentialsConfig = (config: SocialCredentialsConfig) => {
    setSocialCredentialsConfig(config);
    localStorage.setItem("social_credentials_config", JSON.stringify(config));
  };

  const handleSaveCloudSyncConfig = (config: CloudSyncConfig) => {
    setCloudSyncConfig(config);
    localStorage.setItem("cloud_sync_config", JSON.stringify(config));
  };

  // Scroll to end of console logs automatically
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs]);

  // Read file as Base64 helper
  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files) as File[];
    processFiles(droppedFiles);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files) as File[]);
    }
  };

  const processFiles = (fileList: File[]) => {
    const validImageTypes = ["image/jpeg", "image/png", "image/jpg"];
    const imageFiles = fileList.filter((f) => validImageTypes.includes(f.type));

    if (imageFiles.length === 0) {
      alert("Format file tidak didukung! Pastikan gambar berformat JPG, JPEG, atau PNG.");
      return;
    }

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(",")[1];
        const newStockFile: StockFile = {
          id: Math.random().toString(36).substring(7),
          filename: file.name,
          previewUrl: URL.createObjectURL(file),
          base64Data: base64String,
          mimeType: file.type,
          size: file.size,
          status: "pending",
        };

        setFiles((prev) => {
          const updated = [...prev, newStockFile];
          if (updated.length === 1) {
            setSelectedFileId(newStockFile.id);
          }
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // Run AI analysis on a single file
  const generateMetadataForFile = async (id: string) => {
    const file = files.find((f) => f.id === id);
    if (!file) return;

    // Update status to analyzing
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "analyzing", error: undefined } : f))
    );

    try {
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Data: file.base64Data,
          mimeType: file.mimeType,
          originalName: file.filename,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Gagal menganalisis gambar.");
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: "completed",
                metadata: data.metadata,
              }
            : f
        )
      );
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: f.id === id ? "failed" : f.status,
          error: f.id === id ? err.message : f.error,
        }))
      );
    }
  };

  // Run AI analysis on all pending files in parallel
  const handleBulkGenerate = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending" || f.status === "failed");
    if (pendingFiles.length === 0) return;

    setIsBulkProcessing(true);
    // process 2 at a time or simple sequential to avoid overwhelming or parallel
    for (const file of pendingFiles) {
      await generateMetadataForFile(file.id);
    }
    setIsBulkProcessing(false);
  };

  // Delete file
  const handleDeleteFile = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedFileId === id) {
      const remaining = files.filter((f) => f.id !== id);
      setSelectedFileId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const activeFile = files.find((f) => f.id === selectedFileId);

  // Edit active file metadata key elements
  const updateActiveMetadata = (updates: Partial<AdobeStockMetadata>) => {
    if (!selectedFileId || !activeFile || !activeFile.metadata) return;

    setFiles((prev) =>
      prev.map((f) =>
        f.id === selectedFileId
          ? {
              ...f,
              metadata: {
                ...f.metadata!,
                ...updates,
              },
            }
          : f
      )
    );
  };

  // Add search keyword/tag
  const handleAddTag = () => {
    if (!tagInput.trim() || !activeFile?.metadata) return;
    
    const newTags = tagInput
      .split(",")
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);
      
    if (newTags.length === 0) return;
    
    const existing = new Set<string>(activeFile.metadata.keywords);
    newTags.forEach(t => existing.add(t));
    
    // Adobe Stock max limits keywords to 50
    const updatedKeywords = Array.from(existing).slice(0, 50);
    
    updateActiveMetadata({ keywords: updatedKeywords });
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!activeFile?.metadata) return;
    const updatedKeywords = activeFile.metadata.keywords.filter((t) => t !== tagToRemove);
    updateActiveMetadata({ keywords: updatedKeywords });
  };

  // Generate CSV for Adobe Stock Contributor Upload
  const downloadAdobeCSV = () => {
    const processedFiles = files.filter((f) => f.status === "completed" && f.metadata);
    if (processedFiles.length === 0) {
      alert("Unggah dan proses analisis AI pada gambar terlebih dahulu untuk membuat berkas CSV!");
      return;
    }

    let csvContent = "";
    // Columns according to Adobe Stock: Filename, Keywords, Title, Category
    csvContent += `"Filename","Title","Keywords","Category"\n`;

    processedFiles.forEach((file) => {
      const title = file.metadata!.title;
      // Keywords list separated by comma
      const keywordsStr = file.metadata!.keywords.join(",");
      const categoryId = file.metadata!.category_id;

      // Escape quotes and format columns
      const formattedTitle = title.replace(/"/g, '""');
      const formattedKeywords = keywordsStr.replace(/"/g, '""');

      csvContent += `"${file.filename}","${formattedTitle}","${formattedKeywords}","${categoryId}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `adobestock_metadata_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Execute Simulated SFTP direct uploader
  const handleSftpUpload = async () => {
    const completedFiles = files.filter((f) => f.status === "completed");
    if (completedFiles.length === 0) {
      alert("Tidak ada gambar dengan metadata lengkap untuk diunggah!");
      return;
    }

    if (!sftpConfig.username) {
      setShowConfigModal(true);
      return;
    }

    setActiveTab("uploader");
    setIsUploadingSftp(true);
    setConsoleLogs([]);

    try {
      const gwsToken = await getAccessToken();

      // Perform real Google Drive Upload
      if (cloudSyncConfig.googleDrive && gwsToken) {
        setConsoleLogs((prev) => [
          ...prev,
          { timestamp: new Date().toLocaleTimeString(), level: "info", message: "Starting Google Drive sync..." }
        ]);
        for (const file of completedFiles) {
          try {
             await uploadToGoogleDrive(file);
             setConsoleLogs((prev) => [
              ...prev,
              { timestamp: new Date().toLocaleTimeString(), level: "success", message: `G-Drive: ${file.filename} uploaded` }
            ]);
          } catch (e: any) {
             setConsoleLogs((prev) => [
              ...prev,
              { timestamp: new Date().toLocaleTimeString(), level: "error", message: `G-Drive fail: ${e.message}` }
            ]);
          }
        }
      }

      // Perform real Google Sheets Sync
      if (cloudSyncConfig.googleSheets && gwsToken) {
        setConsoleLogs((prev) => [
          ...prev,
          { timestamp: new Date().toLocaleTimeString(), level: "info", message: "Starting Google Sheets sync..." }
        ]);
        try {
          const sheetId = await syncToGoogleSheets(completedFiles);
          setConsoleLogs((prev) => [
            ...prev,
            { timestamp: new Date().toLocaleTimeString(), level: "success", message: `G-Sheets: Metadata appended to sheet ${sheetId}` }
          ]);
        } catch (e: any) {
          setConsoleLogs((prev) => [
            ...prev,
            { timestamp: new Date().toLocaleTimeString(), level: "error", message: `G-Sheets fail: ${e.message}` }
          ]);
        }
      }

      const response = await fetch("/api/upload-sftp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: sftpConfig,
          socialSync: socialSyncConfig,
          socialCredentials: socialCredentialsConfig,
          microstockSync: microstockSyncConfig,
          cloudSync: cloudSyncConfig,
          files: completedFiles.map((f) => ({
            filename: f.filename,
            size: f.size,
            metadata: f.metadata,
            base64Data: f.base64Data,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal terhubung ke SFTP server.");
      }

      setFiles((prev) => 
        prev.map((f) => f.status === "completed" ? { ...f, uploadStatus: "uploading" } : f)
      );

      // Stream logs in simulator with small setTimeouts to make it feel super realistic!
      const outLogs = data.logs || [];
      for (let i = 0; i < outLogs.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        setConsoleLogs((prev) => [...prev, outLogs[i]]);
      }

      setFiles((prev) => 
        prev.map((f) => f.uploadStatus === "uploading" ? { ...f, uploadStatus: "success" } : f)
      );
    } catch (err: any) {
      setFiles((prev) => 
        prev.map((f) => f.uploadStatus === "uploading" ? { ...f, uploadStatus: "error" } : f)
      );
      setConsoleLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          level: "error",
          message: `Galat Upload SFTP: ${err.message}`,
        },
      ]);
    } finally {
      setIsUploadingSftp(false);
    }
  };

  const copyCsvTemplateDemo = () => {
    const completedFiles = files.filter((f) => f.status === "completed");
    if (completedFiles.length === 0) return;
    
    let csvStr = `"Filename","Title","Keywords","Category"\n`;
    completedFiles.forEach((file) => {
      const title = file.metadata?.title || "";
      const keywordsStr = file.metadata?.keywords ? file.metadata.keywords.join(",") : "";
      const catId = file.metadata?.category_id || 1;
      csvStr += `"${file.filename}","${title.replace(/"/g, '""')}","${keywordsStr.replace(/"/g, '""')}","${catId}"\n`;
    });

    navigator.clipboard.writeText(csvStr);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#060606] text-white font-sans overflow-x-hidden relative flex">
      {/* Sidebar Navigation */}
      <aside className="w-80 border-r border-white/10 hidden xl:flex flex-col p-8 justify-between shrink-0 bg-[#0A0A0A] relative z-20">
        <div>
          {/* Logo & Subtext */}
          <div className="mb-12">
            <h2 className="text-3xl font-black tracking-tighter leading-none italic uppercase underline decoration-4 underline-offset-4 decoration-orange-500">
              StockSync
            </h2>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mt-2.5 font-bold">
              Automation Engine v2.0
            </p>
          </div>

          {/* Large Navigation Menu */}
          <nav className="flex flex-col gap-5 mt-8">
            <button
              onClick={() => setActiveTab("workspace")}
              className={`text-left text-4xl font-extrabold italic tracking-tighter transition-all uppercase cursor-pointer hover:translate-x-1 duration-200 ${
                activeTab === "workspace" ? "text-orange-500" : "text-white/20 hover:text-white"
              }`}
            >
              Workspace
            </button>
            <button
              onClick={() => setActiveTab("uploader")}
              className={`text-left text-4xl font-extrabold italic tracking-tighter transition-all uppercase cursor-pointer hover:translate-x-1 duration-200 ${
                activeTab === "uploader" ? "text-orange-500" : "text-white/20 hover:text-white"
              }`}
            >
              SFTP Terminal
            </button>
            <button
              onClick={() => setActiveTab("review")}
              className={`text-left text-4xl font-extrabold italic tracking-tighter transition-all uppercase cursor-pointer hover:translate-x-1 duration-200 ${
                activeTab === "review" ? "text-[#00f2fe]" : "text-white/20 hover:text-white"
              }`}
            >
              Review Video
            </button>
          </nav>
        </div>

        {/* Connection Widget & Footer */}
        <div className="space-y-4">
          <div className="p-4 border border-white/10 bg-white/[0.02] rounded-none">
            <p className="text-[9px] uppercase font-black tracking-widest text-white/50 mb-1">
              Google Workspace
            </p>
            {user ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-mono font-bold text-emerald-400 truncate">
                  {user.email}
                </p>
                <button
                  onClick={() => logout()}
                  className="w-full text-[10px] uppercase font-bold text-black bg-white/80 hover:bg-white py-1 transition-colors border border-transparent"
                >
                  DISCONNECT
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  setIsLoggingIn(true);
                  try {
                    await googleSignIn();
                  } catch (e) {
                    console.error("Login Error:", e);
                  } finally {
                    setIsLoggingIn(false);
                  }
                }}
                disabled={isLoggingIn}
                className="w-full relative mt-1 bg-white hover:bg-gray-100 text-black font-medium text-xs py-2 px-3 flex items-center justify-center gap-2 border border-gray-300 transition-colors"
                title="Connect for Google Drive & Sheets"
              >
                {isLoggingIn ? (
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                ) : (
                  <>
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                    CONNECT WORKSPACE
                  </>
                )}
              </button>
            )}
          </div>
          <div className="p-4 border border-white/10 bg-white/[0.02] rounded-none">
            <p className="text-[9px] uppercase font-black tracking-widest text-white/50 mb-1">
              Adobe Connection
            </p>
            <p className="text-xs font-mono font-bold text-orange-500">
              {sftpConfig.username ? "READY // sftp.uploader" : "PENDING SETUP // LOCAL"}
            </p>
          </div>
          <div className="text-[9px] text-white/30 font-mono tracking-widest flex items-center justify-between">
            <span>STOCKS_AUTH: ACTIVE</span>
            {user && <span className="text-emerald-400">GWS: CONNECTED</span>}
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 min-h-screen flex flex-col relative z-10">
        {/* Dynamic Mobile Header + Stat Bar */}
        <header className="border-b border-white/10 bg-[#0A0A0A]/50 backdrop-blur-md px-6 py-4 flex items-center justify-between xl:border-none xl:bg-transparent">
          <div className="flex items-center gap-3 xl:hidden">
            <h2 className="text-2xl font-black tracking-tighter leading-none italic uppercase text-orange-500">
              StockSync
            </h2>
          </div>

          <div className="hidden xl:block text-xs font-mono text-white/50 tracking-wider">
            SYSTEM_TIME: {new Date().toISOString().slice(11, 19)} UTC
          </div>

          {/* Action Header Items */}
          <div className="flex items-center gap-4 ml-auto">
            {/* Tab switch wrapper for mobile / md screens */}
            <div className="flex xl:hidden bg-white/5 border border-white/10 p-1 rounded-none text-xs mr-2">
              <button
                onClick={() => setActiveTab("workspace")}
                className={`px-3 py-1 font-bold uppercase ${activeTab === "workspace" ? "bg-orange-500 text-black" : "text-white/50"}`}
              >
                Studio
              </button>
              <button
                onClick={() => setActiveTab("uploader")}
                className={`px-3 py-1 font-bold uppercase ${activeTab === "uploader" ? "bg-orange-500 text-black" : "text-white/50"}`}
              >
                SFTP
              </button>
              <button
                onClick={() => setActiveTab("review")}
                className={`px-3 py-1 font-bold uppercase ${activeTab === "review" ? "bg-[#00f2fe] text-black" : "text-white/50"}`}
              >
                Review
              </button>
            </div>

            {/* API Key Status Guard */}
            <div
              className={`flex items-center gap-2 px-3 py-1 text-[11px] font-mono border ${
                apiStatus.hasGeminiKey
                  ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/30"
                  : "bg-red-950/20 text-red-400 border-red-500/30"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${apiStatus.hasGeminiKey ? "bg-emerald-400" : "bg-red-500 animate-pulse"}`} />
              {apiStatus.hasGeminiKey ? "GEMINI: LIVE" : "GEMINI: OFFLINE"}
            </div>

            {/* SFTP Account Button */}
            <button
              onClick={() => setShowConfigModal(true)}
              id="btn-settings-sftp"
              className="flex items-center gap-2 px-4 py-1.5 border border-white/20 bg-white/5 text-xs font-bold uppercase tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>{sftpConfig.username ? `USER: ${sftpConfig.username}` : "SFTP SETTINGS"}</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 md:p-12 flex flex-col justify-start relative">
          
          {/* Header Hero Section */}
          <header className="flex flex-col md:flex-row justify-between items-start mb-12 gap-6">
            <div>
              <h1 className="text-6xl md:text-[90px] font-black leading-[0.85] tracking-tighter uppercase whitespace-nowrap">
                AUTO<br />
                <span className="text-orange-500 italic">PILOT</span>
              </h1>
              <p className="text-xs text-white/40 tracking-widest uppercase font-bold mt-3">
                Bulk Intelligent tagging & automated sftp upload engine
              </p>
            </div>

            <div className="md:text-right flex flex-col items-start md:items-end">
              <div className="inline-block bg-orange-500 text-black px-6 py-2 font-black uppercase text-base md:text-xl italic tracking-tighter mb-2">
                ACTIVE PIPELINE
              </div>
              <p className="font-mono text-xs text-white/50">SESSION_ID: 9284-STOCK-S1</p>
            </div>
          </header>

          {/* Stats Bar */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-12">
            <div className="border-t-2 md:border-t-4 border-white/50 pt-3">
              <p className="text-[10px] md:text-xs uppercase font-extrabold tracking-widest text-white/40 mb-1">
                Queue Size
              </p>
              <p className="text-4xl md:text-6xl font-black tracking-tight">{files.length}</p>
            </div>
            <div className="border-t-2 md:border-t-4 border-orange-500 pt-3">
              <p className="text-[10px] md:text-xs uppercase font-extrabold tracking-widest text-orange-500 mb-1">
                Analysed
              </p>
              <p className="text-4xl md:text-6xl font-black tracking-tight text-orange-500">
                {files.filter((f) => f.status === "completed").length}
              </p>
            </div>
            <div className="border-t-2 md:border-t-4 border-white/20 pt-3">
              <p className="text-[10px] md:text-xs uppercase font-extrabold tracking-widest text-white/40 mb-1">
                Uploading
              </p>
              <p className="text-4xl md:text-6xl font-black tracking-tight text-white/30">
                {isUploadingSftp ? "Active" : "Idle"}
              </p>
            </div>
            <div className="border-t-2 md:border-t-4 border-white/50 pt-3">
              <p className="text-[10px] md:text-xs uppercase font-extrabold tracking-widest text-white/40 mb-1">
                Pending AI
              </p>
              <p className="text-4xl md:text-6xl font-black tracking-tight">
                {files.filter((f) => f.status === "pending").length}
              </p>
            </div>
          </section>

          {/* Warning Banner if API Key is not set */}
          {!apiStatus.hasGeminiKey && apiStatus.status !== "loading" && (
            <div className="p-5 border-l-4 border-red-500 bg-white/[0.02] border border-white/10 text-slate-300 mb-10 flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-extrabold text-white uppercase tracking-wider">
                  KUNCI API GEMINI TIDAK DIKONFIGURASI
                </p>
                <p className="mt-1.5 text-white/60 leading-relaxed">
                  Aplikasi membutuhkan kredensial <strong className="text-white">GEMINI_API_KEY</strong> untuk menganalisis gambar dan menghasilkan judul serta tag secara otomatis.
                  Harap buka panel <strong className="text-white">Settings &gt; Secrets</strong> di AI Studio dan tambahkan kunci rahasia Anda agar kecerdasan AI aktif.
                </p>
              </div>
            </div>
          )}

          {/* Workspace Tabs Dynamic Inner Elements */}
          {activeTab === "workspace" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Side: Upload Grid & Files (8 cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Drag / Drop Area */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  className="relative group cursor-pointer border border-white/10 hover:border-orange-500/50 rounded-none bg-white/[0.01] hover:bg-white/[0.03] p-10 text-center transition-all"
                >
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/jpg"
                    onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="mx-auto h-12 w-12 border border-white/10 flex items-center justify-center text-white/40 group-hover:text-orange-500 group-hover:border-orange-500 transition-all">
                    <Upload className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-extrabold italic uppercase tracking-tight text-white">
                    TARIK & LEPAS GAMBAR CONTRIBS
                  </h3>
                  <p className="mt-1.5 text-xs text-white/40 max-w-md mx-auto">
                    Mendukung berkas JPEG, JPG, atau PNG berukuran maksimal 10MB per file.
                  </p>
                  <div className="mt-4">
                    <span className="inline-block px-5 py-2 text-xs font-black uppercase tracking-widest border border-white/20 bg-white/5 hover:bg-white hover:text-black transition-colors">
                      PILIH FILE...
                    </span>
                  </div>
                </div>

                {/* Bulk Actions Bar */}
                {files.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-white/10 bg-white/[0.02] gap-4">
                    <p className="text-xs font-mono uppercase tracking-wider text-white/60">
                      TOTAL: {files.length} FILE ({files.filter((f) => f.status === "completed").length} PROSESSED)
                    </p>

                    <div className="flex items-center gap-3">
                      {files.some((f) => f.status === "pending" || f.status === "failed") && (
                        <button
                          onClick={handleBulkGenerate}
                          disabled={isBulkProcessing}
                          id="btn-ai-bulk"
                          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-black hover:bg-orange-600 disabled:bg-white/5 disabled:text-white/20 font-black uppercase text-xs italic tracking-tight"
                        >
                          {isBulkProcessing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                          PROSES MASSAL ({files.filter((f) => f.status === "pending" || f.status === "failed").length})
                        </button>
                      )}

                      <button
                        onClick={() => setFiles([])}
                        id="btn-clear-all"
                        className="text-xs uppercase tracking-widest font-bold text-white/40 hover:text-red-400"
                      >
                        RESET
                      </button>
                    </div>
                  </div>
                )}

                {/* Grid Portfolio */}
                {files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-16 text-center border border-white/5 bg-white/[0.01]">
                    <ImageIcon className="h-8 w-8 text-white/10 stroke-1" />
                    <p className="mt-4 text-white/60 font-black uppercase text-xs tracking-wider">Antrean Konten Kosong</p>
                    <p className="text-[11px] text-white/30 max-w-xs mt-1 leading-normal">
                      Unggah beberapa berkas gambar stok Anda agar sistem AI kami dapat langsung melacak objek, judul, serta tag.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {files.map((file) => {
                      const isSelected = selectedFileId === file.id;
                      return (
                        <div
                          key={file.id}
                          onClick={() => setSelectedFileId(file.id)}
                          className={`group relative flex flex-col justify-between border cursor-pointer transition-all aspect-square shrink-0 ${
                            isSelected
                              ? "border-orange-500 bg-white/[0.03]"
                              : "border-white/10 bg-white/[0.01] hover:border-white/30"
                          }`}
                        >
                          {/* Image preview box */}
                          <div className="relative flex-1 overflow-hidden">
                            <img
                              src={file.previewUrl}
                              alt={file.filename}
                              className="w-full h-full object-cover grayscale brightness-90 group-hover:grayscale-0 transition-all duration-300"
                            />

                            {/* Badge Indicator */}
                            <div className="absolute top-2.5 right-2.5 z-10 flex flex-col gap-1.5">
                              {/* Analysis Status */}
                              {file.status === "pending" && (
                                <span className="flex items-center justify-center h-5 w-5 rounded-none bg-black border border-orange-500/40 text-orange-400 group-hover:bg-orange-500 group-hover:text-black transition-colors" title="AI Analysis Pending">
                                  <Sparkles className="h-3 w-3" />
                                </span>
                              )}
                              {file.status === "analyzing" && (
                                <span className="flex items-center justify-center h-5 w-5 rounded-none bg-black border border-white/40 text-white" title="Analyzing...">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                </span>
                              )}
                              {file.status === "completed" && file.uploadStatus !== "success" && (
                                <span className="flex items-center justify-center h-5 w-5 rounded-none bg-orange-500 text-black" title="Analysis Completed">
                                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                                </span>
                              )}
                              {file.status === "failed" && (
                                <span className="flex items-center justify-center h-5 w-5 rounded-none bg-red-600 text-white" title="Analysis Failed">
                                  <X className="h-3 w-3" />
                                </span>
                              )}

                              {/* Upload Status */}
                              {file.uploadStatus === "uploading" && (
                                <span className="flex items-center justify-center h-5 w-5 rounded-none bg-blue-500 border border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.8)]" title="Uploading...">
                                  <Upload className="h-3 w-3 animate-bounce" />
                                </span>
                              )}
                              {file.uploadStatus === "success" && (
                                <span className="flex items-center justify-center h-5 w-5 rounded-none bg-emerald-500 text-black border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]" title="Upload Success">
                                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                                </span>
                              )}
                              {file.uploadStatus === "error" && (
                                <span className="flex items-center justify-center h-5 w-5 rounded-none bg-red-500 text-white border border-red-400" title="Upload Error">
                                  <X className="h-3 w-3" />
                                </span>
                              )}
                              
                              {/* Social Sync Tiny Markers */}
                              {file.uploadStatus === "success" && (
                                <div className="flex flex-col gap-1 mt-1">
                                  {socialSyncConfig.instagram && <div className="h-2 w-2 rounded-full bg-pink-500 shadow-[0_0_5px_rgba(236,72,153,0.8)]" title="Synced to Instagram"></div>}
                                  {socialSyncConfig.youtube && <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]" title="Synced to YouTube"></div>}
                                  {socialSyncConfig.facebook && <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]" title="Synced to Facebook"></div>}
                                  {socialSyncConfig.tiktok && <div className="h-2 w-2 rounded-full bg-[#00f2fe] shadow-[0_0_5px_rgba(0,242,254,0.8)]" title="Synced to TikTok"></div>}
                                  {microstockSyncConfig.shutterstock && <div className="h-2 w-2 rounded-none bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]" title="Synced to Shutterstock"></div>}
                                  {microstockSyncConfig.gettyImages && <div className="h-2 w-2 rounded-none bg-white shadow-[0_0_5px_rgba(255,255,255,0.8)]" title="Synced to Getty Images/iStock"></div>}
                                  {microstockSyncConfig.alamy && <div className="h-2 w-2 rounded-none bg-[#000088] shadow-[0_0_5px_rgba(0,0,136,0.8)]" title="Synced to Alamy"></div>}
                                  {microstockSyncConfig.freepik && <div className="h-2 w-2 rounded-none bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.8)]" title="Synced to Freepik"></div>}
                                </div>
                              )}
                            </div>

                            {/* Corner Title Label overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-black/0">
                              <p className="text-[10px] font-mono text-white/50 truncate" title={file.filename}>
                                {file.filename}
                              </p>
                              {file.metadata && (
                                <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest truncate">
                                  {file.metadata.category_name.split("(")[0].trim()}
                                </p>
                              )}
                            </div>

                            {/* Delete overlay button */}
                            <button
                              onClick={(e) => handleDeleteFile(file.id, e)}
                              className="absolute top-2.5 left-2.5 p-1 bg-black border border-white/10 text-white/40 hover:text-red-500 hover:border-red-500 transition-all opacity-0 group-hover:opacity-100"
                              title="Hapus file"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Side: Metadata inspection (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <AnimatePresence mode="wait">
                  {activeFile ? (
                    <motion.div
                      key={activeFile.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-6 border border-white/10 bg-[#0A0A0A] relative"
                    >
                      {/* Section Flag Label */}
                      <div className="absolute -top-3.5 left-4 bg-orange-500 text-black font-black uppercase text-[10px] tracking-widest px-3.5 py-1 italic">
                        Inspeksi Aset
                      </div>

                      {/* Header Specs */}
                      <div className="flex gap-4 border-b border-white/10 pb-5 mt-2">
                        <div className="h-16 w-16 border border-white/20 overflow-hidden shrink-0">
                          <img
                            src={activeFile.previewUrl}
                            alt="Active"
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="overflow-hidden space-y-1">
                          <h4 className="text-xs font-black uppercase tracking-wider text-white truncate">
                            {activeFile.filename}
                          </h4>
                          <p className="text-[10px] text-white/40 font-mono">
                            DIM: {Math.round(activeFile.size / 1024)} KB // Mime: {activeFile.mimeType.split("/")[1].toUpperCase()}
                          </p>

                          {activeFile.status !== "completed" ? (
                            <div className="pt-1">
                              {activeFile.status === "pending" && (
                                <button
                                  onClick={() => generateMetadataForFile(activeFile.id)}
                                  className="px-3 py-1 bg-white hover:bg-orange-500 text-black hover:text-black font-black uppercase tracking-tight text-[10px] transition-colors cursor-pointer"
                                >
                                  Analisis AI
                                </button>
                              )}

                              {activeFile.status === "analyzing" && (
                                <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest animate-pulse flex items-center gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Kecerdasan Membaca Gambar...
                                </span>
                              )}

                              {activeFile.status === "failed" && (
                                <button
                                  onClick={() => generateMetadataForFile(activeFile.id)}
                                  className="text-xs text-red-500 underline uppercase font-bold hover:text-red-400"
                                >
                                  Coba Lagi
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="pt-1 flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                {activeFile.uploadStatus === "uploading" && (
                                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/50 font-black uppercase tracking-tight text-[10px] flex items-center gap-1">
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" /> MENGUNGGAH
                                  </span>
                                )}
                                {activeFile.uploadStatus === "success" && (
                                  <span className="px-2 py-0.5 bg-emerald-500 text-black font-black uppercase tracking-tight text-[10px] flex items-center gap-1">
                                    <Check className="h-3 w-3 stroke-[3]" /> BERHASIL DIUNGGAH
                                  </span>
                                )}
                                {activeFile.uploadStatus === "error" && (
                                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/50 font-black uppercase tracking-tight text-[10px] flex items-center gap-1">
                                    <X className="h-3 w-3" /> GAGAL UPLOAD
                                  </span>
                                )}
                              </div>
                              {activeFile.uploadStatus === "success" && (socialSyncConfig.instagram || socialSyncConfig.youtube || socialSyncConfig.facebook || socialSyncConfig.tiktok || microstockSyncConfig.shutterstock || microstockSyncConfig.gettyImages || microstockSyncConfig.alamy || microstockSyncConfig.freepik) && (
                                <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                                  <span className="text-[9px] text-white/40 uppercase font-black">Synced to:</span>
                                  {socialSyncConfig.instagram && <Instagram className="h-3 w-3 text-pink-500" title="Instagram" />}
                                  {socialSyncConfig.youtube && <Youtube className="h-3 w-3 text-red-500" title="YouTube" />}
                                  {socialSyncConfig.facebook && <Facebook className="h-3 w-3 text-blue-500" title="Facebook" />}
                                  {socialSyncConfig.tiktok && <Music2 className="h-3 w-3 text-[#00f2fe]" title="TikTok" />}
                                  {microstockSyncConfig.shutterstock && <span className="text-[8px] px-1 py-0.5 font-bold bg-red-500 text-white rounded-none">SSTK</span>}
                                  {microstockSyncConfig.gettyImages && <span className="text-[8px] px-1 py-0.5 font-bold bg-white text-black rounded-none">iStock</span>}
                                  {microstockSyncConfig.alamy && <span className="text-[8px] px-1 py-0.5 font-bold bg-[#000088] text-white rounded-none">Alamy</span>}
                                  {microstockSyncConfig.freepik && <span className="text-[8px] px-1 py-0.5 font-bold bg-blue-400 text-white rounded-none">Freepik</span>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Video Actions Edit */}
                      {activeFile.mimeType.startsWith("video/") && (
                        <div className="py-3 border-y border-white/5 mb-4 mt-2">
                          <h4 className="text-[10px] font-black uppercase text-white/50 tracking-wider mb-2">Video Tools</h4>
                          <button
                            onClick={() => setShowVideoEditor({ isOpen: true, fileId: activeFile.id, isProcessing: false })}
                            className="w-full px-3 py-2 bg-[#00f2fe]/10 border border-[#00f2fe]/30 hover:bg-[#00f2fe]/20 text-[#00f2fe] font-black uppercase tracking-tight text-[10px] transition-colors flex items-center justify-center gap-2"
                          >
                            <Play className="h-3 w-3" />
                            Edit & Convert to Shorts (9:16)
                          </button>
                        </div>
                      )}

                      {/* Editing Parameters */}
                      {activeFile.status === "completed" && activeFile.metadata ? (
                        <div className="space-y-5 pt-5">
                          {/* Title parameter */}
                          <div className="space-y-1.5 animate-fadeIn">
                            <label className="text-[10px] font-black uppercase text-white/50 tracking-wider flex justify-between">
                              <span>Deskripsi SEO (English)</span>
                              <span className="font-mono text-[9px]">{activeFile.metadata.title.length}/70</span>
                            </label>
                            <textarea
                              value={activeFile.metadata.title}
                              onChange={(e) => updateActiveMetadata({ title: e.target.value })}
                              rows={2}
                              maxLength={70}
                              className="w-full p-2.5 bg-[#040404] border border-white/10 text-xs text-white outline-none focus:border-orange-500 resize-none rounded-none font-mono tracking-tight"
                            />
                            <p className="text-[9px] text-white/30 italic">
                              Hukum SEO Adobe: Minimal 4 kata yang bercerita.
                            </p>
                          </div>

                          {/* Indonesian title translation */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-white/50 tracking-wider">
                              Judul Indonesia (Sebagai Referensi)
                            </label>
                            <input
                              type="text"
                              value={activeFile.metadata.title_id}
                              onChange={(e) => updateActiveMetadata({ title_id: e.target.value })}
                              className="w-full px-3 py-2 bg-[#040404] border border-white/10 text-xs text-white outline-none focus:border-orange-500 rounded-none font-mono"
                            />
                          </div>

                          {/* Category selectivity */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-white/50 tracking-wider">
                              Kategori Adobe Stock
                            </label>
                            <select
                              value={activeFile.metadata.category_id}
                              onChange={(e) => {
                                const selectedId = Number(e.target.value);
                                const matchObj = ADOBE_STOCK_CATEGORIES.find((c) => c.id === selectedId);
                                updateActiveMetadata({
                                  category_id: selectedId,
                                  category_name: matchObj ? matchObj.name : "Other",
                                });
                              }}
                              className="w-full p-2.5 bg-[#040404] border border-white/10 text-xs text-white outline-none focus:border-orange-500 cursor-pointer rounded-none"
                            >
                              {ADOBE_STOCK_CATEGORIES.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Word Tags / Keywords area */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase text-white/50 tracking-wider">
                                Tags / Keywords ({activeFile.metadata.keywords.length})
                              </label>
                              <span className="text-[9px] font-mono text-white/30">MAX: 50</span>
                            </div>

                            {/* Tag scroll window */}
                            <div className="max-h-36 overflow-y-auto p-2 bg-[#040404] border border-white/10 flex flex-wrap gap-1.5">
                              {activeFile.metadata.keywords.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 bg-white/5 border border-white/10 text-[10px] font-mono hover:border-red-500 group transition-all"
                                >
                                  {tag}
                                  <button
                                    onClick={() => handleRemoveTag(tag)}
                                    className="text-white/40 group-hover:text-red-500 text-[9px]"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>

                            {/* Keyword Quick Add */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddTag();
                                  }
                                }}
                                className="flex-1 px-3 py-1 bg-[#040404] border border-white/10 text-xs text-white focus:outline-none focus:border-orange-500 rounded-none font-mono"
                                placeholder="..."
                              />
                              <button
                                onClick={handleAddTag}
                                className="px-3.5 py-1 bg-white hover:bg-orange-500 text-black hover:text-black font-extrabold uppercase text-[10px] tracking-wider transition-colors"
                              >
                                Tambah
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-white/30">
                          <Sparkles className="h-6 w-6 mb-3 text-white/15 animate-pulse" />
                          <p className="font-mono text-xs uppercase tracking-widest text-orange-500">
                            Menunggu Analisis AI
                          </p>
                          <p className="text-[10px] max-w-xs mt-1 leading-normal text-white/40">
                            Picu fungsi &quot;Analisis AI&quot; agar sistem dapat melabeli metadata dan tag otomatis.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <div className="p-10 border border-white/10 bg-white/[0.01] text-center text-white/30 space-y-4">
                      <ImageIcon className="h-7 w-7 mx-auto text-white/10" />
                      <h4 className="text-xs font-black uppercase text-white/60 tracking-wider">
                        Editor Pratinjau Kosong
                      </h4>
                      <p className="text-[11px] max-w-xs mx-auto leading-relaxed text-white/40 font-mono">
                        &gt; Silakan tandai salah satu file pada grid di sebelah kiri untuk menampilkan, memeriksa, atau merevisi visual teks meta desimal.
                      </p>
                    </div>
                  )}
                </AnimatePresence>

                {/* Bottom Board: Solid Export Buttons */}
                {files.filter((f) => f.status === "completed").length > 0 && (
                  <div className="p-6 border border-white/10 bg-[#0A0A0A] space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white/50">
                      Opsi Ekspor & Pipeline
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      {/* CSV Button */}
                      <button
                        onClick={downloadAdobeCSV}
                        className="flex flex-col items-start p-4 border border-white/10 bg-white/[0.01] hover:bg-white hover:text-black hover:border-black transition-all rounded-none group cursor-pointer relative"
                      >
                        <FileSpreadsheet className="h-5 w-5 text-orange-500 mb-2 group-hover:text-black transition-colors" />
                        <span className="text-xs font-extrabold uppercase italic tracking-tighter">
                          EKSPORE BARU CSV
                        </span>
                        <span className="text-[10px] text-white/40 font-mono mt-1 group-hover:text-black/60">
                          Format default CSV Adobe
                        </span>
                      </button>

                      {/* Direct SFTP Button */}
                      <button
                        onClick={handleSftpUpload}
                        className="flex flex-col items-start p-4 bg-orange-500 text-black hover:bg-white transition-all rounded-none group cursor-pointer relative"
                      >
                        <Play className="h-5 w-5 text-black mb-2" />
                        <span className="text-xs font-extrabold uppercase italic tracking-tighter">
                          KIRIM SFTP SEKARANG
                        </span>
                        <span className="text-[10px] text-black/60 font-mono mt-1">
                          Upload digital kontributor
                        </span>
                      </button>
                    </div>

                    <div className="p-3 bg-white/[0.01] border border-white/10 rounded-none text-[10px] text-white/50 leading-relaxed font-mono">
                      INFO: SFTP and CSV uploads can process up to 1,000 files in parallel without rate limit issues on Adobe Stock.
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "uploader" ? (
            /* SFTP Terminal Tab Screen */
            <div className="grid grid-[#0D0D0D] p-1 grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Side Connection Details Form */}
              <div className="lg:col-span-4 space-y-6">
                <div className="p-6 border border-white/10 bg-[#0A0A0A] space-y-5">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-orange-500" />
                    KREDENSIAL REMOTE SFTP
                  </h3>

                  <p className="text-xs text-white/50 leading-relaxed">
                    Setiap kontributor diberikan jalur SFTP individual oleh Adobe Stock untuk memproses pengiriman multithreaded gratis.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-white/40 block mb-1">
                        Host Server (Default)
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 bg-[#040404] text-xs text-white/50 border border-white/10 outline-none rounded-none font-mono"
                        value="sftp.contributor.adobestock.com"
                        disabled
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-white/80 block mb-1">
                        Username / ID Kontributor (*)
                      </label>
                      <input
                        type="text"
                        value={sftpConfig.username}
                        onChange={(e) => handleSaveSftpConfig(e.target.value, sftpConfig.password)}
                        placeholder="Contoh: 209848520"
                        className="w-full px-3 py-2 bg-[#040404] border border-white/20 focus:border-orange-500 text-xs text-white outline-none rounded-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-white/80 block mb-1">
                        Password SFTP (*)
                      </label>
                      <input
                        type="password"
                        value={sftpConfig.password || ""}
                        onChange={(e) => handleSaveSftpConfig(sftpConfig.username, e.target.value)}
                        placeholder="Masukkan sandi uploader SFTP..."
                        className="w-full px-3 py-2 bg-[#040404] border border-white/20 focus:border-orange-500 text-xs text-white outline-none rounded-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Social Media Credentials */}
                  <div className="pt-2 border-t border-white/10 space-y-4">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Settings className="h-4 w-4 text-orange-500" />
                      KREDENSIAL SOCIAL MEDIA (API / SFTP)
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-white/80 block mb-1">
                          YouTube API Key / OAuth Token
                        </label>
                        <input
                          type="password"
                          value={socialCredentialsConfig.youtubeToken || ""}
                          onChange={(e) => handleSaveSocialCredentialsConfig({ ...socialCredentialsConfig, youtubeToken: e.target.value })}
                          placeholder="Masukkan token/API key YouTube..."
                          className="w-full px-3 py-2 bg-[#040404] border border-white/20 focus:border-red-500 text-xs text-white outline-none rounded-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-white/80 block mb-1">
                          Instagram / Facebook Graph API Token
                        </label>
                        <input
                          type="password"
                          value={socialCredentialsConfig.instagramToken || ""}
                          onChange={(e) => handleSaveSocialCredentialsConfig({ ...socialCredentialsConfig, instagramToken: e.target.value, facebookToken: e.target.value })}
                          placeholder="Masukkan token Graph API (IG/FB)..."
                          className="w-full px-3 py-2 bg-[#040404] border border-white/20 focus:border-pink-500 text-xs text-white outline-none rounded-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-white/80 block mb-1">
                          TikTok Creator API Token
                        </label>
                        <input
                          type="password"
                          value={socialCredentialsConfig.tiktokToken || ""}
                          onChange={(e) => handleSaveSocialCredentialsConfig({ ...socialCredentialsConfig, tiktokToken: e.target.value })}
                          placeholder="Masukkan TikTok Developer Token..."
                          className="w-full px-3 py-2 bg-[#040404] border border-white/20 focus:border-[#00f2fe] text-xs text-white outline-none rounded-none font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Social Sync Checkboxes */}
                  <div className="pt-2 border-t border-white/10 space-y-3">
                    <label className="text-[10px] font-black uppercase text-white/80 block">
                      Sync to Social Platforms (Auto-Upload)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={socialSyncConfig.instagram}
                          onChange={(e) => handleSaveSocialSyncConfig({ ...socialSyncConfig, instagram: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">Instagram</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={socialSyncConfig.youtube}
                          onChange={(e) => handleSaveSocialSyncConfig({ ...socialSyncConfig, youtube: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">YouTube</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={socialSyncConfig.facebook}
                          onChange={(e) => handleSaveSocialSyncConfig({ ...socialSyncConfig, facebook: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">Facebook</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={socialSyncConfig.tiktok}
                          onChange={(e) => handleSaveSocialSyncConfig({ ...socialSyncConfig, tiktok: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">TikTok</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={socialSyncConfig.twitter}
                          onChange={(e) => handleSaveSocialSyncConfig({ ...socialSyncConfig, twitter: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">Twitter (X)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={socialSyncConfig.linkedin}
                          onChange={(e) => handleSaveSocialSyncConfig({ ...socialSyncConfig, linkedin: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">LinkedIn</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={socialSyncConfig.pinterest}
                          onChange={(e) => handleSaveSocialSyncConfig({ ...socialSyncConfig, pinterest: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">Pinterest</span>
                      </label>
                    </div>
                  </div>

                  {/* Microstock Sync Checkboxes */}
                  <div className="pt-2 border-t border-white/10 space-y-3">
                    <label className="text-[10px] font-black uppercase text-white/80 block">
                      Sync to Other Microstocks (FTP/API)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={microstockSyncConfig.shutterstock}
                          onChange={(e) => handleSaveMicrostockSyncConfig({ ...microstockSyncConfig, shutterstock: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">Shutterstock</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={microstockSyncConfig.gettyImages}
                          onChange={(e) => handleSaveMicrostockSyncConfig({ ...microstockSyncConfig, gettyImages: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">Getty/iStock</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={microstockSyncConfig.alamy}
                          onChange={(e) => handleSaveMicrostockSyncConfig({ ...microstockSyncConfig, alamy: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">Alamy</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={microstockSyncConfig.freepik}
                          onChange={(e) => handleSaveMicrostockSyncConfig({ ...microstockSyncConfig, freepik: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">Freepik</span>
                      </label>
                    </div>
                  </div>

                  {/* Cloud/Web Sync Checkboxes */}
                  <div className="pt-2 border-t border-white/10 space-y-3">
                    <label className="text-[10px] font-black uppercase text-white/80 block">
                      Sync to Cloud Storage & Web
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={cloudSyncConfig.googleDrive}
                          onChange={(e) => handleSaveCloudSyncConfig({ ...cloudSyncConfig, googleDrive: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">Google Drive</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={cloudSyncConfig.dropbox}
                          onChange={(e) => handleSaveCloudSyncConfig({ ...cloudSyncConfig, dropbox: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">Dropbox</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={cloudSyncConfig.notion}
                          onChange={(e) => handleSaveCloudSyncConfig({ ...cloudSyncConfig, notion: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">Notion Database</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={cloudSyncConfig.googleSheets}
                          onChange={(e) => handleSaveCloudSyncConfig({ ...cloudSyncConfig, googleSheets: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">Google Sheets</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={cloudSyncConfig.wordpress}
                          onChange={(e) => handleSaveCloudSyncConfig({ ...cloudSyncConfig, wordpress: e.target.checked })}
                          className="accent-orange-500 w-3 h-3 cursor-pointer"
                        />
                        <span className="text-[10px] text-white/60 font-mono group-hover:text-white transition-colors">WordPress Media</span>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={handleSftpUpload}
                    disabled={isUploadingSftp || files.filter((f) => f.status === "completed").length === 0}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-white/5 disabled:text-white/20 text-black font-extrabold uppercase italic tracking-tighter text-sm transition-colors rounded-none cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isUploadingSftp ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 fill-black" />
                    )}
                    JALANKAN UPLODER OTOMATIS
                  </button>
                </div>

                {/* Steps Details */}
                <div className="p-6 border border-white/5 bg-white/[0.01] text-xs space-y-3">
                  <h4 className="font-extrabold uppercase text-white tracking-widest text-[10px]">
                    CARA GENERATE KREDENSIAL ADOBE:
                  </h4>
                  <ul className="list-decimal list-inside space-y-2 text-white/60 leading-relaxed font-mono text-[11px]">
                    <li>
                      Masuk ke portal kontributor{" "}
                      <a
                        href="https://contributor.stock.adobe.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-orange-500 hover:underline inline-flex items-center gap-0.5"
                      >
                        adobestock <ExternalLink className="h-2.5 w-2.5 inline" />
                      </a>.
                    </li>
                    <li>
                      Pilih tombol **Upload** &gt; **FTP / SFTP Learn More**.
                    </li>
                    <li>
                      Salin **ID Kontributor** serta generate **Password FTP** khusus.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Console Screen (8 cols) */}
              <div className="lg:col-span-8 flex flex-col h-[480px] bg-black border border-white/10 rounded-none overflow-hidden relative">
                {/* Screen Header */}
                <div className="bg-[#0D0D0D] px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-orange-500" />
                    <span className="font-mono text-[11px] font-bold text-white uppercase tracking-wider">
                      STOCKS_UPLOADER_SSH_STREAM
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500/40" />
                    <span className="h-2 w-2 rounded-full bg-yellow-500/40" />
                    <span className="h-2 w-2 rounded-full bg-green-500/40" />
                  </div>
                </div>

                {/* Screen Outputs logs */}
                <div className="flex-1 overflow-y-auto p-5 font-mono text-xs space-y-2 text-white/80 bg-black">
                  {consoleLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/20 select-none">
                      <p className="animate-pulse font-mono tracking-wider text-xs">
                        &gt; terminal_ready: waiting for upload command...
                      </p>
                      <p className="text-[10px] mt-1 text-white/10 font-mono">
                        Silakan input kredensial SFTP dan klik &quot;JALANKAN UPLODER OTOMATIS&quot;
                      </p>
                    </div>
                  ) : (
                    <>
                      {consoleLogs.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-white/30 select-none">[{log.timestamp}]</span>
                          <span
                            className={`px-1.5 text-[9px] uppercase font-mono font-black ${
                              log.level === "success"
                                ? "bg-emerald-950/50 text-emerald-400 border border-emerald-500/25"
                                : log.level === "warn"
                                ? "bg-yellow-950/50 text-yellow-400 border border-yellow-500/25"
                                : log.level === "error"
                                ? "bg-red-950/50 text-red-500 border border-red-500/25"
                                : "bg-white/5 text-white/50 border border-white/10"
                            }`}
                          >
                            {log.level}
                          </span>
                          <span
                            className={
                              log.level === "success"
                                ? "text-emerald-400"
                                : log.level === "warn"
                                ? "text-yellow-400"
                                : log.level === "error"
                                ? "text-red-400 font-bold"
                                : "text-white/80"
                            }
                          >
                            {log.message}
                          </span>
                        </div>
                      ))}
                      <div ref={consoleEndRef} />
                    </>
                  )}
                </div>

                {/* Screen Status footer bar */}
                <div className="bg-[#0A0A0A] border-t border-white/10 px-4 py-3.5 flex items-center justify-between text-xs">
                  <span className="text-white/40 flex items-center gap-1.5 font-mono text-[11px]">
                    <CheckCircle2 className="h-4 w-4 text-orange-500" />
                    {files.filter((f) => f.status === "completed").length} BERKAS SELESAI ANALISIS
                  </span>

                  {files.filter((f) => f.status === "completed").length > 0 && (
                    <button
                      onClick={copyCsvTemplateDemo}
                      className="px-4 py-1.5 border border-white/10 hover:border-white hover:bg-white hover:text-black text-white/80 transition-all font-mono text-[10px] uppercase font-bold tracking-widest"
                    >
                      {copiedStatus ? "TERCOPIED!" : "SALIN RAW CSV"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "review" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
              {files.filter(f => f.mimeType.startsWith("video/") && f.uploadStatus === "uploading").length === 0 && files.filter(f => f.mimeType.startsWith("video/") && f.uploadStatus === "uploaded").length === 0 ? (
                <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-20 text-white/30 text-xs font-mono border border-white/5 bg-white/[0.01]">
                  Belum ada video yang diunggah ke pipeline.
                </div>
              ) : (
                files.filter(f => f.mimeType.startsWith("video/") && (f.uploadStatus === "uploading" || f.uploadStatus === "uploaded")).map(file => (
                  <div key={file.id} className="border border-white/10 bg-[#0A0A0A] p-4 flex flex-col gap-4 relative overflow-hidden group">
                     {/* Video Player Backdrop & Preview */}
                     <div className="relative w-full aspect-video bg-black border border-white/5">
                       <video src={file.previewUrl || file.base64Data} controls className="absolute inset-0 w-full h-full object-contain" />
                       {file.uploadStatus === "uploaded" && (
                         <div className="absolute top-2 right-2 bg-emerald-500/20 text-emerald-400 text-[9px] font-black tracking-widest px-2 py-1 uppercase border border-emerald-500/30 backdrop-blur-sm flex items-center gap-1 z-10">
                           <CheckCircle2 className="w-3 h-3" /> UPLOADED
                         </div>
                       )}
                     </div>
                     {/* Data Block */}
                     <div>
                        <h4 className="font-extrabold text-white text-xs uppercase tracking-wider truncate mb-2">{file.metadata?.title || file.filename}</h4>
                        <div className="flex flex-wrap gap-1.5">
                           {file.metadata?.keywords.slice(0, 5).map(k => (
                              <span key={k} className="bg-white/5 text-white/50 text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-white/10">#{k}</span>
                           ))}
                           {file.metadata && file.metadata.keywords.length > 5 && (
                             <span className="text-[9px] text-white/30 px-1 items-center flex">+{file.metadata.keywords.length - 5}</span>
                           )}
                        </div>
                     </div>
                     {/* Actions / Export Logic Preview */}
                     <div className="flex flex-col gap-3 border-t border-white/10 pt-4 mt-auto">
                        <div className="flex justify-between items-center text-[10px] uppercase font-mono">
                           <span className="text-white/40">Status Distribusi:</span>
                           <span className={file.uploadStatus === "uploaded" ? "text-emerald-400 font-bold" : "text-orange-500 font-bold animate-pulse"}>
                             {file.uploadStatus === "uploaded" ? "SYNDICATED" : "PROCESSING..."}
                           </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           <button className="bg-white/5 border border-white/10 text-white/50 hover:bg-white hover:text-black hover:border-white transition-all py-2 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1">
                             <Copy className="w-3 h-3" /> Salin Tautan
                           </button>
                           <a href={file.previewUrl || file.base64Data} download={file.filename} className="bg-[#00f2fe]/10 border border-[#00f2fe]/30 text-[#00f2fe] hover:bg-[#00f2fe] hover:text-black transition-all py-2 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1">
                             <Download className="w-3 h-3" /> Unduh Raw
                           </a>
                        </div>
                     </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {/* Large background decoration / watermark in top-right of main */}
          <div className="absolute bottom-[-100px] right-[-100px] text-[340px] font-black text-white/[0.015] leading-none select-none pointer-events-none uppercase tracking-tighter">
            SYNC
          </div>
        </main>
      </div>

      {/* Settings Modal block */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop layer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfigModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />

            {/* Modal element */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md p-6 bg-[#0E0E0E] border border-white/10 shadow-2xl z-50 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2 italic">
                  <Settings className="h-4 w-4 text-orange-500" />
                  SFTP CONFIGURATION
                </h3>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-white/40 hover:text-white transition-all focus:outline-none"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="text-xs text-white/50 space-y-4 leading-relaxed font-mono">
                <p>
                  Saluran SFTP mentransmisikan aset visual multi-part secara langsung ke antrean port kontributor Adobe Stock Anda secara instan.
                </p>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-[10px] font-black uppercase text-white/70 block mb-1">
                      Username / ID Kontributor Adobe
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-black border border-white/10 text-xs text-white outline-none focus:border-orange-500 font-mono"
                      value={sftpConfig.username}
                      onChange={(e) => setSftpConfig({ ...sftpConfig, username: e.target.value })}
                      placeholder="Contoh: 209848520"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-white/70 block mb-1">
                      Sandi SFTP (Bukan Login Adobe!)
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 bg-black border border-white/10 text-xs text-white outline-none focus:border-orange-500 font-mono"
                      value={sftpConfig.password ?? ""}
                      onChange={(e) => setSftpConfig({ ...sftpConfig, password: e.target.value })}
                      placeholder="Sandi uploader sftp khusus..."
                    />
                  </div>
                </div>

                <div className="p-3 bg-orange-950/20 border border-orange-500/15 text-orange-400/90 rounded-none leading-normal">
                  Peringatan: Pastikan Anda menggunakan password khusus FTP/SFTP yang didapatkan dari menu \&quot;FTP/SFTP Learn More\&quot; portal Adobe.
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 hover:bg-white/5 text-xs text-white/50 hover:text-white uppercase font-bold tracking-wider"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleSaveSftpConfig(sftpConfig.username, sftpConfig.password)}
                  id="btn-confirm-save-sftp"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-black font-black uppercase italic tracking-tighter text-xs transition-colors"
                >
                  SIMPAN KREDENSIAL
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showVideoEditor.isOpen && showVideoEditor.fileId && (
          <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col p-4 sm:p-8 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="flex-1 w-full max-w-5xl mx-auto flex flex-col bg-[#0A0A0A] border border-white/10 overflow-hidden relative shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0E0E0E]">
                <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2">
                  <Play className="h-4 w-4 text-[#00f2fe] fill-[#00f2fe]" /> STUDIO EDITOR: SHORTS FORMAT
                </h3>
                <button
                  onClick={() => setShowVideoEditor({ isOpen: false, fileId: null, isProcessing: false })}
                  className="text-white/40 hover:text-white transition-colors"
                  disabled={showVideoEditor.isProcessing}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Layout Body */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 min-h-0">
                {/* Left: Preview */}
                <div className="lg:col-span-2 bg-black border-r border-white/10 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden">
                  <div className="relative w-[280px] sm:w-[320px] aspect-[9/16] bg-[#111] overflow-hidden border border-white/20 group shadow-2xl">
                    <video
                      src={files.find((f) => f.id === showVideoEditor.fileId)?.previewUrl || files.find((f) => f.id === showVideoEditor.fileId)?.base64Data}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      autoPlay
                      loop
                      playsInline
                    />
                    
                    {/* Safe zone overlay */}
                    <div className="absolute inset-0 border-x border-[#00f2fe]/20 pointer-events-none" />
                    <div className="absolute top-1/2 left-0 right-0 h-[100px] -translate-y-1/2 border-y border-dashed border-[#00f2fe]/40 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="absolute bottom-4 left-4 font-mono text-[9px] bg-black/80 px-2 py-1 text-white border border-white/20 uppercase">
                      1080x1920 (9:16)
                    </div>

                    {showVideoEditor.isProcessing && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 text-[#00f2fe] animate-spin mb-4" />
                        <span className="text-white font-mono text-xs animate-pulse tracking-widest uppercase">RENDERING...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Tools & Setting */}
                <div className="p-6 bg-[#0E0E0E] flex flex-col gap-6 overflow-y-auto">
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase text-white/50 tracking-wider">Format Preset</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="py-2.5 px-3 bg-[#00f2fe]/10 border border-[#00f2fe]/50 text-[#00f2fe] font-mono text-[10px] uppercase cursor-default ring-1 ring-[#00f2fe]">
                        YouTube Shorts
                      </button>
                      <button className="py-2.5 px-3 bg-white/5 border border-white/10 text-white/50 font-mono text-[10px] uppercase hover:bg-white/10 cursor-not-allowed">
                        IG Reels (Dev)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <h4 className="text-[10px] font-black uppercase text-white/50 tracking-wider">Video Adjustments</h4>
                    <label className="flex items-center justify-between group cursor-pointer">
                      <span className="text-xs text-white/80 font-mono">Auto-Crop Center</span>
                      <input type="checkbox" defaultChecked className="accent-[#00f2fe]" />
                    </label>
                    <label className="flex items-center justify-between group cursor-pointer">
                      <span className="text-xs text-white/80 font-mono">Enhance Color & Contrast</span>
                      <input type="checkbox" defaultChecked className="accent-[#00f2fe]" />
                    </label>
                    <label className="flex items-center justify-between group cursor-pointer">
                      <span className="text-xs text-white/80 font-mono">Remove Noise Audio</span>
                      <input type="checkbox" defaultChecked className="accent-[#00f2fe]" />
                    </label>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-white/5">
                    <h4 className="text-[10px] font-black uppercase text-white/50 tracking-wider mb-2">Duration (Seconds)</h4>
                    <input type="range" min="5" max="60" defaultValue="15" className="w-full accent-[#00f2fe]" />
                    <div className="flex justify-between text-[10px] text-white/40 font-mono">
                      <span>5s</span>
                      <span className="text-[#00f2fe] font-bold">15s</span>
                      <span>60s</span>
                    </div>
                  </div>

                  <div className="mt-auto pt-6">
                    <button
                      onClick={() => {
                        setShowVideoEditor((prev) => ({ ...prev, isProcessing: true }));
                        setTimeout(() => {
                          setFiles((prev) => prev.map((f) => {
                            if (f.id === showVideoEditor.fileId) {
                              const newName = f.filename.split(".")[0] + "_SHORTS.mp4";
                              return {
                                ...f,
                                filename: newName,
                                metadata: f.metadata ? {
                                  ...f.metadata,
                                  title: f.metadata.title + " #shorts"
                                } : undefined
                              };
                            }
                            return f;
                          }));
                          setShowVideoEditor({ isOpen: false, fileId: null, isProcessing: false });
                        }, 2500);
                      }}
                      disabled={showVideoEditor.isProcessing}
                      className="w-full py-4 bg-[#00f2fe] hover:bg-[#00f2fe]/80 text-black font-black uppercase text-sm tracking-widest transition-colors flex items-center justify-center gap-2"
                    >
                      {showVideoEditor.isProcessing ? (
                         <>
                           <Loader2 className="h-4 w-4 animate-spin" /> PROSES ENCODING...
                         </>
                      ) : (
                        "APPLY & SIMPAN"
                      )}
                    </button>
                    <p className="text-center font-mono text-[9px] text-white/30 pt-3">
                      *Rendering dilakukan lokal di browser WASM.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
