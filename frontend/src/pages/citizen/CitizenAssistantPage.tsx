import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  MapPin,
  AlertCircle,
  Sparkles,
  Navigation,
  Building2,
  Crosshair,
  Loader2,
} from 'lucide-react';
import { publicService } from '../../services/api/publicService';
import type { PublicFacility, CitizenAssistantResponse } from '../../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  facilities?: PublicFacility[];
  intent?: string;
  disclaimer?: string;
}

const SUGGESTED_QUESTIONS = [
  'I need a government hospital offering vaccination services near me.',
  'Where is the nearest 24/7 public emergency hospital?',
  'Which government facility provides maternity and delivery care in Maharashtra?',
  'Where can I find pediatric and child care health centers?',
  'Find Community Health Centers (CHC) with pharmacy services.',
];

export default function CitizenAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        '👋 **Namaste! I am your NIRAMAYA Public Healthcare Navigator.**\n\n' +
        'I can help you locate verified government hospitals, primary health centers (PHC), community health centers (CHC), ' +
        'and free/subsidized medical services across the public healthcare network.\n\n' +
        'How can I help you today?',
      timestamp: new Date().toISOString(),
      disclaimer:
        'Public Healthcare Notice: This assistant provides public facility and service information only. It does not provide medical diagnoses, treatment advice, or prescriptions. For medical emergencies, dial 112 or 108 immediately.',
    },
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Optional Geolocation detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setIsLocating(false);
      },
      () => {
        // Fallback demo location
        setUserCoords({ lat: 18.5204, lon: 73.8567 });
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const sendMessage = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || isTyping) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cleanText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response: CitizenAssistantResponse = await publicService.askCitizenAssistant({
        query: cleanText,
        lat: userCoords?.lat,
        lon: userCoords?.lon,
        radius: 30.0,
      });

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        facilities: response.recommended_facilities || [],
        intent: response.intent,
        disclaimer: response.disclaimer,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const fallbackMsg: Message = {
        id: `assistant-err-${Date.now()}`,
        role: 'assistant',
        content:
          'I apologize, but I am currently having trouble connecting to the public healthcare directory. ' +
          'For immediate assistance, please visit the **Facilities** tab or call the National Emergency Helpline at **112**.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const openDirections = (facility: PublicFacility) => {
    let url = '';
    if (facility.latitude && facility.longitude) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        facility.name + ', ' + facility.location
      )}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] max-w-5xl mx-auto space-y-3 pb-2">
      {/* 1. TOP HEADER */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 rounded-2xl p-4 text-white shadow-md flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
            <Sparkles size={20} className="text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base">NIRAMAYA Citizen AI Navigator</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                Online
              </span>
            </div>
            <p className="text-blue-100 text-xs">Public Healthcare Facilities & Services Discovery</p>
          </div>
        </div>

        <button
          onClick={handleDetectLocation}
          disabled={isLocating}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-md border border-white/20 transition-colors"
        >
          {isLocating ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} className="text-cyan-300" />}
          <span>{userCoords ? 'GPS Active' : 'Enable GPS'}</span>
        </button>
      </div>

      {/* 2. SAFETY & EMERGENCY DISCLAIMER BANNER */}
      <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-3 flex items-start gap-3 text-amber-900 text-xs flex-shrink-0">
        <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 leading-relaxed">
          <strong>Public Information Only:</strong> This AI assistant helps discover government healthcare facilities, timings, and services. It <strong>never</strong> gives medical diagnoses or prescriptions. For medical emergencies, call <strong>112</strong> or <strong>108</strong> immediately.
        </div>
      </div>

      {/* 3. CHAT MESSAGES STREAM */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1 py-2 pr-2 scrollbar-thin scrollbar-thumb-gray-200">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white'
              }`}
            >
              {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
            </div>

            {/* Bubble */}
            <div className={`space-y-3 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`p-4 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-white border border-gray-200/80 text-gray-800 rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>

              {/* Recommended Facility Cards inside assistant message */}
              {msg.facilities && msg.facilities.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 size={13} className="text-blue-600" />
                    <span>Recommended Government Healthcare Centers ({msg.facilities.length})</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {msg.facilities.map((f) => (
                      <div
                        key={f.id}
                        className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-2"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="text-xs font-bold text-gray-900 line-clamp-1">{f.name}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                              Open
                            </span>
                          </div>
                          <div className="flex items-start gap-1 text-[11px] text-gray-500 mt-1 line-clamp-2">
                            <MapPin size={11} className="text-blue-500 flex-shrink-0 mt-0.5" />
                            <span>{f.location}</span>
                          </div>

                          {/* Services */}
                          {f.facility_services && f.facility_services.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {f.facility_services.slice(0, 3).map((s) => (
                                <span
                                  key={s.id}
                                  className="text-[9px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded"
                                >
                                  {s.service_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-end">
                          <button
                            onClick={() => openDirections(f)}
                            className="flex items-center gap-1 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-sm transition-all"
                          >
                            <Navigation size={11} />
                            <span>Directions</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-2xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Bot size={15} />
            </div>
            <div className="bg-white border border-gray-200 rounded-3xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500 mr-1">Searching public health network</span>
              {[0, 0.15, 0.3].map((d) => (
                <div
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 4. SUGGESTED PROMPTS PILLS (Visible when few messages) */}
      {messages.length <= 2 && (
        <div className="flex-shrink-0 space-y-1.5">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Suggested Questions</span>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700 transition-colors whitespace-nowrap shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. INPUT BAR */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="flex items-center gap-2 p-2 bg-white rounded-2xl border border-gray-200 shadow-sm flex-shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask e.g., 'I need a government hospital offering vaccination services near me'..."
          disabled={isTyping}
          className="flex-1 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
        />
        <button
          type="submit"
          disabled={!input.trim() || isTyping}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
        >
          <span>Send</span>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
