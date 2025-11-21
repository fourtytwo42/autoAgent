'use client';

import { useState, useEffect } from 'react';
import Button from '../../components/ui/Button';
import { Card, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Select, SelectItem, Checkbox } from '@heroui/react';

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
  const [registeredModels, setRegisteredModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [showAddModel, setShowAddModel] = useState(false);

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
      <div style={{ padding: '24px' }}>
        <div style={{ color: '#a1a1aa' }}>Loading providers...</div>
      </div>
    );
  }

  if (selectedProvider) {
    const provider = providers.find(p => p.id === selectedProvider);
    const registeredModelIds = new Set(registeredModels.map(m => m.name));

    return (
      <div style={{ padding: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => setSelectedProvider(null)}
            style={{
              marginBottom: '16px',
              color: '#60a5fa',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '8px 0',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#93c5fd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#60a5fa';
            }}
          >
            ← Back to Providers
          </button>
          <h1 style={{
            fontSize: '30px',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '8px',
          }}>{provider?.name} Models</h1>
          <p style={{ color: '#a1a1aa' }}>
            {provider?.configured 
              ? 'Available models from this provider'
              : 'Configure this provider in your .env file to see available models'}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '24px',
        }}>
          {/* Available Models */}
          <Card style={{ padding: '24px' }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: 'white',
              marginBottom: '16px',
            }}>Available Models</h2>
            {loadingModels ? (
              <div style={{ color: '#a1a1aa' }}>Loading models...</div>
            ) : providerModels.length === 0 ? (
              <div style={{
                color: '#a1a1aa',
                textAlign: 'center',
                padding: '32px 0',
              }}>
                {provider?.configured 
                  ? 'No models found or provider unavailable'
                  : 'Provider not configured'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {providerModels.map((model) => {
                  const isRegistered = registeredModelIds.has(model.name);
                  return (
                    <Card
                      key={model.id}
                      isPressable
                      style={{
                        padding: '16px',
                        backgroundColor: '#27272a',
                        border: '1px solid #3f3f46',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{
                            fontWeight: '500',
                            color: 'white',
                            marginBottom: '4px',
                          }}>
                            {model.display_name || model.name}
                          </h3>
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                            marginTop: '8px',
                          }}>
                            {model.modalities?.map((mod) => (
                              <Chip key={mod} size="sm" variant="flat" color="default">
                                {mod}
                              </Chip>
                            ))}
                          </div>
                          {model.context_window && (
                            <div style={{
                              fontSize: '12px',
                              color: '#a1a1aa',
                              marginTop: '8px',
                            }}>
                              Context: {model.context_window.toLocaleString()} tokens
                            </div>
                          )}
                        </div>
                        {isRegistered ? (
                          <Chip color="success" variant="flat" size="sm">
                            Registered
                          </Chip>
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
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Registered Models */}
          <Card style={{ padding: '24px' }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: 'white',
              marginBottom: '16px',
            }}>Registered Models</h2>
            {registeredModels.length === 0 ? (
              <div style={{
                color: '#a1a1aa',
                textAlign: 'center',
                padding: '32px 0',
              }}>No models registered yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {registeredModels.map((model) => (
                  <Card
                    key={model.id}
                    style={{
                      padding: '16px',
                      backgroundColor: '#27272a',
                      border: '1px solid #3f3f46',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                    }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{
                          fontWeight: '500',
                          color: 'white',
                          marginBottom: '4px',
                        }}>
                          {model.display_name || model.name}
                        </h3>
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          marginTop: '8px',
                        }}>
                          {model.modalities.map((mod) => (
                            <Chip key={mod} size="sm" variant="flat" color="default">
                              {mod}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        color={model.is_enabled ? 'success' : 'default'}
                        variant={model.is_enabled ? 'primary' : 'secondary'}
                        onClick={() => toggleModelEnabled(model.id, model.is_enabled)}
                      >
                        {model.is_enabled ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      fontSize: '14px',
                      color: '#a1a1aa',
                    }}>
                      <span>Quality: {((model.quality_score || 0) * 100).toFixed(0)}%</span>
                      <span>Reliability: {((model.reliability_score || 0) * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingModel(model)}
                      >
                        Edit
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Add Manual Model Button */}
        <div style={{ marginTop: '24px' }}>
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

        {/* Edit Model Modal */}
        <Modal
          isOpen={showAddModel || !!editingModel}
          onClose={() => {
            setShowAddModel(false);
            setEditingModel(null);
          }}
          size="lg"
        >
          <ModalContent>
            {(onClose) => (
              <ModelForm
                model={editingModel}
                provider={selectedProvider}
                onSave={(data) => {
                  handleSaveModel(data);
                  onClose();
                }}
                onCancel={onClose}
              />
            )}
          </ModalContent>
        </Modal>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '30px',
          fontWeight: 'bold',
          color: 'white',
          marginBottom: '8px',
        }}>Configuration</h1>
        <p style={{ color: '#a1a1aa' }}>Configure providers and manage models</p>
      </div>

      {/* Provider Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '32px',
      }}>
        {providers.map((provider) => {
          const modelCount = registeredModels.filter(m => m.provider === provider.id).length;
          return (
            <Card
              key={provider.id}
              isPressable
              onPress={() => setSelectedProvider(provider.id)}
              style={{
                padding: '24px',
                cursor: 'pointer',
                border: '1px solid #3f3f46',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#3f3f46';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: 'white',
                }}>{provider.name}</h2>
                <Chip
                  color={provider.configured ? 'success' : 'danger'}
                  variant="flat"
                  size="sm"
                >
                  {provider.configured ? 'Configured' : 'Not Configured'}
                </Chip>
              </div>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '14px',
                color: '#a1a1aa',
                marginBottom: '16px',
              }}>
                {provider.hasApiKey && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#4ade80' }}>✓</span>
                    <span>API Key Set</span>
                  </div>
                )}
                {provider.hasBaseUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#4ade80' }}>✓</span>
                    <span>Base URL: {provider.baseUrl}</span>
                  </div>
                )}
                {!provider.hasApiKey && !provider.hasBaseUrl && (
                  <div style={{ color: '#71717a' }}>Not configured</div>
                )}
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '16px',
                borderTop: '1px solid #3f3f46',
              }}>
                <div style={{ fontSize: '14px', color: '#a1a1aa' }}>
                  {modelCount} model{modelCount !== 1 ? 's' : ''} registered
                </div>
                <Button size="sm" variant="primary">
                  View Models →
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Environment Variables Help */}
      <Card style={{ padding: '24px' }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: 'white',
          marginBottom: '16px',
        }}>Environment Variables</h3>
        <p style={{
          color: '#a1a1aa',
          fontSize: '14px',
          marginBottom: '16px',
        }}>
          Configure providers by adding these variables to your <code style={{
            backgroundColor: '#18181b',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
          }}>.env</code> file:
        </p>
        <div style={{
          backgroundColor: '#18181b',
          borderRadius: '8px',
          padding: '16px',
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#d4d4d8',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <div>OPENAI_API_KEY=your_key_here</div>
          <div>ANTHROPIC_API_KEY=your_key_here</div>
          <div>GROQ_API_KEY=your_key_here</div>
          <div>OLLAMA_BASE_URL=http://localhost:11434</div>
          <div>LM_STUDIO_BASE_URL=http://localhost:1234</div>
        </div>
      </Card>

      {/* Add Manual Model Modal */}
      <Modal
        isOpen={showAddModel}
        onClose={() => setShowAddModel(false)}
        size="lg"
      >
        <ModalContent>
          {(onClose) => (
            <ModelForm
              model={null}
              provider={null}
              onSave={(data) => {
                handleSaveModel(data);
                onClose();
              }}
              onCancel={onClose}
            />
          )}
        </ModalContent>
      </Modal>
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
      <ModalHeader>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: 'white',
        }}>
          {model ? 'Edit Model' : 'Add New Model'}
        </h2>
      </ModalHeader>
      <ModalBody>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            isRequired
            variant="bordered"
          />
          <Input
            label="Display Name"
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            variant="bordered"
          />
          <Select
            label="Provider"
            selectedKeys={[formData.provider]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string;
              setFormData({ ...formData, provider: value });
            }}
            isDisabled={!!provider}
            variant="bordered"
          >
            <SelectItem key="openai">OpenAI</SelectItem>
            <SelectItem key="anthropic">Anthropic</SelectItem>
            <SelectItem key="groq">Groq</SelectItem>
            <SelectItem key="ollama">Ollama</SelectItem>
            <SelectItem key="lmstudio">LM Studio</SelectItem>
          </Select>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#d4d4d8',
              marginBottom: '8px',
            }}>Modalities</label>
            <div style={{ display: 'flex', gap: '16px' }}>
              {['text', 'vision', 'image_gen'].map((mod) => (
                <Checkbox
                  key={mod}
                  isSelected={formData.modalities.includes(mod)}
                  onValueChange={(checked) => {
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
                >
                  {mod}
                </Checkbox>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input
              label="Quality Score"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formData.quality_score.toString()}
              onChange={(e) =>
                setFormData({ ...formData, quality_score: parseFloat(e.target.value) })
              }
              variant="bordered"
            />
            <Input
              label="Reliability Score"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formData.reliability_score.toString()}
              onChange={(e) =>
                setFormData({ ...formData, reliability_score: parseFloat(e.target.value) })
              }
              variant="bordered"
            />
          </div>
          <Input
            label="Cost per 1k Tokens (optional)"
            type="number"
            step="0.0001"
            value={formData.cost_per_1k_tokens?.toString() || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                cost_per_1k_tokens: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            variant="bordered"
          />
          <ModalFooter>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {model ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </form>
      </ModalBody>
    </>
  );
}
