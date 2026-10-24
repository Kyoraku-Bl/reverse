// Owns microphone/recognition lifecycles independently of view re-renders.
// A late permission grant after navigation is released, never retained.
export class SpeechCapture {
  constructor({
    onChange = () => {},
    onTranscript = () => {},
    onRecording = () => {},
    onError = () => {},
    env = globalThis,
  } = {}) {
    Object.assign(this, { onChange, onTranscript, onRecording, onError, env });
    this.generation = 0;
    this.kind = "idle";
    this.stream = null;
    this.recorder = null;
    this.recognition = null;
    this.timer = null;
  }
  change(kind) {
    this.kind = kind;
    this.onChange(kind);
  }
  clearTimer() {
    if (this.timer) this.env.clearTimeout(this.timer);
    this.timer = null;
  }
  releaseStream() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
  cancel() {
    this.generation++;
    this.clearTimer();
    const recognition = this.recognition;
    this.recognition = null;
    try {
      recognition?.abort();
    } catch {
      /* already ended */
    }
    const recorder = this.recorder;
    this.recorder = null;
    try {
      if (recorder?.state !== "inactive") recorder?.stop();
    } catch {
      /* already ended */
    }
    this.releaseStream();
    this.change("idle");
  }
  finish() {
    if (this.kind === "recording") {
      try {
        this.recorder.stop();
        this.releaseStream();
      } catch {
        this.cancel();
      }
    } else if (this.kind === "recognizing") {
      try {
        this.recognition.stop();
      } catch {
        this.cancel();
      }
    } else this.cancel();
  }
  microphoneContextAllowed() {
    if (this.env.isSecureContext === false) {
      this.onError(
        "Microphone access requires HTTPS. Open the public Bloom site in a new tab, then try Record again.",
      );
      return false;
    }
    const policy =
      this.env.document?.permissionsPolicy || this.env.document?.featurePolicy;
    if (policy?.allowsFeature && !policy.allowsFeature("microphone")) {
      this.onError(
        "This page or embedded preview blocks microphone access. Open the public Bloom site directly in a new tab to record.",
      );
      return false;
    }
    return true;
  }
  async record() {
    if (this.kind !== "idle" || !this.microphoneContextAllowed()) return;
    if (
      !this.env.navigator?.mediaDevices?.getUserMedia ||
      !this.env.MediaRecorder
    ) {
      this.onError(
        "Recording is not supported here. Use the public HTTPS site in a recent browser.",
      );
      return;
    }
    const token = ++this.generation;
    this.change("requesting");
    try {
      const stream = await this.env.navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (token !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      const recorder = new this.env.MediaRecorder(stream),
        chunks = [];
      this.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (token === this.generation && event.data.size)
          chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (token !== this.generation) return;
        this.clearTimer();
        this.releaseStream();
        this.recorder = null;
        this.change("idle");
        const blob = new this.env.Blob(chunks, {
          type: recorder.mimeType || chunks[0]?.type || "audio/webm",
        });
        if (blob.size) this.onRecording(blob);
        else
          this.onError(
            "No audio was captured. Check your microphone and try again.",
          );
      };
      recorder.onerror = () => {
        if (token !== this.generation) return;
        this.cancel();
        this.onError(
          "Recording could not continue. Check microphone permissions and try again.",
        );
      };
      recorder.start();
      this.change("recording");
      this.timer = this.env.setTimeout(() => this.finish(), 90000);
    } catch (error) {
      if (token !== this.generation) return;
      this.cancel();
      this.onError(
        {
          NotAllowedError:
            "Microphone permission was denied. Allow Microphone in the site controls beside the address bar, check your device’s privacy settings, then press Record again.",
          NotFoundError:
            "No microphone was found. Connect or enable a microphone, check your device’s audio input, then press Record again.",
          NotReadableError:
            "Your microphone could not be opened. Close other recording apps, check your device’s microphone permissions, then try again.",
          SecurityError:
            "Your browser or device blocks microphone access. Open the public HTTPS site directly and check microphone permissions.",
        }[error?.name] ||
          "Could not access the microphone. Check device settings or try another browser.",
      );
    }
  }
  recognize(locale) {
    if (this.kind !== "idle" || !this.microphoneContextAllowed()) return;
    const Recognition =
      this.env.SpeechRecognition || this.env.webkitSpeechRecognition;
    if (!Recognition) {
      this.onError(
        "Speech-to-text is unavailable in this browser. Try Chrome or Edge, or type your response instead.",
      );
      return;
    }
    const token = ++this.generation;
    try {
      const recognition = new Recognition();
      this.recognition = recognition;
      recognition.lang = locale;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        if (token !== this.generation) return;
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript || "")
          .join(" ");
        this.onTranscript(transcript.slice(0, 1200));
      };
      recognition.onerror = (event) => {
        if (token !== this.generation) return;
        this.cancel();
        const messages = {
          "not-allowed":
            "Speech permission was denied. Type your response, or enable microphone access in browser settings.",
          "service-not-allowed":
            "Your browser’s speech service is unavailable. Type or record for self-review instead.",
          "no-speech":
            "No speech was detected. Try a quieter place and speak a little closer to the microphone.",
          network:
            "Your browser’s speech service could not connect. Typed chat and local recording still work.",
          "audio-capture":
            "No working microphone was found. You can still type and listen.",
        };
        this.onError(
          messages[event.error] ||
            "Speech recognition ended. Please try again or type your response.",
        );
      };
      recognition.onend = () => {
        if (token !== this.generation) return;
        this.clearTimer();
        this.recognition = null;
        this.change("idle");
      };
      recognition.start();
      this.change("recognizing");
      this.timer = this.env.setTimeout(() => {
        this.cancel();
        this.onError(
          "Listening timed out. Start another short turn when you’re ready.",
        );
      }, 90000);
    } catch {
      this.cancel();
      this.onError(
        "Speech recognition could not start. Try typing or local recording instead.",
      );
    }
  }
}
