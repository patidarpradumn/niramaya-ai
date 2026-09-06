import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Send, Bot, User, Zap, Activity } from 'lucide-react';
import { mockAIMessages, mockAIResponses } from '../services/mock/mockData';
import type { AIMessage } from '../types';

// Intelligence Layer SVG background
function IntelligenceLayerBg() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">
      {/* Grid dots */}
      {Array.from({ length: 10 }).map((_, r) =>
        Array.from({ length: 20 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={c * 22 + 10} cy={r * 22 + 10} r="1" fill="#14B8A6" />
        ))
      )}
      {/* Connection lines */}
      <line x1="50" y1="30" x2="180" y2="80" stroke="#14B8A6" strokeWidth="0.5" />
      <line x1="180" y1="80" x2="300" y2="40" stroke="#14B8A6" strokeWidth="0.5" />
      <line x1="300" y1="40" x2="380" y2="120" stroke="#14B8A6" strokeWidth="0.5" />
      <line x1="100" y1="150" x2="220" y2="100" stroke="#14B8A6" strokeWidth="0.5" />
      <line x1="220" y1="100" x2="350" y2="160" stroke="#14B8A6" strokeWidth="0.5" />
      {/* Nodes */}
      {[[50,30],[180,80],[300,40],[380,120],[100,150],[220,100],[350,160]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#14B8A6" />
      ))}
    </svg>
  );
}

const SUGGESTED_PROMPTS = [
  'Which facilities currently show elevated shortage risk?',
  'Why is King Edward Memorial Hospital marked high risk?',
  'Where are potential redistribution opportunities?',
  'What resources are approaching expiry in the next 15 days?',
];

function getAIResponse(query: string): AIMessage {
  const q = query.toLowerCase();
  if (q.includes('redistribution') || q.includes('transfer') || q.includes('opportunities')) return { ...mockAIResponses.redistribution, id: Date.now().toString(), timestamp: new Date().toISOString() };
  if (q.includes('shortage') || q.includes('risk')) return { ...mockAIResponses.shortage, id: Date.now().toString(), timestamp: new Date().toISOString() };
  if (q.includes('expiry') || q.includes('expir')) return { ...mockAIResponses.expiry, id: Date.now().toString(), timestamp: new Date().toISOString() };
  return { ...mockAIResponses.default, id: Date.now().toString(), timestamp: new Date().toISOString() };
}

function MessageBubble({ msg }: { msg: AIMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-blue-600' : 'bg-teal-600'}`}>
        {isUser ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
      </div>
      <div className={`max-w-[80%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 text-sm ${isUser ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
          {msg.content}
        </div>
        {msg.structured && (
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 w-full">
            {msg.structured.summary && (
              <p className="text-xs font-semibold text-teal-800 mb-2">{msg.structured.summary}</p>
            )}
            {msg.structured.metrics && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                {msg.structured.metrics.map(m => (
                  <div key={m.label} className="bg-white rounded-lg p-2 border border-teal-100">
                    <p className="text-[10px] text-teal-600 font-medium">{m.label}</p>
                    <p className="text-xs font-bold text-gray-800">{m.value}</p>
                  </div>
                ))}
              </div>
            )}
            {msg.structured.confidence && (
              <div className="flex items-center gap-1.5 mt-1">
                <Zap size={11} className="text-amber-500" />
                <span className="text-[11px] text-amber-700 font-semibold">Confidence: {msg.structured.confidence}%</span>
              </div>
            )}
            {msg.structured.relatedFacilities && (
              <div className="mt-2">
                <p className="text-[10px] text-teal-600 font-semibold mb-1">Related Facilities:</p>
                <div className="flex flex-wrap gap-1">
                  {msg.structured.relatedFacilities.map(f => (
                    <span key={f} className="text-[10px] bg-white border border-teal-200 text-teal-700 px-1.5 py-0.5 rounded">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <span className="text-[10px] text-gray-400">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<AIMessage[]>(mockAIMessages);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);
    await new Promise(res => setTimeout(res, 1400));
    setIsThinking(false);
    setMessages(prev => [...prev, getAIResponse(text)]);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-h-[800px]">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-[#0D1526] to-[#1A2540] rounded-xl overflow-hidden mb-4 flex-shrink-0">
        <IntelligenceLayerBg />
        <div className="relative z-10 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center">
              <Bot size={20} className="text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-bold text-base">NIRAMAYA AI</h1>
                <div className="flex items-center gap-1 bg-teal-500/20 border border-teal-400/30 rounded-full px-2 py-0.5">
                  <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
                  <span className="text-[10px] text-teal-300 font-semibold">Active</span>
                </div>
              </div>
              <p className="text-blue-300/70 text-xs">Healthcare Intelligence Assistant</p>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 text-[11px] text-teal-300">
              <Activity size={12} />
              <span>1,248 facilities monitored</span>
            </div>
            <span className="text-[10px] text-blue-400/50">AI Decision Support Only — Not Medical Advice</span>
          </div>
        </div>
      </div>

      {/* Suggested prompts — shown when only 1 message (welcome) */}
      {messages.length <= 1 && (
        <div className="mb-4 flex-shrink-0">
          <p className="text-xs text-gray-500 mb-2 font-medium">Suggested queries:</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {SUGGESTED_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="text-left text-xs px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        {isThinking && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
              {[0, 0.15, 0.3].map(d => (
                <div key={d} className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: `${d}s` }} />
              ))}
              <span className="text-xs text-gray-400 ml-1">Analyzing healthcare network...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Disclaimer */}
      <div className="mt-3 mb-2 text-center flex-shrink-0">
        <p className="text-[11px] text-gray-400">NIRAMAYA AI provides decision support for healthcare administrators only. Not for medical advice, diagnosis, or treatment. For emergencies, call 112.</p>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about facilities, resources, shortages, or redistribution opportunities..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          disabled={isThinking}
        />
        <button
          type="submit"
          disabled={!input.trim() || isThinking}
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
