// NIRAMAYA AI — AI Assistant Service
// API-ready integration contract
// Future endpoint: /api/ai/chat
// IMPORTANT: Never expose Gemini API key in frontend code.
// All AI calls must route through the backend service abstraction.

import type { AIMessage } from '../../types';
import { mockAIResponses } from '../mock/mockData';

export interface AIChatRequest {
  message: string;
  context?: {
    facilityId?: string;
    alertId?: string;
    resourceType?: string;
  };
}

const AI_DISCLAIMER = 'AI Decision Support Only — Not medical advice. Human authorization required for any operational action.';

export const aiService = {
  /** Send a message to NIRAMAYA Intelligence Layer */
  async chat(request: AIChatRequest): Promise<AIMessage> {
    // TODO: Replace with real backend call:
    // const res = await fetch('/api/ai/chat', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(request),
    // });
    // return res.json();

    // Demo: simulate AI processing latency (1.5–2.5s)
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

    const msg = request.message.toLowerCase();

    // Route to context-appropriate mock response
    let responseKey = 'default';
    if (msg.includes('shortage') || msg.includes('risk') || msg.includes('elevated')) {
      responseKey = 'shortage';
    } else if (msg.includes('redistribution') || msg.includes('transfer') || msg.includes('opportunit')) {
      responseKey = 'redistribution';
    } else if (msg.includes('expiry') || msg.includes('expir')) {
      responseKey = 'expiry';
    }

    const base = mockAIResponses[responseKey] ?? mockAIResponses['default'];

    return {
      ...base,
      id: `resp_${Date.now()}`,
      timestamp: new Date().toISOString(),
      // Append disclaimer to content for compliance
      content: `${base.content}\n\n⚠️ ${AI_DISCLAIMER}`,
    };
  },

  /** Get context-appropriate suggested prompts */
  getSuggestedPrompts(): string[] {
    return [
      'Which facilities currently show elevated shortage risk?',
      'Where are potential redistribution opportunities?',
      'What resources are approaching expiry this month?',
      'Why is KEM Hospital marked high risk?',
    ];
  },
};
