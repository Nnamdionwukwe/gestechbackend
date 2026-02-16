// src/controllers/uploadController.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type || "general";
    const typeDir = path.join(uploadsDir, type);

    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }

    cb(null, typeDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|svg|pdf|doc|docx/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only images, PDFs, and documents are allowed"));
  }
};

// Multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter,
});

// ==================== UPLOAD SINGLE FILE ====================

exports.uploadSingle = (fieldName) => upload.single(fieldName);

exports.handleSingleUpload = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const fileUrl = `/uploads/${req.params.type || "general"}/${req.file.filename}`;

    res.json({
      success: true,
      message: "File uploaded successfully",
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl,
        path: req.file.path,
      },
    });
  } catch (error) {
    console.error("Upload single file error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload file",
      details: error.message,
    });
  }
};

// ==================== UPLOAD MULTIPLE FILES ====================

exports.uploadMultiple = (fieldName, maxCount = 5) =>
  upload.array(fieldName, maxCount);

exports.handleMultipleUploads = (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No files uploaded",
      });
    }

    const files = req.files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: `/uploads/${req.params.type || "general"}/${file.filename}`,
      path: file.path,
    }));

    res.json({
      success: true,
      message: `${files.length} files uploaded successfully`,
      files: files,
    });
  } catch (error) {
    console.error("Upload multiple files error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload files",
      details: error.message,
    });
  }
};

// ==================== DELETE FILE ====================

exports.deleteFile = (req, res) => {
  try {
    const { type, filename } = req.params;

    if (!type || !filename) {
      return res.status(400).json({
        success: false,
        error: "Type and filename are required",
      });
    }

    const filePath = path.join(uploadsDir, type, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "File not found",
      });
    }

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete file error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete file",
      details: error.message,
    });
  }
};

// ==================== GET FILE INFO ====================

exports.getFileInfo = (req, res) => {
  try {
    const { type, filename } = req.params;

    if (!type || !filename) {
      return res.status(400).json({
        success: false,
        error: "Type and filename are required",
      });
    }

    const filePath = path.join(uploadsDir, type, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "File not found",
      });
    }

    const stats = fs.statSync(filePath);

    res.json({
      success: true,
      file: {
        filename: filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        url: `/uploads/${type}/${filename}`,
        path: filePath,
      },
    });
  } catch (error) {
    console.error("Get file info error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get file info",
      details: error.message,
    });
  }
};

// ==================== LIST FILES ====================

exports.listFiles = (req, res) => {
  try {
    const { type } = req.params;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: "Type is required",
      });
    }

    const typeDir = path.join(uploadsDir, type);

    if (!fs.existsSync(typeDir)) {
      return res.json({
        success: true,
        files: [],
      });
    }

    const files = fs.readdirSync(typeDir).map((filename) => {
      const filePath = path.join(typeDir, filename);
      const stats = fs.statSync(filePath);

      return {
        filename: filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        url: `/uploads/${type}/${filename}`,
      };
    });

    res.json({
      success: true,
      files: files,
    });
  } catch (error) {
    console.error("List files error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list files",
      details: error.message,
    });
  }
};

module.exports = exports;
