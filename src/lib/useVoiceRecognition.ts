"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseVoiceRecognitionResult {
  isRecording: boolean;
  interimText: string;
  voiceError: string | null;
  toggle: () => void;
  reset: () => void;
}

/**
 * 中文語音辨識 hook（zh-TW,continuous:false,interimResults:true）。
 * 辨識到 final → 呼叫 onResult(finalText)。
 * 補抓 fallback：語音引擎偶爾不發 final 就 end，最後一個 result 仍會寫入。
 */
export function useVoiceRecognition(onResult: (text: string) => void): UseVoiceRecognitionResult {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // 用 ref 讓 onResult 不需進依賴,避免父層每次重建 callback 導致 toggle 換 ref
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const toggle = useCallback(() => {
    const W = window as any;
    const SpeechRecognition = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("此瀏覽器不支援語音輸入，建議使用桌面 Chrome");
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "zh-TW";
    recognition.continuous = false;
    recognition.interimResults = true;
    setIsRecording(true);
    setInterimText("");
    setVoiceError(null);

    let finalTranscript = "";
    let interimTranscript = "";
    let lastTranscript = "";

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        lastTranscript = piece;
        if (event.results[i].isFinal) finalTranscript += piece;
        else interimTranscript += piece;
      }
      setInterimText(interimTranscript);
      if (finalTranscript) {
        onResultRef.current(finalTranscript.trim());
        finalTranscript = "";
      }
    };

    recognition.onerror = (e: any) => {
      const msg: Record<string, string> = {
        "no-speech": "沒聽到語音，請再試一次",
        "audio-capture": "找不到麥克風，請確認權限",
        "not-allowed": "麥風權限被拒絕",
        "network": "網路錯誤，語音辨識失敗",
      };
      setVoiceError(msg[e.error] || `語音辨識錯誤:${e.error}`);
      setInterimText("");
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText("");
      recognitionRef.current = null;
      if (!finalTranscript.trim() && lastTranscript.trim()) {
        onResultRef.current(lastTranscript.trim());
      }
    };

    try {
      recognition.start();
    } catch (e) {
      setVoiceError("無法啟動語音輸入");
      setIsRecording(false);
      recognitionRef.current = null;
    }
  }, [isRecording]);

  const reset = useCallback(() => {
    setVoiceError(null);
    setInterimText("");
  }, []);

  return { isRecording, interimText, voiceError, toggle, reset };
}
