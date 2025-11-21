'use client';

import { useState, useEffect } from 'react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Card, Chip, Progress } from '@heroui/react';

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
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontSize: '30px',
          fontWeight: 'bold',
          color: 'white',
          marginBottom: '8px',
        }}>Model Dashboard</h1>
        <p style={{ color: '#a1a1aa' }}>View and manage all registered models</p>
      </div>
      {loading ? (
        <div style={{
          color: '#a1a1aa',
          textAlign: 'center',
          padding: '48px 0',
        }}>Loading models...</div>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table aria-label="Models table">
            <TableHeader>
              <TableColumn>Name</TableColumn>
              <TableColumn>Provider</TableColumn>
              <TableColumn>Enabled</TableColumn>
              <TableColumn>Modalities</TableColumn>
              <TableColumn>Quality</TableColumn>
              <TableColumn>Reliability</TableColumn>
              <TableColumn>Latency (ms)</TableColumn>
              <TableColumn>Cost/1k</TableColumn>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell>
                    <span style={{
                      fontWeight: '500',
                      color: '#e4e4e7',
                    }}>{model.name}</span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color="default">
                      {model.provider}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    {model.is_enabled ? (
                      <Chip color="success" size="sm" variant="flat">✓ Enabled</Chip>
                    ) : (
                      <Chip size="sm" variant="flat">Disabled</Chip>
                    )}
                  </TableCell>
                  <TableCell>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {model.modalities.map((mod) => (
                        <Chip key={mod} size="sm" variant="flat" color="default">
                          {mod}
                        </Chip>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      minWidth: '100px',
                    }}>
                      <Progress
                        value={(model.quality_score || 0) * 100}
                        color="primary"
                        size="sm"
                        style={{ flex: 1, maxWidth: '60px' }}
                      />
                      <span style={{
                        fontSize: '14px',
                        color: '#e4e4e7',
                      }}>{(model.quality_score * 100).toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      minWidth: '100px',
                    }}>
                      <Progress
                        value={(model.reliability_score || 0) * 100}
                        color="success"
                        size="sm"
                        style={{ flex: 1, maxWidth: '60px' }}
                      />
                      <span style={{
                        fontSize: '14px',
                        color: '#e4e4e7',
                      }}>{(model.reliability_score * 100).toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell style={{ color: '#e4e4e7' }}>
                    {model.avg_latency_ms ? (
                      <span>{model.avg_latency_ms.toLocaleString()}ms</span>
                    ) : (
                      <span style={{ color: '#71717a' }}>N/A</span>
                    )}
                  </TableCell>
                  <TableCell style={{ color: '#e4e4e7' }}>
                    {model.cost_per_1k_tokens ? (
                      <span>${model.cost_per_1k_tokens.toFixed(4)}</span>
                    ) : (
                      <span style={{ color: '#71717a' }}>N/A</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
