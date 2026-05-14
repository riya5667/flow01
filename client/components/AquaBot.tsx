"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, User, Paperclip, Loader2, Mic, MicOff, Volume2, VolumeX, Sparkles, MessageCircle, StopCircle } from 'lucide-react';

type Message = { role: 'user' | 'bot'; text: string; isTyping?: boolean };

export default function AquaBot({ context }: { context: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    role: 'bot', text: 'Hello! I am AquaBot, your AI water intelligence assistant. How can I help you today?'
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const typewriterEffect = useCallback((fullText: string) => {
    setIsTyping(true);
    let i = 0;
    
    // Start voice immediately if enabled
    if (voiceMode && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(fullText);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }

    setMessages(prev => [...prev, { role: 'bot', text: '', isTyping: true }]);

    typingIntervalRef.current = setInterval(() => {
      i++;
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'bot') {
          updated[lastIdx] = { ...updated[lastIdx], text: fullText.slice(0, i) };
        }
        return updated;
      });

      if (i >= fullText.length) {
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        setIsTyping(false);
        setMessages(prev => prev.map(m => m.isTyping ? { ...m, isTyping: false } : m));
      }
    }, 25);
  }, [voiceMode]);

  const performSend = useCallback(async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/aquabot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, context }),
      });
      const data = await res.json();
      setLoading(false);
      typewriterEffect(data.reply);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, I am having trouble connecting to the network.' }]);
      setLoading(false);
    }
  }, [loading, context, typewriterEffect]);

  const sendMessage = () => performSend(input);

  const startListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) { alert('Speech recognition not supported in this browser.'); return; }
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => performSend(event.results[0][0].transcript);
    recognition.start();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/rag/ingest', { method: 'POST', body: formData });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: res.ok ? `✅ ${data.message}` : `❌ ${data.error}` }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: '❌ Failed to upload document.' }]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isBusy = loading || isTyping;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 text-white rounded-full flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-110 z-50 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        style={{ background: 'linear-gradient(135deg, #38d4e8, #0f6f7a)' }}
      >
        <MessageCircle size={26} fill="rgba(255,255,255,0.2)" />
      </button>

      <div className={`fixed bottom-6 right-6 w-80 md:w-96 h-[560px] max-h-[85vh] rounded-2xl shadow-2xl flex flex-col z-50 transition-all duration-300 origin-bottom-right overflow-hidden border border-slate-200 ${isOpen ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'}`}
        style={{ background: '#ffffff' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ background: 'linear-gradient(135deg, #0f6f7a, #0d5a63)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">AquaBot</p>
              <p className="text-cyan-100 text-xs mt-0.5">Indore Smart Water Assistant</p>
            </div>
            {isBusy && (
              <span className="flex gap-1 ml-2 items-center">
                <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setVoiceMode(v => !v); if (voiceMode) { window.speechSynthesis?.cancel(); setIsSpeaking(false); } }}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              title={voiceMode ? 'Mute voice' : 'Enable voice'}>
              {voiceMode ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors">
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50" style={{ scrollbarWidth: 'thin' }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'bot' && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-cyan-100 border border-cyan-200">
                  <Sparkles size={13} className="text-cyan-600" />
                </div>
              )}
              <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'text-white rounded-tr-sm bg-[#0f6f7a]'
                  : 'text-slate-700 rounded-tl-sm bg-white border border-slate-200'
              }`}>
                {msg.text}
                {msg.isTyping && (
                  <span className="inline-block w-0.5 h-4 bg-cyan-500 ml-0.5 align-middle animate-pulse" />
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-slate-200">
                  <User size={13} className="text-slate-600" />
                </div>
              )}
            </div>
          ))}
          {loading && !isTyping && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-cyan-100 border border-cyan-200">
                <Sparkles size={13} className="text-cyan-600" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1.5 items-center bg-white border border-slate-200 shadow-sm">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="px-3 py-3 shrink-0 bg-white border-t border-slate-200">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-100 border border-slate-200 focus-within:border-cyan-500 transition-all">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.md,.json,.pdf" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading || isBusy}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 transition-colors disabled:opacity-40"
              title="Upload knowledge document">
              {uploading ? <Loader2 size={17} className="animate-spin text-cyan-600" /> : <Paperclip size={17} />}
            </button>
            <button onClick={isListening ? undefined : startListening} disabled={isBusy}
              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-cyan-600'}`}
              title="Voice input">
              {isListening ? <Mic size={17} /> : <MicOff size={17} />}
            </button>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isBusy && sendMessage()}
              placeholder={isListening ? 'Listening...' : 'Ask AquaBot...'}
              disabled={isBusy}
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder-slate-400 py-1.5"
            />
            {isSpeaking ? (
              <button 
                onClick={() => {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                }}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Stop Speaking"
              >
                <StopCircle size={18} />
              </button>
            ) : (
              <button onClick={sendMessage} disabled={!input.trim() || isBusy}
                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 transition-colors disabled:opacity-40"
                title="Send"
              >
                <Send size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
