'use client';

import { useState, useRef, useEffect } from 'react';
import { useSSE } from '../hooks/useSSE';
import AgentTrace from '../components/debug/AgentTrace';
import ModelSelector from '../components/debug/ModelSelector';
import GoalTree from '../components/debug/GoalTree';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ConversationPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugData, setDebugData] = useState<{
    traces?: any[];
    modelSelection?: any;
    goalTree?: any;
  }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const [streamingMessage, setStreamingMessage] = useState<string>('');

  // Handle streaming responses
  const handleStreaming = useSSE(
    debugMode ? '/api/stream' : null,
    {
      onMessage: (data) => {
        if (data.type === 'token') {
          setStreamingMessage((prev) => prev + data.content);
        } else if (data.type === 'done') {
          if (streamingMessage) {
            const assistantMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: streamingMessage,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setStreamingMessage('');
          }
          setIsLoading(false);
        } else if (data.type === 'error') {
          const errorMessage: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Error: ${data.error}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          setStreamingMessage('');
          setIsLoading(false);
        }
      },
      onError: (error) => {
        console.error('Streaming error:', error);
        setIsLoading(false);
        setStreamingMessage('');
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = input;
    setInput('');
    setIsLoading(true);
    setStreamingMessage('');

    try {
      if (debugMode) {
        // Use streaming
        const response = await fetch('/api/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText }),
        });
        // SSE will handle the response
      } else {
        // Use regular API
        const response = await fetch('/api/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText }),
        });

        const data = await response.json();

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, an error occurred. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
      setStreamingMessage('');
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-[calc(100vh-4rem)]">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Conversation</h1>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(e) => setDebugMode(e.target.checked)}
            className="rounded"
          />
          <span>Debug Mode</span>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            Start a conversation by typing a message below.
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {debugMode && (
                <div className="text-xs mt-2 opacity-75">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        ))}
        {(isLoading || streamingMessage) && (
          <div className="flex justify-start">
            <div className="bg-gray-200 rounded-lg p-4">
              {streamingMessage ? (
                <div className="whitespace-pre-wrap">{streamingMessage}</div>
              ) : (
                <div className="animate-pulse">Thinking...</div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {debugMode && (
        <div className="mt-4 border-t pt-4">
          <h2 className="font-bold mb-4">Debug Panel</h2>
          <div className="space-y-4">
            {debugData.modelSelection && (
              <ModelSelector selection={debugData.modelSelection} />
            )}
            {debugData.traces && debugData.traces.length > 0 && (
              <AgentTrace traces={debugData.traces} />
            )}
            {debugData.goalTree && (
              <GoalTree root={debugData.goalTree} />
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
}

