'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

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
        <h1 className="text-3xl font-bold text-foreground mb-2">Model Dashboard</h1>
        <p className="text-muted-foreground">View and manage all registered models</p>
      </div>
      {loading ? (
        <div className="text-muted-foreground text-center py-12">Loading models...</div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Modalities</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Reliability</TableHead>
                  <TableHead>Latency (ms)</TableHead>
                  <TableHead>Cost/1k</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{model.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{model.provider}</Badge>
                    </TableCell>
                    <TableCell>
                      {model.is_enabled ? (
                        <Badge variant="default" className="bg-green-600">✓ Enabled</Badge>
                      ) : (
                        <Badge variant="outline">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        {model.modalities.map((mod) => (
                          <Badge key={mod} variant="outline">
                            {mod}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={(model.quality_score ?? 0.5) * 100} className="flex-1 max-w-[60px]" />
                        <span className="text-sm text-foreground">{((model.quality_score ?? 0.5) * 100).toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={(model.reliability_score ?? 0.5) * 100} className="flex-1 max-w-[60px]" />
                        <span className="text-sm text-foreground">{((model.reliability_score ?? 0.5) * 100).toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {model.avg_latency_ms ? (
                        <span>{model.avg_latency_ms.toLocaleString()}ms</span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {model.cost_per_1k_tokens ? (
                        <span>${model.cost_per_1k_tokens.toFixed(4)}</span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
