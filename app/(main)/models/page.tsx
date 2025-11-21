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
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Model Dashboard</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Provider</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Enabled</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Modalities</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Quality</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Reliability</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Latency (ms)</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Cost/1k</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2">{model.name}</td>
                  <td className="border border-gray-300 px-4 py-2">{model.provider}</td>
                  <td className="border border-gray-300 px-4 py-2">
                    {model.is_enabled ? '✓' : ''}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {model.modalities.join(', ')}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {(model.quality_score * 100).toFixed(1)}%
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {(model.reliability_score * 100).toFixed(1)}%
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {model.avg_latency_ms || 'N/A'}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {model.cost_per_1k_tokens ? `$${model.cost_per_1k_tokens}` : 'N/A'}
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

