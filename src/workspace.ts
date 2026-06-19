import { getAccessToken } from "./auth";
import { StockFile } from "./types";

export const uploadToGoogleDrive = async (file: StockFile) => {
  const token = await getAccessToken();
  if (!token) throw new Error("No Google access token found");

  const metadata = {
    name: file.filename,
    mimeType: file.mimeType,
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );

  // Convert base64 back to binary for upload
  const byteCharacters = atob(file.base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const fileBlob = new Blob([byteArray], { type: file.mimeType });

  formData.append("file", fileBlob);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error?.message || "Failed to upload to Google Drive");
  }

  return await res.json();
};

export const syncToGoogleSheets = async (files: StockFile[]) => {
  const token = await getAccessToken();
  if (!token) throw new Error("No Google access token found");

  // Step 1: Create a new Spreadsheet
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: `StockSync Metadata - ${new Date().toLocaleString()}`,
      },
    }),
  });

  if (!createRes.ok) {
    const errorData = await createRes.json();
    throw new Error(errorData.error?.message || "Failed to create Google Sheet");
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;

  // Step 2: Append rows
  const values = [
    ["Filename", "Title", "Keywords", "Category"]
  ];

  for (const file of files) {
    if (file.metadata) {
      values.push([
        file.filename,
        file.metadata.title,
        file.metadata.keywords.join(", "),
        String(file.metadata.category_id)
      ]);
    }
  }

  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values,
      }),
    }
  );

  if (!appendRes.ok) {
    const errorData = await appendRes.json();
    throw new Error(errorData.error?.message || "Failed to append rows to Google Sheet");
  }

  return spreadsheetId;
};
