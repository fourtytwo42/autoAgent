'use client';

interface AgentTrace {
  agent_id: string;
  model_id: string;
  input_summary: string;
  output: string;
  latency_ms: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface AgentTraceProps {
  traces: AgentTrace[];
}

export default function AgentTrace({ traces }: AgentTraceProps) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Agent Call Traces</h3>
      {traces.length === 0 ? (
        <div className="text-gray-500 text-sm">No traces available</div>
      ) : (
        <div className="space-y-2">
          {traces.map((trace, index) => (
            <div key={index} className="border rounded p-3 bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium">{trace.agent_id}</div>
                  <div className="text-xs text-gray-500">Model: {trace.model_id}</div>
                </div>
                <div className="text-xs text-gray-500">
                  {trace.latency_ms}ms
                </div>
              </div>
              <div className="text-sm mb-2">
                <div className="font-medium">Input:</div>
                <div className="text-gray-600">{trace.input_summary}</div>
              </div>
              <div className="text-sm">
                <div className="font-medium">Output:</div>
                <div className="text-gray-600 max-h-32 overflow-y-auto">
                  {trace.output}
                </div>
              </div>
              {trace.metadata && Object.keys(trace.metadata).length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-gray-500">
                    Metadata
                  </summary>
                  <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto">
                    {JSON.stringify(trace.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

