import connection from "../config/connectDB.js";
import multer from "multer";
import path from "path";
import fs from "fs";

// ✅ Upload folder
const uploadDir = path.join("src", "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({ storage });

// ✅ Serve static files
// In your main server file (app.js / server.js):
// app.use("/uploads", express.static(path.join("src", "public", "uploads")));

// ✅ Get all banners
export const getBanners = async (req, res) => {
  try {
    const [rows] = await connection.execute(
      "SELECT * FROM slider_images ORDER BY created_at DESC"
    );

    return res.status(200).json({
      status: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal server error"
    });
  }
};


// ✅ Create banner
export const createBanner = async (req, res) => {
  try {
    const { title, page_url } = req.body;  // ✅ Fix: get from req.body
    const file = req.file;

    if (!title?.trim() || !file) {
      return res.status(400).json({ status: false, message: "Title and image are required" });
    }

    const imageUrl = `/uploads/${file.filename}`;

    // ✅ Fix: match number of placeholders (4 columns → 4 values)
    const [result] = await connection.execute(
      "INSERT INTO slider_images (title, image_url, page_url, created_at) VALUES (?, ?, ?, NOW())",
      [title.trim(), imageUrl, page_url ?? null]  // ✅ handle undefined safely
    );

    return res.status(201).json({
      status: true,
      message: "Banner created successfully",
      id: result.insertId,
      filePath: file.path,
      fileUrl: imageUrl
    });
  } catch (error) {
    console.error("❌ Error creating banner:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message
    });
  }
};



// ✅ Delete banner
export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ status: false, message: "Banner ID required" });

    const [existingRows] = await connection.execute(
      "SELECT * FROM slider_images WHERE id = ?", [id]
    );
    if (existingRows.length === 0)
      return res.status(404).json({ status: false, message: "Banner not found" });

    const existing = existingRows[0];

    await connection.execute("DELETE FROM slider_images WHERE id = ?", [id]);

    if (existing.image_url) {
      const filePath = path.join("src", "public", existing.image_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    return res.status(200).json({ status: true, message: "Banner deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting banner:", error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

export default {
  getBanners,
  createBanner,

  deleteBanner,
};
