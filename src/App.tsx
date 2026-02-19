import { useState, useEffect, useCallback, useRef } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import "./App.css";

type Mode = "home" | "video" | "audio";
type BinaryStatus = Record<string, boolean | string>;
type CompressionResult = {
  success: boolean;
  fileName: string;
  originalSizeMB: number;
  outputSizeMB: number;
  outputPath: string;
  error?: string;
};

const VIDEO_EXTS = ["mp4", "mkv", "avi", "mov", "flv", "wmv", "webm", "m4v"];
const AUDIO_EXTS = ["mp3", "wav", "flac", "m4a", "aac", "ogg", "wma"];
const BITRATES = ["16k", "32k", "64k", "128k", "256k", "320k"];

const getFileExt = (path: string) => {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.substring(dot + 1).toLowerCase() : "";
};

const classifyFile = (path: string): "video" | "audio" | "unknown" => {
  const ext = getFileExt(path);
  if (VIDEO_EXTS.includes(ext)) return "video";
  if (AUDIO_EXTS.includes(ext)) return "audio";
  return "unknown";
};

function App() {
  const [mode, setMode] = useState<Mode>("home");
  const [binaries, setBinaries] = useState<BinaryStatus>({});
  const [binariesChecked, setBinariesChecked] = useState(false);

  // Video state
  const [videoFiles, setVideoFiles] = useState<string[]>([]);
  const [presets, setPresets] = useState<Record<string, string[]>>({});
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [keepAudio, setKeepAudio] = useState(true);

  // Audio state
  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  const [selectedBitrate, setSelectedBitrate] = useState("128k");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitByMB, setSplitByMB] = useState(4);

  // Progress state
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [remainingTime, setRemainingTime] = useState("");
  const [results, setResults] = useState<CompressionResult[]>([]);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  // Install state
  const [installing, setInstalling] = useState<string | null>(null); // which dep is being installed
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [installError, setInstallError] = useState<string | null>(null);

  // Update state
  const [appVersion, setAppVersion] = useState<string>("");
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; body: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState("");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState<string | null>(null);

  // Track the active sidecar child so we can kill it if needed
  const activeChild = useRef<Awaited<ReturnType<Command<string>["spawn"]>> | null>(null);

  // ─── Helper — run a sidecar command and collect JSON stdout lines ───
  const runSidecar = useCallback(
    (
      args: string[],
      opts?: {
        onProgress?: (data: { file: string; percent: number; eta?: string }) => void;
        onFileDone?: (data: CompressionResult) => void;
      },
    ): Promise<CompressionResult[]> => {
      return new Promise(async (resolve, reject) => {
        const collected: CompressionResult[] = [];

        try {
          const command = Command.sidecar("binaries/hardbrake-core", args);

          command.stdout.on("data", (line: string) => {
            if (!line.trim()) return;
            try {
              const event = JSON.parse(line);
              switch (event.type) {
                case "progress":
                  opts?.onProgress?.(event);
                  break;
                case "file_done": {
                  const r: CompressionResult = {
                    success: event.success,
                    fileName: event.fileName,
                    originalSizeMB: event.originalSizeMB,
                    outputSizeMB: event.outputSizeMB,
                    outputPath: event.outputPath,
                    error: event.error,
                  };
                  collected.push(r);
                  opts?.onFileDone?.(r);
                  break;
                }
                case "done":
                  // The process will exit shortly
                  break;
                case "error":
                  reject(new Error(event.message));
                  break;
                case "result":
                  // Used for check-binaries / get-presets — resolve with data
                  resolve(event.data);
                  return;
              }
            } catch {
              // ignore non-JSON lines
            }
          });

          command.stderr.on("data", (line: string) => {
            console.error("[sidecar stderr]", line);
          });

          command.on("close", (data) => {
            activeChild.current = null;
            if (data.code !== 0 && collected.length === 0) {
              reject(new Error(`Sidecar exited with code ${data.code}`));
            } else {
              resolve(collected);
            }
          });

          command.on("error", (err) => {
            activeChild.current = null;
            reject(new Error(String(err)));
          });

          const child = await command.spawn();
          activeChild.current = child;
        } catch (err) {
          reject(err);
        }
      });
    },
    [],
  );

  // ─── Check binaries on mount ────────────────────────────
  const recheckBinaries = useCallback(() => {
    runSidecar(["check-binaries"])
      .then((data: any) => {
        setBinaries(data as BinaryStatus);
        setBinariesChecked(true);
      })
      .catch((err) => {
        console.error("Failed to check binaries:", err);
        setBinaries({ HandBrakeCLI: false, ffmpeg: false, pm: "" });
        setBinariesChecked(true);
      });
  }, [runSidecar]);

  useEffect(() => {
    recheckBinaries();
  }, [recheckBinaries]);

  // ─── Fetch app version on mount ────────────────────────
  useEffect(() => {
    getVersion().then(setAppVersion).catch(console.error);
  }, []);

  // ─── Check for updates on mount ────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const update = await check();
        if (update) {
          setUpdateAvailable({
            version: update.version,
            body: update.body ?? "",
          });
        }
      } catch (e) {
        console.error("Update check failed:", e);
      }
    })();
  }, []);

  const checkForUpdates = useCallback(async () => {
    try {
      setIsCheckingUpdate(true);
      setUpdateCheckResult(null);
      const update = await check();
      if (update) {
        setUpdateAvailable({
          version: update.version,
          body: update.body ?? "",
        });
      } else {
        setUpdateCheckResult("You're on the latest version!");
        setTimeout(() => setUpdateCheckResult(null), 4000);
      }
    } catch (e) {
      console.error("Update check failed:", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("404") || msg.includes("Not Found") || msg.includes("network") || msg.includes("fetch")) {
        setUpdateCheckResult("Update info not available yet. A new release may still be building.");
      } else {
        setUpdateCheckResult("Couldn't check for updates. Please try again later.");
      }
      setTimeout(() => setUpdateCheckResult(null), 6000);
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  const doUpdate = useCallback(async () => {
    try {
      setIsUpdating(true);
      setUpdateProgress("Checking...");
      const update = await check();
      if (!update) {
        setIsUpdating(false);
        setUpdateAvailable(null);
        return;
      }
      setUpdateProgress("Downloading...");
      await update.downloadAndInstall((progress) => {
        if (progress.event === "Started" && progress.data.contentLength) {
          setUpdateProgress(`Downloading (${(progress.data.contentLength / 1024 / 1024).toFixed(1)} MB)...`);
        } else if (progress.event === "Finished") {
          setUpdateProgress("Installing...");
        }
      });
      setUpdateProgress("Restarting...");
      await relaunch();
    } catch (e: any) {
      console.error("Update failed:", e);
      setIsUpdating(false);
      setUpdateProgress("");
    }
  }, []);

  // ─── Install a dependency via Homebrew ──────────────────
  const installDep = useCallback(
    async (depName: string) => {
      setInstalling(depName);
      setInstallLogs([]);
      setInstallError(null);

      try {
        await new Promise<void>(async (resolve, reject) => {
          try {
            const command = Command.sidecar("binaries/hardbrake-core", ["install-dep", depName]);

            command.stdout.on("data", (line: string) => {
              if (!line.trim()) return;
              try {
                const event = JSON.parse(line);
                switch (event.type) {
                  case "install_log":
                    setInstallLogs((prev) => [...prev.slice(-50), event.line]);
                    break;
                  case "install_done":
                    if (event.success) {
                      resolve();
                    } else {
                      reject(new Error(event.error ?? "Installation failed"));
                    }
                    break;
                  case "error":
                    reject(new Error(event.message));
                    break;
                }
              } catch {
                // non-JSON line
              }
            });

            command.stderr.on("data", (line: string) => {
              setInstallLogs((prev) => [...prev.slice(-50), line]);
            });

            command.on("close", (data) => {
              if (data.code !== 0) {
                reject(new Error(`Install process exited with code ${data.code}`));
              }
            });

            command.on("error", (err) => {
              reject(new Error(String(err)));
            });

            await command.spawn();
          } catch (err) {
            reject(err);
          }
        });
      } catch (err: any) {
        setInstallError(err?.message ?? String(err));
      }

      setInstalling(null);
      // Re-check binaries after install attempt
      recheckBinaries();
    },
    [recheckBinaries],
  );

  // ─── Drag and drop handling ─────────────────────────────
  const handleDroppedFiles = useCallback(
    (paths: string[]) => {
      setDragError(null);

      // Filter out unsupported files
      const classified = paths.map((p) => ({ path: p, type: classifyFile(p) }));
      const supported = classified.filter((c) => c.type !== "unknown");
      const unsupported = classified.filter((c) => c.type === "unknown");

      if (supported.length === 0) {
        setDragError("No supported video or audio files found in the dropped items.");
        return;
      }

      const types = new Set(supported.map((c) => c.type));

      if (types.size > 1) {
        setDragError("Mixed file types detected. Please drop either only video files or only audio files, not both.");
        return;
      }

      const fileType = supported[0].type;
      const filePaths = supported.map((c) => c.path);

      if (unsupported.length > 0) {
        // Silently ignore unsupported files but proceed with supported ones
      }

      if (fileType === "video") {
        if (!binaries["HandBrakeCLI"]) {
          setDragError("HandBrakeCLI is not installed. Cannot compress video files.");
          return;
        }
        setVideoFiles(filePaths);
        setMode("video");
        loadPresets();
      } else if (fileType === "audio") {
        if (!binaries["ffmpeg"]) {
          setDragError("ffmpeg is not installed. Cannot compress audio files.");
          return;
        }
        setAudioFiles(filePaths);
        setMode("audio");
      }
    },
    [binaries],
  );

  useEffect(() => {
    const unlistenDragEnter = listen("tauri://drag-enter", () => {
      if (!isCompressing) setIsDragging(true);
    });
    const unlistenDragLeave = listen("tauri://drag-leave", () => {
      setIsDragging(false);
    });
    const unlistenDrop = listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
      setIsDragging(false);
      if (!isCompressing && event.payload.paths) {
        handleDroppedFiles(event.payload.paths);
      }
    });

    return () => {
      unlistenDragEnter.then((fn) => fn());
      unlistenDragLeave.then((fn) => fn());
      unlistenDrop.then((fn) => fn());
    };
  }, [isCompressing, handleDroppedFiles]);

  const loadPresets = async () => {
    try {
      const p = (await runSidecar(["get-presets"])) as unknown as Record<string, string[]>;
      setPresets(p);
      const firstCat = Object.keys(p)[0];
      if (firstCat) {
        setSelectedCategory(firstCat);
        if (p[firstCat].length > 0) setSelectedPreset(p[firstCat][0]);
      }
    } catch (e) {
      console.error("Failed to load presets:", e);
    }
  };

  const pickVideoFiles = async () => {
    const files = await open({
      multiple: true,
      filters: [{ name: "Video", extensions: VIDEO_EXTS }],
    });
    if (files) {
      const paths = Array.isArray(files) ? files : [files];
      setVideoFiles(paths);
    }
  };

  const pickAudioFiles = async () => {
    const files = await open({
      multiple: true,
      filters: [{ name: "Audio", extensions: AUDIO_EXTS }],
    });
    if (files) {
      const paths = Array.isArray(files) ? files : [files];
      setAudioFiles(paths);
    }
  };

  const compressVideos = async () => {
    if (videoFiles.length === 0 || !selectedPreset) return;
    setIsCompressing(true);
    setResults([]);
    setProgress(0);

    try {
      const payload = JSON.stringify({
        files: videoFiles,
        preset: selectedPreset,
        keepAudio,
      });

      const allResults = await runSidecar(["compress-video", payload], {
        onProgress: (data) => {
          if (data.percent >= 0) setProgress(data.percent);
          setCurrentFile(data.file);
          setRemainingTime(data.eta ?? "");
        },
        onFileDone: (result) => {
          setResults((prev) => [...prev, result]);
          setProgress(0);
        },
      });

      setResults(allResults);
    } catch (e) {
      setResults([
        {
          success: false,
          fileName: "Compression failed",
          originalSizeMB: 0,
          outputSizeMB: 0,
          outputPath: "",
          error: String(e),
        },
      ]);
    }

    setIsCompressing(false);
  };

  const compressAudios = async () => {
    if (audioFiles.length === 0) return;
    setIsCompressing(true);
    setResults([]);
    setProgress(0);

    try {
      const payload = JSON.stringify({
        files: audioFiles,
        bitrate: selectedBitrate,
        ...(splitEnabled && splitByMB > 0 ? { splitByMB } : {}),
      });

      const allResults = await runSidecar(["compress-audio", payload], {
        onProgress: (data) => {
          if (data.percent >= 0) setProgress(data.percent);
          setCurrentFile(data.file);
          setRemainingTime("");
        },
        onFileDone: (result) => {
          setResults((prev) => [...prev, result]);
        },
      });

      setResults(allResults);
    } catch (e) {
      setResults([
        {
          success: false,
          fileName: "Compression failed",
          originalSizeMB: 0,
          outputSizeMB: 0,
          outputPath: "",
          error: String(e),
        },
      ]);
    }

    setIsCompressing(false);
  };

  const fileName = (p: string) => {
    // Handle both Unix (/) and Windows (\) separators
    const sep = p.includes("\\") ? "\\" : "/";
    return p.split(sep).pop() ?? p;
  };

  const dismissDragError = () => setDragError(null);

  // ─── Renders ───────────────────────────────────────────

  // Drag overlay (shown on all screens while dragging)
  const dragOverlay = isDragging && (
    <div className="drag-overlay">
      <div className="drag-overlay-content">
        <span className="drag-icon">&#128229;</span>
        <p>Drop video or audio files here</p>
      </div>
    </div>
  );

  // Drag error toast
  const dragErrorToast = dragError && (
    <div className="drag-error-toast">
      <p>{dragError}</p>
      <button className="toast-close" onClick={dismissDragError}>
        &times;
      </button>
    </div>
  );

  if (!binariesChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f0f0f]">
        {dragOverlay}
        <p className="text-base text-gray-500 animate-pulse">Checking system dependencies...</p>
      </main>
    );
  }

  const missingBinaries = Object.entries(binaries).filter(([k, v]) => !v && k !== "pm");
  const packageManager = String(binaries["pm"] || "");

  if (mode === "home") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0f0f0f] px-8 py-16">
        {dragOverlay}
        {dragErrorToast}

        {/* ─── Hero ─────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-4 mb-10">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">HardBrake</h1>
          <div className="flex items-center gap-3">
            <p className="text-lg text-gray-400">Video &amp; Audio Compression</p>
            {appVersion && <span className="rounded-md border border-gray-600 bg-transparent px-2.5 py-0.5 text-sm font-medium text-gray-400">v{appVersion}</span>}
          </div>
        </div>

        {/* ─── Update available banner ─────────────────── */}
        {updateAvailable && !isUpdating && (
          <div className="w-full max-w-lg rounded-xl border border-purple-500/30 bg-purple-500/10 p-5 mb-8 text-left">
            <p className="text-base text-gray-200 mb-4">
              <strong>Update available:</strong> v{appVersion} → v{updateAvailable.version}
            </p>
            <div className="flex gap-3">
              <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 transition-colors" onClick={doUpdate}>
                Update &amp; Restart
              </button>
              <button className="rounded-lg border border-gray-600 bg-transparent px-4 py-2 text-sm text-gray-400 hover:bg-white/8 transition-colors" onClick={() => setUpdateAvailable(null)}>
                Later
              </button>
            </div>
          </div>
        )}
        {isUpdating && (
          <div className="w-full max-w-lg rounded-xl border border-purple-500/20 bg-purple-500/8 p-5 mb-8">
            <p className="text-base text-gray-400">{updateProgress || "Updating..."}</p>
          </div>
        )}

        {/* ─── Check for updates ───────────────────────── */}
        {!updateAvailable && !isUpdating && (
          <div className="flex flex-col items-center gap-3 mb-8">
            <button
              className="rounded-lg border border-gray-600 bg-transparent px-5 py-2 text-sm text-gray-300 hover:bg-white/8 hover:border-gray-500 transition-colors disabled:opacity-40"
              onClick={checkForUpdates}
              disabled={isCheckingUpdate}
            >
              {isCheckingUpdate ? "Checking..." : "Check for Updates"}
            </button>
            {updateCheckResult && <span className="text-sm text-gray-500">{updateCheckResult}</span>}
          </div>
        )}

        {/* ─── Installing overlay ───────────────────────── */}
        {installing && (
          <div className="w-full max-w-lg rounded-xl border border-[#2a2a4a] bg-[#1a1a2e] p-6 mb-8">
            <h3 className="text-base font-semibold text-purple-400 mb-4">Installing {installing}...</h3>
            <div className="rounded-lg bg-black/60 p-4 max-h-48 overflow-y-auto font-mono text-xs leading-snug text-gray-500 mb-3">
              {installLogs.map((line, i) => (
                <p key={i} className="whitespace-pre-wrap break-all">
                  {line}
                </p>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500">This may take a few minutes</p>
          </div>
        )}

        {/* ─── Install error ───────────────────────────── */}
        {installError && (
          <div className="w-full max-w-lg rounded-lg border border-amber-500 bg-amber-950/40 p-5 mb-8 text-base">
            <p className="font-semibold mb-2">Installation failed:</p>
            <p className="text-gray-400 mb-3">{installError}</p>
            <button className="rounded-lg border border-gray-600 bg-transparent px-4 py-2 text-sm text-gray-400 hover:bg-white/8 transition-colors" onClick={() => setInstallError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* ─── Missing dependencies ────────────────────── */}
        {!installing && missingBinaries.length > 0 && (
          <div className="w-full max-w-lg rounded-lg border border-amber-500 bg-amber-950/40 p-5 mb-8 text-base">
            <p className="font-semibold mb-3">Missing dependencies:</p>
            {missingBinaries.map(([name]) => (
              <div key={name} className="flex items-center justify-between gap-3 mb-2">
                <span className="text-gray-400">
                  &bull; <code className="text-sm">{name}</code> not found.
                </span>
                {name === "HandBrakeCLI" ? (
                  <button
                    className="shrink-0 rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-500 transition-colors disabled:opacity-40"
                    onClick={() => installDep(name)}
                    disabled={!!installing}
                  >
                    Install from handbrake.fr
                  </button>
                ) : packageManager ? (
                  <button
                    className="shrink-0 rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-500 transition-colors disabled:opacity-40"
                    onClick={() => installDep(name)}
                    disabled={!!installing}
                  >
                    Install via {packageManager}
                  </button>
                ) : (
                  <a href="https://ffmpeg.org/download.html" target="_blank" className="text-sm text-amber-400 underline">
                    Manual download
                  </a>
                )}
              </div>
            ))}
            {!packageManager && (
              <p className="mt-3 text-sm text-gray-500">
                Install a package manager to enable one-click installation:{" "}
                <a href="https://brew.sh" target="_blank" className="text-purple-400 underline">
                  Homebrew
                </a>{" "}
                (macOS/Linux),{" "}
                <a href="https://learn.microsoft.com/en-us/windows/package-manager/winget/" target="_blank" className="text-purple-400 underline">
                  winget
                </a>{" "}
                (Windows), or{" "}
                <a href="https://chocolatey.org/install" target="_blank" className="text-purple-400 underline">
                  Chocolatey
                </a>{" "}
                (Windows).
              </p>
            )}
            {packageManager && missingBinaries.length > 1 && (
              <button
                className="mt-4 w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 transition-colors disabled:opacity-40"
                onClick={async () => {
                  for (const [name] of missingBinaries) {
                    await installDep(name);
                  }
                }}
                disabled={!!installing}
              >
                Install All
              </button>
            )}
          </div>
        )}

        {/* ─── Mode cards ──────────────────────────────── */}
        <div className="flex w-full max-w-2xl gap-5">
          <button
            className="flex-1 flex flex-col items-center gap-3 rounded-xl border border-[#2a2a4a] bg-[#1a1a2e] p-8 transition-all hover:bg-[#222240] hover:border-purple-500 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => {
              setMode("video");
              loadPresets();
            }}
            disabled={!binaries["HandBrakeCLI"]}
          >
            <span className="text-5xl">🎬</span>
            <span className="text-lg font-semibold text-gray-200">Compress Video</span>
            <span className="text-sm text-gray-500">HandBrakeCLI presets</span>
          </button>

          <button
            className="flex-1 flex flex-col items-center gap-3 rounded-xl border border-[#2a2a4a] bg-[#1a1a2e] p-8 transition-all hover:bg-[#222240] hover:border-purple-500 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => setMode("audio")}
            disabled={!binaries["ffmpeg"]}
          >
            <span className="text-5xl">🎵</span>
            <span className="text-lg font-semibold text-gray-200">Compress Audio</span>
            <span className="text-sm text-gray-500">ffmpeg bitrate control</span>
          </button>
        </div>

        <p className="mt-8 text-sm text-gray-600">or drag &amp; drop files anywhere</p>
      </main>
    );
  }

  // ─── Progress / Results overlay ─────────────────────────

  if (isCompressing) {
    return (
      <main className="container">
        <h2>Compressing...</h2>
        <p className="current-file">{currentFile}</p>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${Math.max(progress, 0)}%` }} />
        </div>
        <p className="progress-text">
          {progress >= 0 ? `${progress.toFixed(1)}%` : "Processing..."} {remainingTime && <span>&bull; ETA {remainingTime}</span>}
        </p>
      </main>
    );
  }

  if (results.length > 0) {
    return (
      <main className="container">
        <h2>Results</h2>
        <div className="results-list">
          {results.map((r, i) => (
            <div key={i} className={`result-card ${r.success ? "success" : "error"}`}>
              <p className="result-name">{r.fileName}</p>
              {r.success ? (
                <p className="result-detail">
                  {r.originalSizeMB} MB &rarr; {r.outputSizeMB} MB ({((1 - r.outputSizeMB / r.originalSizeMB) * 100).toFixed(0)}% smaller)
                </p>
              ) : (
                <p className="result-detail error-text">{r.error}</p>
              )}
            </div>
          ))}
        </div>
        <button
          className="btn primary"
          onClick={() => {
            setResults([]);
            setMode("home");
          }}
        >
          Done
        </button>
      </main>
    );
  }

  // ─── Video mode ─────────────────────────────────────────

  if (mode === "video") {
    return (
      <main className="container">
        {dragOverlay}
        {dragErrorToast}
        <button className="back-btn" onClick={() => setMode("home")}>
          &larr; Back
        </button>
        <h2>Video Compression</h2>

        <section className="section">
          <label>Files</label>
          <button className="btn" onClick={pickVideoFiles}>
            {videoFiles.length > 0 ? `${videoFiles.length} file(s) selected` : "Select video files"}
          </button>
          {videoFiles.length > 0 && (
            <ul className="file-list">
              {videoFiles.map((f, i) => (
                <li key={i}>{fileName(f)}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="section">
          <label>Preset Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              const ps = presets[e.target.value];
              if (ps && ps.length > 0) setSelectedPreset(ps[0]);
            }}
          >
            {Object.keys(presets).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </section>

        <section className="section">
          <label>Preset</label>
          <select value={selectedPreset} onChange={(e) => setSelectedPreset(e.target.value)}>
            {(presets[selectedCategory] ?? []).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </section>

        <section className="section row">
          <label>
            <input type="checkbox" checked={keepAudio} onChange={(e) => setKeepAudio(e.target.checked)} />
            Keep audio
          </label>
        </section>

        <button className="btn primary" disabled={videoFiles.length === 0 || !selectedPreset} onClick={compressVideos}>
          Compress {videoFiles.length} file{videoFiles.length !== 1 ? "s" : ""}
        </button>
      </main>
    );
  }

  // ─── Audio mode ─────────────────────────────────────────

  if (mode === "audio") {
    return (
      <main className="container">
        {dragOverlay}
        {dragErrorToast}
        <button className="back-btn" onClick={() => setMode("home")}>
          &larr; Back
        </button>
        <h2>Audio Compression</h2>

        <section className="section">
          <label>Files</label>
          <button className="btn" onClick={pickAudioFiles}>
            {audioFiles.length > 0 ? `${audioFiles.length} file(s) selected` : "Select audio files"}
          </button>
          {audioFiles.length > 0 && (
            <ul className="file-list">
              {audioFiles.map((f, i) => (
                <li key={i}>{fileName(f)}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="section">
          <label>Bitrate</label>
          <select value={selectedBitrate} onChange={(e) => setSelectedBitrate(e.target.value)}>
            {BITRATES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </section>

        <section className="section">
          <label className="checkbox-label">
            <input type="checkbox" checked={splitEnabled} onChange={(e) => setSplitEnabled(e.target.checked)} />
            Split output into smaller files
          </label>
          {splitEnabled && (
            <div className="split-input">
              <label>Max file size (MB)</label>
              <input type="number" min={1} max={100} value={splitByMB} onChange={(e) => setSplitByMB(Math.max(1, parseInt(e.target.value) || 1))} />
              <span className="hint">Each output file will be at most {splitByMB} MB</span>
            </div>
          )}
        </section>

        <button className="btn primary" disabled={audioFiles.length === 0} onClick={compressAudios}>
          Compress {audioFiles.length} file{audioFiles.length !== 1 ? "s" : ""}
        </button>
      </main>
    );
  }

  return null;
}

export default App;
