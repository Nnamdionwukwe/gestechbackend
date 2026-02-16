// src/routes/upload.js
const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const { authenticate, authorize } = require("../middleware/auth");

/**
 * UPLOAD ROUTES
 * All routes require authentication
 */

// Apply authentication to all upload routes
router.use(authenticate);
router.use(authorize("admin", "editor"));

// ==================== UPLOAD FILES ====================

/**
 * @route   POST /api/upload/:type/single
 * @desc    Upload single file
 * @access  Private (Admin, Editor)
 * @params  type - File type directory (e.g., 'services', 'projects', 'team', 'blog')
 * @body    FormData with file field
 */
router.post(
  "/:type/single",
  uploadController.uploadSingle("file"),
  uploadController.handleSingleUpload,
);

/**
 * @route   POST /api/upload/:type/multiple
 * @desc    Upload multiple files
 * @access  Private (Admin, Editor)
 * @params  type - File type directory
 * @body    FormData with files field (max 5 files)
 */
router.post(
  "/:type/multiple",
  uploadController.uploadMultiple("files", 5),
  uploadController.handleMultipleUploads,
);

// ==================== FILE MANAGEMENT ====================

/**
 * @route   GET /api/upload/:type/list
 * @desc    List all files in a directory
 * @access  Private (Admin, Editor)
 * @params  type - File type directory
 */
router.get("/:type/list", uploadController.listFiles);

/**
 * @route   GET /api/upload/:type/:filename
 * @desc    Get file info
 * @access  Private (Admin, Editor)
 * @params  type - File type directory
 * @params  filename - Name of the file
 */
router.get("/:type/:filename", uploadController.getFileInfo);

/**
 * @route   DELETE /api/upload/:type/:filename
 * @desc    Delete file
 * @access  Private (Admin, Editor)
 * @params  type - File type directory
 * @params  filename - Name of the file
 */
router.delete("/:type/:filename", uploadController.deleteFile);

module.exports = router;
