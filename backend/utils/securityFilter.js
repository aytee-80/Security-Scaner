const path = require("path");

const IGNORED_DIRECTORIES = [
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "coverage",
    ".cache",
    ".expo",
    "__pycache__"
];

const IGNORED_FILES = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.test",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml"
];

const ALLOWED_EXTENSIONS = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".kt",
    ".py",
    ".php",
    ".c",
    ".cpp",
    ".h",
    ".cs",
    ".go",
    ".rs",
    ".rb",
    ".swift",
    ".sql",
    ".html",
    ".css",
    ".scss",
    ".json",
    ".xml",
    ".yml",
    ".yaml",
    ".properties",
    ".conf"
];

function shouldIgnoreFile(filePath) {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const parts = normalizedPath.split("/");

    if (
        parts.some(part =>
            IGNORED_DIRECTORIES.includes(part)
        )
    ) {
        return true;
    }

    const fileName = path.basename(normalizedPath);

    if (IGNORED_FILES.includes(fileName)) {
        return true;
    }

    const extension =
        path.extname(fileName).toLowerCase();

    return !ALLOWED_EXTENSIONS.includes(extension);
}

function redactSecrets(content) {

    let sanitized = content;

    // API keys
    sanitized = sanitized.replace(
        /(api[_-]?key|apikey)\s*[:=]\s*["'`](.*?)["'`]/gi,
        '$1="[REDACTED_SECRET]"'
    );

    // Tokens
    sanitized = sanitized.replace(
        /(token|accessToken|authToken)\s*[:=]\s*["'`](.*?)["'`]/gi,
        '$1="[REDACTED_TOKEN]"'
    );

    // Passwords
    sanitized = sanitized.replace(
        /(password|passwd|pwd)\s*[:=]\s*["'`](.*?)["'`]/gi,
        '$1="[REDACTED_PASSWORD]"'
    );

    // Bearer tokens
    sanitized = sanitized.replace(
        /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
        "Bearer [REDACTED_TOKEN]"
    );

    // AWS access keys
    sanitized = sanitized.replace(
        /\bAKIA[0-9A-Z]{16}\b/g,
        "[REDACTED_AWS_KEY]"
    );

    // Private keys
    sanitized = sanitized.replace(
        /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
        "[REDACTED_PRIVATE_KEY]"
    );

    return sanitized;
}

function sanitizeProject(files) {

    const sanitizedFiles = [];

    for (const file of files) {

        const filePath = file.originalname;

        if (shouldIgnoreFile(filePath)) {
            continue;
        }

        const content =
            file.buffer.toString("utf8");

        const sanitizedContent =
            redactSecrets(content);

        sanitizedFiles.push({
            name: filePath,
            size: file.size,
            content: sanitizedContent
        });
    }

    return sanitizedFiles;
}

module.exports = {
    shouldIgnoreFile,
    redactSecrets,
    sanitizeProject
};