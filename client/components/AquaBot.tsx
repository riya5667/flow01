"use client";
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Paperclip, Loader2, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

export default function AquaBot({ context }: { context: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'bot', text: string}[]>([{
    role: 'bot', text: 'Hello! I am AquaBot. How can I help you with your water data today?'
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const performSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/aquabot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, context })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
      
      if (voiceMode && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(data.reply);
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, I am having trouble connecting to the network.' }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = () => performSend(input);

  const startListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      performSend(transcript);
    };
    recognition.start();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/rag/ingest', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'bot', text: `Success: ${data.message}` }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: `Error: ${data.error}` }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Failed to upload document.' }]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 z-50 ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <MessageSquare size={24} />
      </button>

      <div className={`fixed bottom-6 right-6 w-80 md:w-96 h-[500px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'}`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-4 rounded-t-2xl flex items-center justify-between shadow-md z-10">
          <div className="flex items-center gap-2">
            <Bot size={20} />
            <h3 className="font-bold">AquaBot (IA)</h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => {
                setVoiceMode(!voiceMode);
                if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
              }} 
              className="hover:bg-white/20 p-1 rounded-lg transition-colors"
              title={voiceMode ? "Mute Voice" : "Enable Voice"}
            >
              {voiceMode ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Chat window */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-slate-300' : 'bg-indigo-100 text-indigo-600'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md' : 'bg-white border border-slate-200 rounded-tl-sm text-slate-700 shadow-sm'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="self-start flex gap-2 max-w-[85%]">
               <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><Bot size={16} /></div>
               <div className="p-3 bg-white border border-slate-200 rounded-2xl rounded-tl-sm text-slate-400 text-sm flex gap-1 items-center">
                 <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></span>
                 <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                 <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-white border-t border-slate-200 rounded-b-2xl">
          <div className="flex items-center gap-2 bg-slate-100 p-1 pl-2 rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".txt,.md,.json,.pdf" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2 text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-50"
              title="Upload Knowledge Document"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            <button 
              onClick={isListening ? undefined : startListening}
              className={`p-2 transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-500 hover:text-indigo-600'}`}
              title="Voice Input"
            >
              {isListening ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask the AI a question..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 py-1 pl-1"
            />
            <button 
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
