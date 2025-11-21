'use client';

import { useState, useRef, useEffect } from 'react';
import { useSSE } from './hooks/useSSE';
import AgentTrace from './components/debug/AgentTrace';
import ModelSelector from './components/debug/ModelSelector';
import GoalTree from './components/debug/GoalTree';
import Button from './components/ui/Button';

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
      <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-700">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Conversation</h1>
          <p className="text-gray-400 text-sm">Chat with the AI agent system</p>
        </div>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(e) => setDebugMode(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
          />
          <span className="text-sm text-gray-300">Debug Mode</span>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto mb-6 space-y-4 p-6 bg-gray-800 rounded-lg">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            Start a conversation by typing a message below.
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl rounded-2xl px-5 py-4 shadow-md ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-100 border border-gray-600'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
              {debugMode && (
                <div className={`text-xs mt-2 opacity-75 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        ))}
        {(isLoading || streamingMessage) && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-2xl px-5 py-4 border border-gray-600 shadow-md">
              {streamingMessage ? (
                <div className="whitespace-pre-wrap break-words text-gray-100">{streamingMessage}</div>
              ) : (
                <div className="animate-pulse text-gray-400">Thinking...</div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {debugMode && (
        <div className="mt-6 border-t border-gray-700 pt-6">
          <h2 className="text-xl font-bold mb-4 text-white">Debug Panel</h2>
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

      <form onSubmit={handleSubmit} className="flex gap-3 pt-6 border-t border-gray-700 bg-gray-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 border border-gray-600 rounded-lg px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 text-gray-100 placeholder-gray-400 shadow-sm text-base"
          disabled={isLoading}
        />
        <Button
          type="submit"
          disabled={isLoading || !input.trim()}
          size="md"
        >
          Send
        </Button>
      </form>
    </div>
  );
}

