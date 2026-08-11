const express = require("express");
const cors = require("cors");
const multer = require("multer");
const helmet = require('helmet');

require("dotenv").config();

const { sanitizeProject } = require("./utils/securityFilter");
const { analyzeProject } = require("./src/services/groqservice");

const app = express();

app.use(cors());
app.use(express.json());
app.use(helmet());

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 1000,
        fileSize: 2 * 1024 * 1024,
        fieldSize: 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.txt|\.pdf|\.docx$/)) {
            return cb(new Error('Only .txt, .pdf, and .docx files are allowed!'));
        }
        cb(null, true);
    }
});

app.get("/", (req, res) => {
    res.json({ message: "SecureCode AI backend is running" });
});

app.post(
    "/api/project/upload",
    upload.array("project", 500),
    (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: "No project files received." });
            }

            const sanitizedFiles = sanitizeProject(req.files);

            res.json({
                message: "Project sanitized successfully.",
                originalFileCount: req.files.length,
                analyzedFileCount: sanitizedFiles.length,
                files: sanitizedFiles
            });

        } catch (error) {
            console.error("Project processing error:", error);
            res.status(500).json({ message: "Failed to process project." });
        }
    }
);

app.post(
    "/api/project/scan",
    upload.array("project", 500),
    async (req, res) => {
        try {
            if (!req.files?.length) {
                return res.status(400).json({ message: "No project files uploaded." });
            }

            const sanitizedFiles = sanitizeProject(req.files);

            if (sanitizedFiles.length === 0) {
                return res.status(400).json({
                    message: "No analyzable files found after filtering. Make sure your project contains supported source files."
                });
            }

            console.log(`Analyzing ${sanitizedFiles.length} files...`);

            const report = await analyzeProject(sanitizedFiles);

            return res.json(report);

        } catch (error) {
            console.error("Scan error:", error.message);

            // Map known error codes to user-friendly HTTP responses
            const codeToStatus = {
                RATE_LIMIT: 429,
                TOO_LARGE:  413,
                AUTH_ERROR: 401
            };

            const status = codeToStatus[error.code] || 500;

            return res.status(status).json({
                message: error.message || "Failed to analyze project. Please try again."
            });
        }
    }
);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});