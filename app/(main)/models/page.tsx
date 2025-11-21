'use client';

import { useState, useEffect } from 'react';

interface Model {
  id: string;
  name: string;
  provider: string;
  is_enabled: boolean;
  modalities: string[];
  quality_score: number;
  reliability_score: number;
  avg_latency_ms?: number;
  cost_per_1k_tokens?: number;
}

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/models');
      const data = await response.json();
      setModels(data.models || []);
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Model Dashboard</h1>
        <p className="text-gray-400">View and manage all registered models</p>
      </div>
      {loading ? (
        <div className="text-gray-400 text-center py-12">Loading models...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full border-collapse bg-gray-800">
            <thead>
              <tr className="bg-gray-700">
                <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">Name</th>
                <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">Provider</th>
                <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">Enabled</th>
                <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">Modalities</th>
                <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">Quality</th>
                <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">Reliability</th>
                <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">Latency (ms)</th>
                <th className="border-b border-gray-600 px-6 py-4 text-left text-gray-200 font-semibold">Cost/1k</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.id} className="hover:bg-gray-700 transition-colors">
                  <td className="border-b border-gray-700 px-6 py-4 text-gray-200 font-medium">{model.name}</td>
                  <td className="border-b border-gray-700 px-6 py-4 text-gray-200">
                    <span className="px-2 py-1 bg-gray-600 rounded text-xs">{model.provider}</span>
                  </td>
                  <td className="border-b border-gray-700 px-6 py-4 text-gray-200">
                    {model.is_enabled ? (
                      <span className="text-green-400">✓ Enabled</span>
                    ) : (
                      <span className="text-gray-500">Disabled</span>
                    )}
                  </td>
                  <td className="border-b border-gray-700 px-6 py-4 text-gray-200">
                    <div className="flex gap-2">
                      {model.modalities.map((mod) => (
                        <span key={mod} className="px-2 py-1 bg-gray-600 rounded text-xs">
                          {mod}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="border-b border-gray-700 px-6 py-4 text-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-[60px]">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${(model.quality_score || 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm">{(model.quality_score * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="border-b border-gray-700 px-6 py-4 text-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-[60px]">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${(model.reliability_score || 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm">{(model.reliability_score * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="border-b border-gray-700 px-6 py-4 text-gray-200">
                    {model.avg_latency_ms ? (
                      <span>{model.avg_latency_ms.toLocaleString()}ms</span>
                    ) : (
                      <span className="text-gray-500">N/A</span>
                    )}
                  </td>
                  <td className="border-b border-gray-700 px-6 py-4 text-gray-200">
                    {model.cost_per_1k_tokens ? (
                      <span>${model.cost_per_1k_tokens.toFixed(4)}</span>
                    ) : (
                      <span className="text-gray-500">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

