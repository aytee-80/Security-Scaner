import { useState } from "react";
import "./App.css";

const IGNORED_DIRECTORIES = [
  "node_modules", ".git", ".next", "dist", "build",
  "coverage", ".cache", ".expo", "__pycache__"
];

const IGNORED_FILES = [
  ".env", ".env.local", ".env.development", ".env.production",
  ".env.test", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"
];

const ALLOWED_EXTENSIONS = [
  ".js", ".jsx", ".ts", ".tsx", ".java", ".kt", ".py", ".php", ".c", ".cpp",
  ".h", ".cs", ".go", ".rs", ".rb", ".swift", ".sql", ".html", ".css",
  ".scss", ".json", ".xml", ".yml", ".yaml", ".properties", ".conf"
];

const API_URL = import.meta.env.VITE_API_URL;
/* ---------- helpers ---------- */

function shouldIncludeFile(file) {
  const relativePath = file.webkitRelativePath || file.name;
  const parts = relativePath.split("/");
  if (parts.some((part) => IGNORED_DIRECTORIES.includes(part))) return false;
  const fileName = parts[parts.length - 1];
  if (IGNORED_FILES.includes(fileName)) return false;
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return false;
  return ALLOWED_EXTENSIONS.includes(fileName.substring(lastDot).toLowerCase());
}

const getSeverityClass = (severity) => (severity ? severity.toLowerCase() : "low");

function getStatusLabel(status) {
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "LIKELY") return "Likely";
  if (status === "CONTEXT_DEPENDENT") return "Context dependent";
  return status || "Review";
}

function getScoreClass(score) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 50) return "warning";
  return "danger";
}

/* ---------- presentational ---------- */

function Section({ label, children }) {
  return (
    <div className="finding-section">
      <h4>{label}</h4>
      {children}
    </div>
  );
}

function CodeBlock({ label, code }) {
  return (
    <div className="code-section">
      {label && <div className="code-title">{label}</div>}
      <pre><code>{code}</code></pre>
    </div>
  );
}

function ChangeList({ label, items }) {
  return (
    <Section label={label}>
      {items.map((change, i) => (
        <div className="change" key={i}>
          <strong className="change-file">{change.file}</strong>
          {change.description && <p>{change.description}</p>}
          {change.code && <pre><code>{change.code}</code></pre>}
        </div>
      ))}
    </Section>
  );
}

