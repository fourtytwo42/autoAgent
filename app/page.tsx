'use client';

import { useState, useRef, useEffect } from 'react';
import { useSSE } from './hooks/useSSE';
import AgentTrace from './components/debug/AgentTrace';
import ModelSelector from './components/debug/ModelSelector';
import GoalTree from './components/debug/GoalTree';
import Button from './components/ui/Button';
import { Card, Input, Switch } from '@heroui/react';

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
        const response = await fetch('/api/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText }),
        });
      } else {
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 4rem)',
      maxHeight: 'calc(100vh - 4rem)',
      padding: '24px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '24px',
        borderBottom: '1px solid #27272a',
      }}>
        <div>
          <h1 style={{
            fontSize: '30px',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '4px',
          }}>Conversation</h1>
          <p style={{
            fontSize: '14px',
            color: '#a1a1aa',
          }}>Chat with the AI agent system</p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
        }}>
          <Switch
            isSelected={debugMode}
            onValueChange={setDebugMode}
            size="sm"
          />
          <span style={{
            fontSize: '14px',
            color: '#d4d4d8',
          }}>Debug Mode</span>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        marginBottom: '24px',
        padding: '24px',
        backgroundColor: '#18181b',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#a1a1aa',
            marginTop: '32px',
          }}>
            Start a conversation by typing a message below.
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <Card
              style={{
                maxWidth: '672px',
                padding: '16px 20px',
                borderRadius: '16px',
                backgroundColor: message.role === 'user' ? '#2563eb' : '#27272a',
                color: message.role === 'user' ? 'white' : '#e4e4e7',
                border: message.role === 'user' ? 'none' : '1px solid #3f3f46',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              }}
            >
              <div style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: '1.6',
              }}>{message.content}</div>
              {debugMode && (
                <div style={{
                  fontSize: '12px',
                  marginTop: '8px',
                  opacity: 0.75,
                  color: message.role === 'user' ? 'rgba(255,255,255,0.8)' : '#a1a1aa',
                }}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              )}
            </Card>
          </div>
        ))}
        {(isLoading || streamingMessage) && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Card style={{
              padding: '16px 20px',
              borderRadius: '16px',
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}>
              {streamingMessage ? (
                <div style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#e4e4e7',
                }}>{streamingMessage}</div>
              ) : (
                <div style={{
                  color: '#a1a1aa',
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}>Thinking...</div>
              )}
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {debugMode && (
        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #27272a',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '16px',
            color: 'white',
          }}>Debug Panel</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '12px',
          paddingTop: '24px',
          borderTop: '1px solid #27272a',
        }}
      >
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          isDisabled={isLoading}
          size="lg"
          classNames={{
            base: 'flex-1',
            input: 'text-base',
            inputWrapper: 'bg-[#27272a] border-[#3f3f46] hover:border-[#52525b]',
          }}
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
