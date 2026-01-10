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

// Optional: file filter & size limit
export const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images are allowed"), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// ✅ Get all POPs
export const getPops = async (req, res) => {
  try {
    const [rows] = await connection.execute(
      "SELECT * FROM popups WHERE is_active = 1 ORDER BY created_at DESC"
    );

    return res.status(200).json({
      status: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching popups:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message, // 👈 return actual error message
    });
  }
};


// ✅ Create POP
export const createPop = async (req, res) => {
  try {
    const { page_name } = req.body;
    const file = req.file;

    if (!page_name?.trim() || !file) {
      return res.status(400).json({ status: false, message: "Page name and image required" });
    }

    const imageUrl = `/uploads/${file.filename}`;

    const [result] = await connection.execute(
      "INSERT INTO popups (page_name, image, created_at) VALUES (?, ?, NOW())",
      [page_name.trim(), imageUrl]
    );

    res.status(201).json({
      status: true,
      message: "POP created successfully",
      id: result.insertId,
      fileUrl: imageUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

// ✅ Update POP
export const updatePop = async (req, res) => {
  try {
    const { id } = req.params;
    const { page_name } = req.body;
    const file = req.file;

    if (!id) return res.status(400).json({ status: false, message: "POP ID required" });

    const [rows] = await connection.execute("SELECT * FROM popups WHERE pop_id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ status: false, message: "POP not found" });

    const pop = rows[0];
    const updatedPageName = page_name?.trim() || pop.page_name;
    const updatedImage = file ? `/uploads/${file.filename}` : pop.image;

    // Delete old image if replaced
    if (file && pop.image) {
      const oldFilePath = path.join("src", "public", pop.image);
      if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
    }

    await connection.execute(
      "UPDATE popups SET page_name = ?, image = ?, updated_at = NOW() WHERE pop_id = ?",
      [updatedPageName, updatedImage, id]
    );

    res.status(200).json({
      status: true,
      message: "POP updated successfully",
      fileUploaded: !!file,
      fileUrl: updatedImage
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

// ✅ Delete POP
export const deletePop = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) return res.status(400).json({ status: false, message: "POP ID required" });

    const [rows] = await connection.execute("SELECT * FROM popups WHERE pop_id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ status: false, message: "POP not found" });

    const pop = rows[0];

    // Delete DB record
    await connection.execute("DELETE FROM popups WHERE pop_id = ?", [id]);

    // Delete image from server
    if (pop.image) {
      const filePath = path.join("src", "public", pop.image);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.status(200).json({ status: true, message: "POP deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

export default {
  getPops,
  createPop,
  updatePop,
  deletePop,
};
