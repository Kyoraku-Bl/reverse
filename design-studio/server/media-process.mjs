import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const resolveTool = (variable, pkg, fallback) => {
  if (process.env[variable]) return process.env[variable];
  try {
    return require(pkg).path;
  } catch {
    return fallback;
  }
};
export const tools = {
  ffmpeg: resolveTool("FFMPEG_PATH", "@ffmpeg-installer/ffmpeg", "ffmpeg"),
  ffprobe: resolveTool("FFPROBE_PATH", "@ffprobe-installer/ffprobe", "ffprobe"),
};
export const allowedFormats = "mov,matroska,webm,mp3,wav,ogg,flac,aac";
export function runMedia(
  binary,
  args,
  {
    signal,
    timeout = 600000,
    onProgress,
    duration = 1,
    maxOutput = 1024 * 1024,
  } = {},
) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(
        Object.assign(new Error("Render cancelled"), { name: "AbortError" }),
      );
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    let stdout = "",
      stderr = "",
      pending = "",
      reason = null,
      killTimer;
    const kill = (sig) => {
      try {
        if (process.platform === "win32") child.kill(sig);
        else if (child.pid) process.kill(-child.pid, sig);
      } catch (error) {
        if (error.code !== "ESRCH") stderr += "\n" + error.message;
      }
    };
    const terminate = (message) => {
      if (reason) return;
      reason = message;
      kill("SIGTERM");
      killTimer = setTimeout(() => kill("SIGKILL"), 2500);
      killTimer.unref();
    };
    const abort = () => terminate("cancelled");
    signal?.addEventListener("abort", abort, { once: true });
    // Handles aborts occurring between the initial check and listener registration.
    if (signal?.aborted) abort();
    const timer = setTimeout(() => terminate("timeout"), timeout);
    timer.unref();
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      if (stdout.length < maxOutput)
        stdout = (stdout + text).slice(0, maxOutput);
      if (onProgress) {
        pending += text;
        const lines = pending.split("\n");
        pending = lines.pop().slice(-500);
        for (const line of lines)
          if (line.startsWith("out_time_ms=")) {
            const seconds = Number(line.slice(12)) / 1000000;
            if (Number.isFinite(seconds))
              onProgress(Math.max(0, Math.min(1, seconds / duration)));
          }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-16000);
    });
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", abort);
    };
    child.once("error", (error) => {
      cleanup();
      reject(new Error("Media tool unavailable: " + error.message));
    });
    child.once("close", (code) => {
      cleanup();
      if (reason === "cancelled")
        return reject(
          Object.assign(new Error("Render cancelled"), { name: "AbortError" }),
        );
      if (reason === "timeout")
        return reject(new Error("Media processing timed out"));
      if (code !== 0)
        return reject(
          new Error(
            "The media file could not be processed. " + stderr.slice(-1500),
          ),
        );
      resolve({ stdout, stderr });
    });
  });
}
export async function inspectMedia(file, { signal } = {}) {
  const { stdout } = await runMedia(
    tools.ffprobe,
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-format_whitelist",
      allowedFormats,
      "-analyzeduration",
      "5000000",
      "-probesize",
      "5000000",
      "-show_entries",
      "format=duration,format_name:stream=codec_type,width,height,duration",
      "-of",
      "json",
      file,
    ],
    { signal, timeout: 20000 },
  );
  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    throw new Error("Could not read media metadata");
  }
  const video = data.streams?.find((s) => s.codec_type === "video");
  const audio = data.streams?.find((s) => s.codec_type === "audio");
  const duration = Number(
    data.format?.duration || video?.duration || audio?.duration,
  );
  if (
    !Number.isFinite(duration) ||
    duration < 0.1 ||
    duration > 1800 ||
    (!video && !audio)
  )
    throw new Error(
      "Use a playable video or audio file between 0.1 seconds and 30 minutes",
    );
  if (
    video &&
    (!video.width ||
      !video.height ||
      video.width > 4096 ||
      video.height > 4096 ||
      video.width * video.height > 16777216)
  )
    throw new Error("Input video supports up to 4096 px per side");
  return {
    duration,
    width: video?.width || 0,
    height: video?.height || 0,
    hasVideo: !!video,
    hasAudio: !!audio,
    format: data.format.format_name,
  };
}
