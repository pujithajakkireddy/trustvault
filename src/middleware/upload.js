
const multer = require("multer");

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES = {
  "application/pdf": {
    extension: ".pdf",
    signature: (buffer) =>
      buffer.subarray(0, 5).toString("ascii") === "%PDF-",
  },
  "image/png": {
    extension: ".png",
    signature: (buffer) =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      ),
  },
  "image/jpeg": {
    extension: ".jpg",
    signature: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 10,
    fieldSize: 10 * 1024,
  },
});

function validateUploadedFile(req, res, next) {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      error: "Please select a file to upload.",
    });
  }

  const detectedType = Object.entries(ALLOWED_TYPES).find(
    ([, rule]) => rule.signature(file.buffer)
  );

  if (!detectedType) {
    return res.status(400).json({
      error: "Unsupported or invalid file content. Upload a PDF, PNG, or JPEG.",
    });
  }

  const [mimeType, rule] = detectedType;
  const originalName = file.originalname.toLowerCase();

  if (
    file.mimetype !== mimeType ||
    !originalName.endsWith(rule.extension) &&
      !(mimeType === "image/jpeg" && originalName.endsWith(".jpeg"))
  ) {
    return res.status(400).json({
      error: "The file extension, content, and MIME type must match.",
    });
  }

  req.validatedFile = {
    buffer: file.buffer,
    mimeType,
    originalName: file.originalname,
    size: file.size,
  };

  next();
}

module.exports = {
  upload,
  validateUploadedFile,
  MAX_FILE_SIZE,
};
