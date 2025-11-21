'use client';

interface ModelSelection {
  selectedModel: {
    id: string;
    name: string;
    provider: string;
    qualityScore: number;
    reliabilityScore: number;
  };
  candidates: Array<{
    id: string;
    name: string;
    score: number;
    reason: string;
  }>;
  options: Record<string, any>;
}

interface ModelSelectorProps {
  selection: ModelSelection | null;
}

export default function ModelSelector({ selection }: ModelSelectorProps) {
  if (!selection) {
    return (
      <div className="text-gray-500 text-sm">No model selection data available</div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Model Selection</h3>
      <div className="border rounded p-3 bg-blue-50">
        <div className="font-medium">Selected: {selection.selectedModel.name}</div>
        <div className="text-xs text-gray-600">
          Provider: {selection.selectedModel.provider} | Quality: {(selection.selectedModel.qualityScore * 100).toFixed(1)}% | Reliability: {(selection.selectedModel.reliabilityScore * 100).toFixed(1)}%
        </div>
      </div>
      {selection.candidates.length > 0 && (
        <details>
          <summary className="text-sm cursor-pointer text-gray-600">
            {selection.candidates.length} other candidates
          </summary>
          <div className="mt-2 space-y-1">
            {selection.candidates.map((candidate, index) => (
              <div key={index} className="text-xs border rounded p-2 bg-gray-50">
                <div className="font-medium">{candidate.name}</div>
                <div className="text-gray-600">Score: {candidate.score.toFixed(2)}</div>
                <div className="text-gray-500">{candidate.reason}</div>
              </div>
            ))}
          </div>
        </details>
      )}
      {Object.keys(selection.options).length > 0 && (
        <details>
          <summary className="text-sm cursor-pointer text-gray-600">
            Selection Options
          </summary>
          <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto">
            {JSON.stringify(selection.options, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