/* ---------- app ---------- */

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [report, setReport] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [statusKind, setStatusKind] = useState("idle");
  const [isScanning, setIsScanning] = useState(false);
  const [showFiles, setShowFiles] = useState(false);

  function handleProjectSelect(event) {
    const files = Array.from(event.target.files || []);
    const filteredFiles = files.filter(shouldIncludeFile);
    setSelectedFiles(filteredFiles);
    setReport(null);
    setStatusKind("idle");
    setUploadStatus(
      `${filteredFiles.length} of ${files.length} files queued — ` +
      `${files.length - filteredFiles.length} excluded by ruleset`
    );
  }

  async function uploadProject() {
    if (selectedFiles.length === 0) {
      setStatusKind("error");
      setUploadStatus("Select a project directory first.");
      return;
    }

    try {
      setIsScanning(true);
      setReport(null);
      setStatusKind("busy");
      setUploadStatus("Uploading source tree and running analysis...");

      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("project", file, file.webkitRelativePath || file.name);
      });

      const response = await fetch(`${API_URL}/api/project/scan`, {
        method: "POST",
        body: formData,
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(data.message || "Project scan failed.");
      }

      if (!data || typeof data.securityScore !== "number" || !Array.isArray(data.vulnerabilities)) {
        throw new Error("The analyzer returned a malformed report.");
      }

      setReport(data);
      setStatusKind("ok");
      setUploadStatus("Analysis complete.");
    } catch (error) {
      setStatusKind("error");
      setUploadStatus(error.message || "Something went wrong while scanning.");
    } finally {
      setIsScanning(false);
    }
  }

  const countSeverity = (severity) =>
    report ? report.vulnerabilities.filter((v) => v.severity === severity).length : 0;

  return (
    <div className="app">
      <header className="navbar">
        <div className="brand">
          <span className="brand-name">SecureCode</span>
          <span className="brand-sub">static analysis</span>
        </div>
        <div className="nav-meta">
          <span className="dot" data-state={isScanning ? "busy" : "idle"} />
          {isScanning ? "analyzing" : "ready"}
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <p className="eyebrow">Source review</p>
          <h1>
            Find security weaknesses<br />
            before attackers do.
          </h1>
          <p className="hero-lead">
            Only two reponses are returned per scan so you might want to re upload the same folder mutiple times to get a more complete picture of the security posture of your project.
            Don't upload big files the ai is free plan has limited credits
          </p>
        </section>

        <section className="scanner-card">
          <div className="scanner-header">
            <div>
              <span className="section-label">01 Input</span>
              <h3>Select a project</h3>
            </div>
            <span className="mono-hint">{ALLOWED_EXTENSIONS.length} extensions supported</span>
          </div>

          <label className="folder-picker">
            <input
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleProjectSelect}
            />
            <span className="picker-icon-text">+</span>
            <strong>Choose project directory</strong>
            <span>Dependencies, lockfiles and environment files are excluded automatically</span>
          </label>

          {selectedFiles.length > 0 && (
            <>
              <div className="file-summary">
                <div>
                  <strong>{selectedFiles.length}</strong>
                  <span>files queued</span>
                </div>
                <button type="button" onClick={() => setShowFiles(!showFiles)}>
                  {showFiles ? "Hide manifest" : "View manifest"}
                </button>
              </div>

              {showFiles && (
                <div className="file-list">
                  {selectedFiles.map((file, index) => (
                    <div key={index}>
                      <span className="idx">{String(index + 1).padStart(3, "0")}</span>
                      {file.webkitRelativePath || file.name}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <button
            className="scan-button"
            onClick={uploadProject}
            disabled={isScanning || selectedFiles.length === 0}
          >
            {isScanning ? "Analyzing project..." : "Run security scan"}
          </button>

          {uploadStatus && (
            <div className="status" data-kind={statusKind}>
              {uploadStatus}
            </div>
          )}
        </section>

        {report && (
          <section className="report">
            <div className="report-header">
              <div className="report-header-text">
                <span className="section-label">02 Result</span>
                <h2>Security report</h2>
                <p>{report.summary}</p>
              </div>

              <div className={"score " + getScoreClass(report.securityScore)}>
                <span>{report.securityScore}</span>
                <small>/100</small>
                <label>Score</label>
              </div>
            </div>

            <div className="report-stats">
              {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => (
                <div key={level} className={getSeverityClass(level)}>
                  <strong>{countSeverity(level)}</strong>
                  <span>{level.charAt(0) + level.slice(1).toLowerCase()}</span>
                </div>
              ))}
            </div>

            <div className="findings">
              <div className="findings-title">
                <h3>Findings</h3>
                <span>{report.vulnerabilities.length} total</span>
              </div>

              {report.vulnerabilities.length === 0 ? (
                <div className="no-findings">
                  <div className="ok-icon">✓</div>
                  <h3>No significant vulnerabilities identified</h3>
                  <p>
                    The analysis did not surface material issues in the supplied source.
                    Re-run after any change to authentication, data access, or deployment config.
                  </p>
                </div>
              ) : (
                report.vulnerabilities.map((v, index) => (
                  <article className="finding" key={index}>
                    <div className="finding-body">
                      <div className="finding-meta">
                        <span className={"severity-badge " + getSeverityClass(v.severity)}>
                          {v.severity}
                        </span>
                        {v.category && <span className="category">{v.category}</span>}
                        {v.status && <span className="status-badge">{getStatusLabel(v.status)}</span>}
                        <span className="finding-index">#{String(index + 1).padStart(2, "0")}</span>
                      </div>

                      <h3>{v.title}</h3>

                      {(v.file || v.line) && (
                        <p className="file-location">
                          {v.file}{v.line && <span> : line {v.line}</span>}
                        </p>
                      )}

                      {v.vulnerableCode && (
                        <CodeBlock label="Vulnerable code" code={v.vulnerableCode} />
                      )}

                      {v.description && (
                        <Section label="What is wrong"><p>{v.description}</p></Section>
                      )}

                      {v.whyItMatters && (
                        <Section label="Why it matters"><p>{v.whyItMatters}</p></Section>
                      )}

                      {(v.whenItApplies || v.whenItDoesNotApply) && (
                        <div className="context-grid">
                          {v.whenItApplies && (
                            <div>
                              <h4>Applies when</h4>
                              <p>{v.whenItApplies}</p>
                            </div>
                          )}
                          {v.whenItDoesNotApply && (
                            <div>
                              <h4>Does not apply when</h4>
                              <p>{v.whenItDoesNotApply}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {v.dependencies?.length > 0 && (
                        <Section label="Dependencies">
                          <ul>{v.dependencies.map((d, i) => <li key={i}>{d}</li>)}</ul>
                        </Section>
                      )}

                      {v.implementationSteps?.length > 0 && (
                        <Section label="Implementation steps">
                          <ol>{v.implementationSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                        </Section>
                      )}

                      {v.codeChanges?.length > 0 && (
                        <ChangeList label="Code changes" items={v.codeChanges} />
                      )}

                      {v.configurationChanges?.length > 0 && (
                        <ChangeList label="Configuration changes" items={v.configurationChanges} />
                      )}

                      {v.deploymentRequirements?.length > 0 && (
                        <Section label="Deployment requirements">
                          <ul>{v.deploymentRequirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
                        </Section>
                      )}

                      {v.verificationSteps?.length > 0 && (
                        <div className="finding-section verification">
                          <h4>Verify the fix</h4>
                          <ol>{v.verificationSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                        </div>
                      )}

                      {v.commonMistakes?.length > 0 && (
                        <div className="finding-section mistakes">
                          <h4>Common mistakes</h4>
                          <ul>{v.commonMistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
                        </div>
                      )}

                      {v.recommendation && (
                        <div className="recommendation">
                          <h4>Recommended action</h4>
                          <p>{v.recommendation}</p>
                        </div>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <span>SecureCode</span>
        <span className="mono-hint">local filtering</span>
      </footer>
    </div>
  );
}

export default App;