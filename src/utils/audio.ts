// Audio utilities: TTS, Speech Recognition, and UI sound effects

export function speakEnglish(text: string, rate: number = 0.9): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      resolve();
      return;
    }

    // Cancel ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate; // 0.8 for slow, 1.0 for normal
    utterance.pitch = 1.0;

    // Pick natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(
      (v) => (v.lang === 'en-US' || v.lang.startsWith('en')) && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Siri'))
    ) || voices.find((v) => v.lang.startsWith('en'));

    if (enVoice) {
      utterance.voice = enVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

// Reuse one context instead of allocating a hardware audio resource on every tap.
let effectsContext: AudioContext | undefined;

// Play sound effect using Web Audio API
export function playSfx(type: 'shutter' | 'pop' | 'chime' | 'success') {
  try {
    const ctx = effectsContext ||= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    if (type === 'pop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'shutter') {
      // Camera mechanical shutter double click
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      noise.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } else if (type === 'chime' || type === 'success') {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.07);
        osc.stop(ctx.currentTime + idx * 0.07 + 0.25);
      });
    }
  } catch (e) {
    // Audio context may fail if blocked by browser policy before user interaction
  }
}

// Levenshtein distance for speech accuracy
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = str2.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;
  if (s1.includes(s2) || s2.includes(s1)) return 85;

  const track = Array(s2.length + 1)
    .fill(null)
    .map(() => Array(s1.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  const distance = track[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  const similarity = Math.round((1 - distance / maxLen) * 100);
  return Math.max(0, Math.min(100, similarity));
}

// Start browser Speech Recognition
export function recordAndEvaluateSpeech(
  targetWord: string,
  onStart: () => void,
  onResult: (result: { recognizedText: string; score: number; feedback: string }) => void,
  onError: (errorMsg: string) => void
): { stop: () => void } {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError('此瀏覽器尚未支援即時口說辨識，請使用 Chrome 或 Safari 測試！');
    return { stop: () => {} };
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      onStart();
    };

    recognition.onresult = (event: any) => {
      const spokenText = event.results[0][0].transcript;
      const score = calculateSimilarity(spokenText, targetWord);

      let feedback = '再試一次看看！繼續加油！💪';
      if (score >= 85) {
        feedback = '太棒了！標準完美的發音！🎉';
        playSfx('success');
      } else if (score >= 60) {
        feedback = '很不錯！發音很接近了！👍';
        playSfx('pop');
      }

      onResult({
        recognizedText: spokenText,
        score,
        feedback,
      });
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        onError('沒有收到聲音，請靠近麥克風再試一次');
      } else if (event.error === 'not-allowed') {
        onError('請允許麥克風權限以進行口說練習');
      } else {
        onError(`辨識發生問題: ${event.error}`);
      }
    };

    recognition.start();

    return {
      stop: () => {
        try {
          recognition.stop();
        } catch (e) {}
      },
    };
  } catch (err: any) {
    onError(err?.message || '無法啟動語音辨識');
    return { stop: () => {} };
  }
}
