const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const {
    sanitizeProject
} = require("./utils/securityFilter");

const {
    analyzeProject
} = require("./src/services/groqservice");

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
    files: 1000,
    fileSize: 2 * 1024 * 1024,
    fieldSize: 1024 * 1024
}
});

app.get("/", (req, res) => {
    res.json({
        message: "SecureCode AI backend is running "
    });
});

app.post(
    "/api/project/upload",
    upload.array('project', 500, { fileFilter: (req, file, cb) => { if (!file.originalname.match(/.(js|jsx|ts|tsx|java|kt|py|php|c|cpp|h|cs|go|rs|rb|swift|sql|html|css|scss|json|xml|yml|yaml|properties|conf)$/)) { return cb(new Error('Only specific file types are allowed')) } cb(null, true) } }),

    (req, res) => {
        try {

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    message: "No project files received."
                });
            }

            console.log(
                `Received ${req.files.length} files`
            );

            const sanitizedFiles =
                sanitizeProject(req.files);

            console.log(
                `Files selected for analysis: ${sanitizedFiles.length}`
            );

            res.json({
                message: "Project sanitized successfully.",
                originalFileCount: req.files.length,
                analyzedFileCount: sanitizedFiles.length,
                files: sanitizedFiles
            });

        } catch (error) {

            console.error(
                "Project processing error:",
                error
            );

            res.status(500).json({
                message: "Failed to process project."
            });
        }
    }
);
app.post(
    "/api/project/scan",
    upload.array("project", 500),

    async (req, res) => {

        try {

            if (!req.files?.length) {
                return res.status(400).json({
                    message: "No project files uploaded"
                });
            }

            const sanitizedFiles =
                sanitizeProject(req.files);

            console.log(
                `Analyzing ${sanitizedFiles.length} files`
            );

            const report =
                await analyzeProject(
                    sanitizedFiles
                );

            return res.json(report);

        } catch (error) {

            console.error(error);

            return res.status(500).json({
                message:
                    "Failed to analyze project"
            });
        }
    }
);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(
        `Server running on http://localhost:${PORT}`
    );
});