'use client';

import { useState, useEffect } from 'react';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface Provider {
  id: string;
  name: string;
  hasApiKey: boolean;
  hasBaseUrl: boolean;
  baseUrl?: string;
  timeout?: number;
  configured: boolean;
}

interface ProviderModel {
  id: string;
  name: string;
  display_name?: string;
  modalities?: string[];
  context_window?: number;
  supports_streaming?: boolean;
  supports_vision?: boolean;
  supports_image_gen?: boolean;
}

interface Model {
  id: string;
  name: string;
  provider: string;
  display_name: string;
  is_enabled: boolean;
  modalities: string[];
  quality_score: number;
  reliability_score: number;
  avg_latency_ms?: number;
  cost_per_1k_tokens?: number;
}

export default function ConfigPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [providerModels, setProviderModels] = useState<ProviderModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [registeredModels, setRegisteredModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [showAddModel, setShowAddModel] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerConfig, setProviderConfig] = useState<{ apiKey?: string; baseUrl?: string; timeout?: number } | null>(null);

  useEffect(() => {
    fetchProviders();
    fetchRegisteredModels();
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      fetchProviderModels(selectedProvider);
      fetchRegisteredModels(selectedProvider);
    }
  }, [selectedProvider]);

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/providers');
      const data = await response.json();
      setProviders(data.providers || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderModels = async (providerId: string) => {
    setLoadingModels(true);
    try {
      const response = await fetch(`/api/providers/${providerId}/models`);
      const data = await response.json();
      setProviderModels(data.models || []);
    } catch (error) {
      console.error('Error fetching provider models:', error);
      setProviderModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchRegisteredModels = async (providerId?: string) => {
    try {
      const url = providerId 
        ? `/api/models?provider=${providerId}`
        : '/api/models';
      const response = await fetch(url);
      const data = await response.json();
      setRegisteredModels(data.models || []);
    } catch (error) {
      console.error('Error fetching registered models:', error);
    }
  };

  const fetchProviderConfig = async (providerId: string) => {
    try {
      const response = await fetch(`/api/providers/${providerId}/config`);
      const data = await response.json();
      setProviderConfig({
        apiKey: data.hasApiKey ? '***' : '',
        baseUrl: data.baseUrl || '',
        timeout: data.timeout || 60000,
      });
    } catch (error) {
      console.error('Error fetching provider config:', error);
      setProviderConfig({ apiKey: '', baseUrl: '', timeout: 60000 });
    }
  };

  const saveProviderConfig = async (providerId: string) => {
    if (!providerConfig) return;
    
    try {
      const response = await fetch(`/api/providers/${providerId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: providerConfig.apiKey === '***' ? undefined : providerConfig.apiKey,
          baseUrl: providerConfig.baseUrl,
          timeout: providerConfig.timeout,
        }),
      });

      if (response.ok) {
        await fetchProviders(); // Refresh provider list
        setEditingProvider(null);
        setProviderConfig(null);
        alert('Provider settings saved successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to save provider settings'}`);
      }
    } catch (error) {
      console.error('Error saving provider config:', error);
      alert('Failed to save provider settings');
    }
  };

  const toggleModelEnabled = async (modelId: string, currentState: boolean) => {
    try {
      const response = await fetch(`/api/models/${modelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: !currentState }),
      });

      if (response.ok) {
        await fetchRegisteredModels(selectedProvider || undefined);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to update model'}`);
      }
    } catch (error) {
      console.error('Error toggling model:', error);
      alert('Failed to update model');
    }
  };

  const handleAddModel = async (providerModel: ProviderModel) => {
    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: providerModel.name,
          provider: selectedProvider,
          display_name: providerModel.display_name || providerModel.name,
          modalities: providerModel.modalities || ['text'],
          quality_score: 0.5,
          reliability_score: 0.5,
        }),
      });

      if (response.ok) {
        await fetchRegisteredModels(selectedProvider || undefined);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to add model'}`);
      }
    } catch (error) {
      console.error('Error adding model:', error);
      alert('Failed to add model');
    }
  };

  const handleSaveModel = async (modelData: Partial<Model>) => {
    try {
      if (editingModel) {
        const response = await fetch(`/api/models/${editingModel.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modelData),
        });

        if (response.ok) {
          await fetchRegisteredModels(selectedProvider || undefined);
          setEditingModel(null);
        } else {
          const error = await response.json();
          alert(`Error: ${error.message || 'Failed to update model'}`);
        }
      } else {
        const response = await fetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modelData),
        });

        if (response.ok) {
          await fetchRegisteredModels(selectedProvider || undefined);
          setShowAddModel(false);
        } else {
          const error = await response.json();
          alert(`Error: ${error.message || 'Failed to create model'}`);
        }
      }
    } catch (error) {
      console.error('Error saving model:', error);
      alert('Failed to save model');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-muted-foreground">Loading providers...</div>
      </div>
    );
  }

  if (selectedProvider) {
    const provider = providers.find(p => p.id === selectedProvider);
    const registeredModelIds = new Set(registeredModels.map(m => m.name));

    return (
      <div className="p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setSelectedProvider(null)}
            className="mb-4 text-blue-400 hover:text-blue-300"
          >
            ← Back to Providers
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-2">{provider?.name} Models</h1>
          <p className="text-muted-foreground">
            {provider?.configured 
              ? 'Available models from this provider'
              : 'Configure this provider in your .env file to see available models'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Available Models */}
          <Card>
            <CardHeader>
              <CardTitle>Available Models</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingModels ? (
                <div className="text-muted-foreground">Loading models...</div>
              ) : providerModels.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">
                  {provider?.configured 
                    ? 'No models found or provider unavailable'
                    : 'Provider not configured'}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {providerModels.map((model) => {
                    const isRegistered = registeredModelIds.has(model.name);
                    return (
                      <Card
                        key={model.id}
                        className={`cursor-pointer transition-all ${
                          isRegistered ? 'opacity-75' : 'hover:bg-muted/50'
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-foreground mb-1">
                                {model.display_name || model.name}
                              </h3>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {model.modalities?.map((mod) => (
                                  <Badge key={mod} variant="outline">
                                    {mod}
                                  </Badge>
                                ))}
                              </div>
                              {model.context_window && (
                                <div className="text-xs text-muted-foreground mt-2">
                                  Context: {model.context_window.toLocaleString()} tokens
                                </div>
                              )}
                            </div>
                            {isRegistered ? (
                              <Badge variant="default" className="bg-green-600">Registered</Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleAddModel(model)}
                                disabled={!provider?.configured}
                              >
                                Add
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Registered Models */}
          <Card>
            <CardHeader>
              <CardTitle>Registered Models</CardTitle>
            </CardHeader>
            <CardContent>
              {registeredModels.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">No models registered yet</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {registeredModels.map((model) => (
                    <Card key={model.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground mb-1">
                              {model.display_name || model.name}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {model.modalities.map((mod) => (
                                <Badge key={mod} variant="outline">
                                  {mod}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={model.is_enabled ? 'default' : 'secondary'}
                            onClick={() => toggleModelEnabled(model.id, model.is_enabled)}
                          >
                            {model.is_enabled ? 'Enabled' : 'Disabled'}
                          </Button>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Quality: {((model.quality_score || 0) * 100).toFixed(0)}%</span>
                          <span>Reliability: {((model.reliability_score || 0) * 100).toFixed(0)}%</span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingModel(model)}
                          >
                            Edit
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add Manual Model Button */}
        <div className="mt-6">
          <Button
            variant="secondary"
            onClick={() => {
              setEditingModel(null);
              setShowAddModel(true);
            }}
          >
            Add Model Manually
          </Button>
        </div>

        {/* Edit Model Dialog */}
        <Dialog open={showAddModel || !!editingModel} onOpenChange={(open) => {
          if (!open) {
            setShowAddModel(false);
            setEditingModel(null);
          }
        }}>
          <DialogContent className="max-w-lg">
            <ModelForm
              model={editingModel}
              provider={selectedProvider}
              onSave={(data) => {
                handleSaveModel(data);
                setShowAddModel(false);
                setEditingModel(null);
              }}
              onCancel={() => {
                setShowAddModel(false);
                setEditingModel(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Configuration</h1>
        <p className="text-muted-foreground">Configure providers and manage models</p>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {providers.map((provider) => {
          const modelCount = registeredModels.filter(m => m.provider === provider.id).length;
          return (
            <Card
              key={provider.id}
              className="transition-all hover:border-primary hover:shadow-lg"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{provider.name}</CardTitle>
                  <Badge variant={provider.configured ? 'default' : 'destructive'} className={provider.configured ? 'bg-green-600' : ''}>
                    {provider.configured ? 'Configured' : 'Not Configured'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 text-sm text-muted-foreground mb-4">
                  {provider.hasApiKey && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✓</span>
                      <span>API Key Set</span>
                    </div>
                  )}
                  {provider.hasBaseUrl && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✓</span>
                      <span>Base URL: {provider.baseUrl}</span>
                    </div>
                  )}
                  {!provider.hasApiKey && !provider.hasBaseUrl && (
                    <div className="text-muted-foreground/70">Not configured</div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t gap-2">
                  <div className="text-sm text-muted-foreground">
                    {modelCount} model{modelCount !== 1 ? 's' : ''} registered
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchProviderConfig(provider.id);
                        setEditingProvider(provider);
                      }}
                    >
                      Settings
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProvider(provider.id);
                        fetchProviderModels(provider.id);
                      }}
                    >
                      Models →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Provider Settings Dialog */}
      <Dialog open={!!editingProvider} onOpenChange={(open) => {
        if (!open) {
          setEditingProvider(null);
          setProviderConfig(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProvider?.name} Settings</DialogTitle>
          </DialogHeader>
          {providerConfig && editingProvider && (
            <div className="space-y-4">
              {['openai', 'anthropic', 'groq'].includes(editingProvider.id) && (
                <div>
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder={providerConfig.apiKey === '***' ? 'API key is set (leave unchanged)' : 'Enter API key'}
                    value={providerConfig.apiKey === '***' ? '' : providerConfig.apiKey || ''}
                    onChange={(e) => setProviderConfig({ ...providerConfig, apiKey: e.target.value })}
                    className="mt-1"
                  />
                  {providerConfig.apiKey === '***' && (
                    <p className="text-xs text-muted-foreground mt-1">Leave empty to keep current value</p>
                  )}
                </div>
              )}
              {['ollama', 'lmstudio'].includes(editingProvider.id) && (
                <div>
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    type="text"
                    placeholder={editingProvider.id === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234'}
                    value={providerConfig.baseUrl || ''}
                    onChange={(e) => setProviderConfig({ ...providerConfig, baseUrl: e.target.value })}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Enter the base URL for your {editingProvider.name} instance</p>
                </div>
              )}
              <div>
                <Label htmlFor="timeout">Timeout (ms)</Label>
                <Input
                  id="timeout"
                  type="number"
                  placeholder="60000"
                  value={providerConfig.timeout || 60000}
                  onChange={(e) => setProviderConfig({ ...providerConfig, timeout: parseInt(e.target.value) || 60000 })}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Request timeout in milliseconds</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => {
              setEditingProvider(null);
              setProviderConfig(null);
            }}>
              Cancel
            </Button>
            <Button onClick={() => editingProvider && saveProviderConfig(editingProvider.id)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Manual Model Dialog */}
      <Dialog open={showAddModel} onOpenChange={setShowAddModel}>
        <DialogContent className="max-w-lg">
          <ModelForm
            model={null}
            provider={null}
            onSave={(data) => {
              handleSaveModel(data);
              setShowAddModel(false);
            }}
            onCancel={() => setShowAddModel(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModelForm({
  model,
  provider,
  onSave,
  onCancel,
}: {
  model: Model | null;
  provider: string | null;
  onSave: (data: Partial<Model>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: model?.name || '',
    provider: provider || model?.provider || 'openai',
    display_name: model?.display_name || '',
    modalities: model?.modalities || ['text'],
    quality_score: model?.quality_score || 0.5,
    reliability_score: model?.reliability_score || 0.5,
    cost_per_1k_tokens: model?.cost_per_1k_tokens || undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{model ? 'Edit Model' : 'Add New Model'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="display_name">Display Name</Label>
          <Input
            id="display_name"
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <Select
            value={formData.provider}
            onValueChange={(value) => setFormData({ ...formData, provider: value })}
            disabled={!!provider}
          >
            <SelectTrigger id="provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="groq">Groq</SelectItem>
              <SelectItem value="ollama">Ollama</SelectItem>
              <SelectItem value="lmstudio">LM Studio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Modalities</Label>
          <div className="flex gap-4">
            {['text', 'vision', 'image_gen'].map((mod) => (
              <div key={mod} className="flex items-center space-x-2">
                <Checkbox
                  id={mod}
                  checked={formData.modalities.includes(mod)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setFormData({
                        ...formData,
                        modalities: [...formData.modalities, mod],
                      });
                    } else {
                      setFormData({
                        ...formData,
                        modalities: formData.modalities.filter((m) => m !== mod),
                      });
                    }
                  }}
                />
                <Label htmlFor={mod} className="font-normal cursor-pointer">{mod}</Label>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quality_score">Quality Score</Label>
            <Input
              id="quality_score"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formData.quality_score.toString()}
              onChange={(e) =>
                setFormData({ ...formData, quality_score: parseFloat(e.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reliability_score">Reliability Score</Label>
            <Input
              id="reliability_score"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formData.reliability_score.toString()}
              onChange={(e) =>
                setFormData({ ...formData, reliability_score: parseFloat(e.target.value) })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost">Cost per 1k Tokens (optional)</Label>
          <Input
            id="cost"
            type="number"
            step="0.0001"
            value={formData.cost_per_1k_tokens?.toString() || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                cost_per_1k_tokens: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="default">
            {model ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
