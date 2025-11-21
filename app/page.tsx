'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useSSE } from './hooks/useSSE';
import AgentTrace from './components/debug/AgentTrace';
import ModelSelector from './components/debug/ModelSelector';
import GoalTree from './components/debug/GoalTree';
import Button from './components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

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
  const [webEnabled, setWebEnabled] = useState(false);
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

  // Load conversation history on mount
  useEffect(() => {
    const loadConversationHistory = async () => {
      try {
        const response = await fetch('/api/conversation');
        if (response.ok) {
          const data = await response.json();
          if (data.messages && Array.isArray(data.messages)) {
            // Convert timestamp strings to Date objects
            const loadedMessages = data.messages.map((msg: any) => ({
              ...msg,
              timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
            }));
            setMessages(loadedMessages);
          }
        }
      } catch (error) {
        console.error('Error loading conversation history:', error);
      }
    };

    loadConversationHistory();
  }, []);

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
    setInput('');
    setIsLoading(true);
    setStreamingMessage('');

    try {
      const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          debug: debugMode,
          metadata: {
            web_enabled: webEnabled,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send message' }));
        throw new Error(errorData.error || errorData.message || 'Failed to send message');
      }

      // Check if it's a streaming response
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'status') {
                  // Show informal status message
                  setStreamingMessage(data.message);
                } else if (data.type === 'response') {
                  // Final response received
                  setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: data.response,
                    timestamp: new Date(),
                  }]);
                  setStreamingMessage('');
                } else if (data.type === 'error') {
                  throw new Error(data.error || 'Unknown error');
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      } else if (contentType.includes('application/json')) {
        // Handle JSON response (non-streaming)
        const data = await response.json();
        
        if (debugMode) {
          setDebugData({
            traces: data.traces,
            modelSelection: data.modelSelection,
            goalTree: data.goalTree,
          });
        }

        if (data.response) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
          }]);
        }
      } else {
        // Fallback: try to read as text stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let done = false;
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;

            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'status') {
                      // Show informal status message
                      setStreamingMessage(data.message);
                    } else if (data.type === 'response') {
                      // Final response received
                      if (data.response) {
                        const assistantMessage: Message = {
                          id: Date.now().toString(),
                          role: 'assistant',
                          content: data.response,
                          timestamp: new Date(),
                        };
                        setMessages((prev) => [...prev, assistantMessage]);
                      }
                      setStreamingMessage('');
                      setIsLoading(false);
                      done = true;
                    } else if (data.type === 'error') {
                      throw new Error(data.error || 'Unknown error');
                    } else if (data.type === 'token') {
                      // Legacy token streaming
                      setStreamingMessage((prev) => prev + data.content);
                    } else if (data.type === 'done') {
                      // Legacy done signal
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
                      done = true;
                    }
                  } catch (parseError) {
                    console.error('Error parsing SSE data:', parseError);
                  }
                }
              }
            }
          }
        }
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
      setStreamingMessage('');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <h1 className="text-2xl font-bold text-foreground">Conversation</h1>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (confirm('Are you sure you want to clear all conversation history?')) {
                try {
                  const response = await fetch('/api/conversation/clear', {
                    method: 'POST',
                  });
                  if (response.ok) {
                    setMessages([]);
                    setStreamingMessage('');
                    // Reload conversation history
                    const refreshResponse = await fetch('/api/conversation');
                    if (refreshResponse.ok) {
                      const data = await refreshResponse.json();
                      if (data.messages && Array.isArray(data.messages)) {
                        const loadedMessages = data.messages.map((msg: any) => ({
                          ...msg,
                          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                        }));
                        setMessages(loadedMessages);
                      }
                    }
                  } else {
                    alert('Failed to clear conversation');
                  }
                } catch (error) {
                  console.error('Error clearing conversation:', error);
                  alert('Failed to clear conversation');
                }
              }
            }}
          >
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!confirm('Are you sure you want to clear ALL data?\n\nThis will delete:\n- All tasks\n- All goals\n- All user requests\n- All agent outputs\n- All conversation history\n- All jobs\n\nThis cannot be undone.')) {
                return;
              }
              
              try {
                const response = await fetch('/api/tasks/clear-all', {
                  method: 'POST',
                });
                if (response.ok) {
                  const data = await response.json();
                  // Clear local messages
                  setMessages([]);
                  setStreamingMessage('');
                  alert(`Cleared ${data.totalDeleted} items and cancelled ${data.cancelledJobs || 0} jobs`);
                  // Reload conversation history (should be empty now)
                  const refreshResponse = await fetch('/api/conversation');
                  if (refreshResponse.ok) {
                    const refreshData = await refreshResponse.json();
                    if (refreshData.messages && Array.isArray(refreshData.messages)) {
                      const loadedMessages = refreshData.messages.map((msg: any) => ({
                        ...msg,
                        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                      }));
                      setMessages(loadedMessages);
                    }
                  }
                } else {
                  alert('Failed to clear all data');
                }
              } catch (error) {
                console.error('Error clearing all data:', error);
                alert('Failed to clear all data');
              }
            }}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
          >
            Clear All
          </Button>
          <div className="flex items-center gap-2">
            <Label htmlFor="debug-mode" className="text-sm">Debug Mode</Label>
            <Switch
              id="debug-mode"
              checked={debugMode}
              onCheckedChange={setDebugMode}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg mb-2">Start a conversation</p>
            <p className="text-sm">Type a message below to begin</p>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}
          >
            <Card
              className={`w-full max-w-[80%] ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-card-foreground'
              }`}
            >
              <CardContent className="p-4">
                {message.role === 'assistant' ? (
                  <div className="prose prose-invert dark:prose-invert max-w-none break-words prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground prose-blockquote:text-muted-foreground prose-blockquote:border-muted-foreground">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        // Style code blocks
                        code: ({ node, inline, className, children, ...props }: any) => {
                          return !inline ? (
                            <code
                              className="block bg-muted p-4 rounded-md overflow-x-auto text-sm text-foreground font-mono"
                              {...props}
                            >
                              {children}
                            </code>
                          ) : (
                            <code
                              className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        // Style pre blocks
                        pre: ({ children }: any) => {
                          return <pre className="bg-muted p-4 rounded-md overflow-x-auto my-2">{children}</pre>;
                        },
                        // Style links
                        a: ({ href, children }: any) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {children}
                          </a>
                        ),
                        // Style headings
                        h1: ({ children }: any) => (
                          <h1 className="text-2xl font-bold mt-4 mb-2 text-foreground">{children}</h1>
                        ),
                        h2: ({ children }: any) => (
                          <h2 className="text-xl font-bold mt-3 mb-2 text-foreground">{children}</h2>
                        ),
                        h3: ({ children }: any) => (
                          <h3 className="text-lg font-semibold mt-2 mb-1 text-foreground">{children}</h3>
                        ),
                        // Style lists
                        ul: ({ children }: any) => (
                          <ul className="list-disc list-inside my-2 space-y-1 text-foreground">{children}</ul>
                        ),
                        ol: ({ children }: any) => (
                          <ol className="list-decimal list-inside my-2 space-y-1 text-foreground">{children}</ol>
                        ),
                        li: ({ children }: any) => (
                          <li className="text-foreground">{children}</li>
                        ),
                        // Style blockquotes
                        blockquote: ({ children }: any) => (
                          <blockquote className="border-l-4 border-muted-foreground pl-4 my-2 italic text-muted-foreground">
                            {children}
                          </blockquote>
                        ),
                        // Style paragraphs
                        p: ({ children }: any) => <p className="my-2 text-foreground">{children}</p>,
                        // Style horizontal rules
                        hr: () => <hr className="my-4 border-border" />,
                        // Support HTML elements
                        br: () => <br />,
                        div: ({ children, className, ...props }: any) => (
                          <div className={className} {...props}>{children}</div>
                        ),
                        span: ({ children, className, ...props }: any) => (
                          <span className={className} {...props}>{children}</span>
                        ),
                        strong: ({ children }: any) => <strong className="font-bold text-foreground">{children}</strong>,
                        em: ({ children }: any) => <em className="italic text-foreground">{children}</em>,
                        // Style tables
                        table: ({ children }: any) => (
                          <div className="overflow-x-auto my-4">
                            <table className="min-w-full border-collapse border border-border">
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }: any) => (
                          <th className="border border-border px-4 py-2 bg-muted text-foreground font-semibold">
                            {children}
                          </th>
                        ),
                        td: ({ children }: any) => (
                          <td className="border border-border px-4 py-2 text-foreground">
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                )}
                {debugMode && (
                  <div className="text-xs mt-2 opacity-75">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
        {(isLoading || streamingMessage) && (
          <div className="flex justify-start w-full">
            <Card className="w-full max-w-[80%]">
              <CardContent className="p-4">
                {streamingMessage ? (
                  <div className="prose prose-invert dark:prose-invert max-w-none break-words prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        code: ({ node, inline, className, children, ...props }: any) => {
                          return !inline ? (
                            <code
                              className="block bg-muted p-4 rounded-md overflow-x-auto text-sm text-foreground font-mono"
                              {...props}
                            >
                              {children}
                            </code>
                          ) : (
                            <code
                              className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        pre: ({ children }: any) => {
                          return <pre className="bg-muted p-4 rounded-md overflow-x-auto my-2">{children}</pre>;
                        },
                        a: ({ href, children }: any) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {children}
                          </a>
                        ),
                        p: ({ children }: any) => <p className="my-2 text-foreground">{children}</p>,
                        h1: ({ children }: any) => (
                          <h1 className="text-2xl font-bold mt-4 mb-2 text-foreground">{children}</h1>
                        ),
                        h2: ({ children }: any) => (
                          <h2 className="text-xl font-bold mt-3 mb-2 text-foreground">{children}</h2>
                        ),
                        h3: ({ children }: any) => (
                          <h3 className="text-lg font-semibold mt-2 mb-1 text-foreground">{children}</h3>
                        ),
                        ul: ({ children }: any) => (
                          <ul className="list-disc list-inside my-2 space-y-1 text-foreground">{children}</ul>
                        ),
                        ol: ({ children }: any) => (
                          <ol className="list-decimal list-inside my-2 space-y-1 text-foreground">{children}</ol>
                        ),
                        blockquote: ({ children }: any) => (
                          <blockquote className="border-l-4 border-muted-foreground pl-4 my-2 italic text-muted-foreground">
                            {children}
                          </blockquote>
                        ),
                        // Support HTML elements
                        br: () => <br />,
                        div: ({ children, className, ...props }: any) => (
                          <div className={className} {...props}>{children}</div>
                        ),
                        span: ({ children, className, ...props }: any) => (
                          <span className={className} {...props}>{children}</span>
                        ),
                        strong: ({ children }: any) => <strong className="font-bold text-foreground">{children}</strong>,
                        em: ({ children }: any) => <em className="italic text-foreground">{children}</em>,
                      }}
                    >
                      {streamingMessage}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />

        {debugMode && (
          <div className="mt-6 pt-6 border-t">
            <h2 className="text-xl font-bold mb-4">Debug Panel</h2>
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
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-4 p-6 border-t flex-shrink-0 bg-background"
      >
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          className="flex-1 text-lg h-14"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWebEnabled((prev) => !prev)}
            className={`inline-flex items-center justify-center h-12 w-12 rounded-md border transition-colors ${
              webEnabled
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-muted-foreground border-border'
            }`}
            title="Enable internet search"
            aria-pressed={webEnabled}
          >
            <Globe className="h-5 w-5" />
          </button>
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="lg"
            className="min-w-[120px] h-14 text-base font-semibold"
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
