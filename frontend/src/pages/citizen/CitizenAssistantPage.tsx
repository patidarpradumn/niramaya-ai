import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, MapPin, Phone, AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const SUGGESTED = [
  'Which government facility provides maternity services near me?',
  'Where is the nearest public hospital?',
  'What services are available at Sion General Medical Center?',
  'How can I find a government pharmacy?',
];

function citizenResponse(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('maternity') || q.includes('delivery')) {
    return 'Several government facilities offer maternity services in Maharashtra. Sion General Medical Center (Sion East, Mumbai) and Pune District Government Hospital (Shivajinagar, Pune) both have maternity departments. For emergencies, please call 112.';
  }
  if (q.includes('nearest') || q.includes('near me') || q.includes('close')) {
    return 'To find the nearest government facility, you can search by your location on the Facilities tab. All government hospitals listed are publicly accessible. For urgent medical needs, please call 112 immediately.';
  }
  if (q.includes('sion') || q.includes('pharmacy')) {
    return 'Sion General Medical Center (Sion East, Mumbai) offers: General Medicine, Pediatrics, Maternity, Pharmacy, and Laboratory services. Hours: Mon–Sat 8am–8pm, Emergency 24 hours. Phone: +91-22-2407-6000.';
  }
  if (q.includes('emergency')) {
    return 'For medical emergencies, call 112 immediately. All district hospitals and major government facilities have 24-hour emergency departments. King Edward Memorial Hospital (Parel, Mumbai) and Pune District Government Hospital are open 24 hours.';
  }
  return 'I can help you find public government healthcare facilities, services, locations, and contact information. For medical emergencies, please call 112. I cannot provide medical advice, diagnosis, or treatment recommendations.';
}

export default function CitizenAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'assistant',
    content: 'Hello! I can help you find public government healthcare facilities, services, and contact information near you. How can I assist you today?\n\nNote: I provide public service information only. For medical emergencies, please call 112.',
    timestamp: new Date().toISOString(),
  }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 1000));
    setIsTyping(false);
    setMessages(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: citizenResponse(text),
      timestamp: new Date().toISOString(),
    }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-h-[800px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm">NIRAMAYA Public Assistant</h1>
            <p className="text-blue-200 text-xs">Healthcare Service Navigation</p>
          </div>
        </div>
      </div>

      {/* Safety notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-4 flex items-start gap-2 flex-shrink-0">
        <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">This assistant provides <strong>public service information only</strong>. It does not provide medical advice, diagnosis, or treatment. For emergencies, call <strong>112</strong>.</p>
      </div>

      {/* Suggested prompts */}
      {messages.length <= 1 && (
        <div className="mb-4 flex-shrink-0">
          <p className="text-xs text-gray-500 mb-2">Suggested questions:</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {SUGGESTED.map(p => (
              <button key={p} onClick={() => send(p)} className="text-left text-xs px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-blue-100'}`}>
              {msg.role === 'user' ? <User size={13} className="text-white" /> : <Bot size={13} className="text-blue-600" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot size={13} className="text-blue-600" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
              {[0, 0.15, 0.3].map(d => (
                <div key={d} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${d}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick info links */}
      <div className="flex gap-2 my-3 flex-shrink-0 overflow-x-auto pb-1">
        {[{ icon: <Phone size={11} />, label: 'Emergency: 112' }, { icon: <MapPin size={11} />, label: 'Find Facility' }].map(item => (
          <div key={item.label} className="flex items-center gap-1.5 text-[11px] bg-blue-50 border border-blue-100 text-blue-700 px-2.5 py-1.5 rounded-full whitespace-nowrap font-medium flex-shrink-0">
            {item.icon}{item.label}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about facilities, services, or locations..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          disabled={isTyping}
        />
        <button type="submit" disabled={!input.trim() || isTyping} className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
