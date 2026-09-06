import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, User as UserIcon, Sparkles } from 'lucide-react';
import { aiAPI } from '../services/api';
import { getErrorMessage } from '../utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  disclaimer?: string;
  intent?: string;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const query = input.trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await aiAPI.chat({ query });
      const data = response.data;
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        sources: data.sources_used,
        disclaimer: data.disclaimer,
        intent: data.intent_classified,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: `⚠️ Error: ${getErrorMessage(err)}`,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          AI Assistant
        </h1>
        <p className="text-text-secondary">Ask questions about inventory, alerts, and predictions</p>
      </div>

      {/* Chat container */}
      <div className="card flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <Bot className="w-16 h-16 text-primary/30 mx-auto mb-4" />
              <p className="text-text-secondary font-medium text-lg">How can I help you today?</p>
              <p className="text-text-secondary text-sm mt-1">
                Ask about stock levels, alerts, demand forecasts, or facility info
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {['Show low stock alerts', 'What is the inventory status?', 'Tell me about facility shortages'].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="px-3 py-2 bg-primary/5 hover:bg-primary/10 text-primary text-sm rounded-lg transition-colors border border-primary/10"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-gray-100 text-text-primary rounded-bl-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200/50 flex flex-wrap gap-1">
                    {msg.sources.map((src) => (
                      <span key={src} className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-text-secondary">
                        {src}
                      </span>
                    ))}
                  </div>
                )}
                {msg.disclaimer && (
                  <p className="text-[10px] text-text-secondary mt-1 italic">
                    {msg.disclaimer}
                  </p>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask about inventory, alerts, predictions…"
              className="input-field flex-1"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="btn-primary px-4 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}